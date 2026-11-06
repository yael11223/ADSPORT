
using ADSPORT.Data;
using ADSPORT.Models;
using ADSPORT.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using MiWebAPI.Models;
using System.ComponentModel.DataAnnotations;
using System.Security.Cryptography;
using System.Text;

namespace ADSPORT.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class VerificacionController : ControllerBase
    {
        private readonly VerificacionData _verificacionData;
        private readonly CorreoService _correoService;
        private readonly IConfiguration _configuration;
        private readonly ILogger<VerificacionController> _logger;

        // ========================================
        // CONSTRUCTOR
        // ========================================

        public VerificacionController(
            VerificacionData verificacionData,
            CorreoService correoService,
            IConfiguration configuration,
            ILogger<VerificacionController> logger)
        {
            _verificacionData = verificacionData;
            _correoService = correoService;
            _configuration = configuration;
            _logger = logger;
        }

        // ========================================
        // GENERAR HASH SEGURO DEL CÓDIGO
        // ========================================

        private string GenerarHash(string correo, string codigo)
        {
            string clave = _configuration["Verificacion:ClaveHmac"]
                ?? throw new InvalidOperationException(
                    "Falta configurar la clave HMAC de verificación."
                );

            byte[] claveBytes = Convert.FromBase64String(clave);

            if (claveBytes.Length < 32)
            {
                throw new InvalidOperationException(
                    "La clave HMAC debe tener al menos 32 bytes."
                );
            }

            string contenido =
                $"{correo.Trim().ToLowerInvariant()}:{codigo}";

            using (var hmac = new HMACSHA256(claveBytes))
            {
                byte[] hash = hmac.ComputeHash(
                    Encoding.UTF8.GetBytes(contenido)
                );

                return Convert.ToHexString(hash);
            }
        }

        // ========================================
        // 1. AGREGAR CÓDIGO DE VERIFICACIÓN
        // ========================================

        [HttpPost("agregar")]
        public async Task<IActionResult> Agregar(
            [FromBody] SolicitudCorreoVerificacion solicitud)
        {
            string correo = solicitud.Correo.Trim().ToLowerInvariant();

            RespuestaOperacion permiso =
                await _verificacionData.Reenviar(correo);

            if (permiso.NumeroError != 200)
            {
                return StatusCode(
                    StatusCodes.Status200OK,
                    permiso
                );
            }

            string codigo = RandomNumberGenerator
                .GetInt32(0, 1000000)
                .ToString("D6");

            string codigoHash = GenerarHash(correo, codigo);

            var objeto = new Verificacion
            {
                Correo = correo,
                CodigoHash = codigoHash
            };

            RespuestaOperacion resultado =
                await _verificacionData.Agregar(objeto);

            if (resultado.NumeroError != 200)
            {
                return StatusCode(
                    StatusCodes.Status200OK,
                    resultado
                );
            }

            try
            {
                await _correoService.EnviarCodigo(correo, codigo);

                return StatusCode(
                    StatusCodes.Status200OK,
                    new RespuestaOperacion
                    {
                        NumeroError = 200,
                        Respuesta =
                            "Código de verificación enviado correctamente."
                    }
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Error al enviar el correo de verificación."
                );

                return StatusCode(
                    StatusCodes.Status200OK,
                    new RespuestaOperacion
                    {
                        NumeroError = 502,
                        Respuesta =
                            "El código se registró, pero no se pudo enviar el correo."
                    }
                );
            }
        }

        // ========================================
        // 2. VALIDAR CÓDIGO DE VERIFICACIÓN
        // ========================================

        [HttpPost("validar")]
        public async Task<IActionResult> Validar(
            [FromBody] SolicitudValidarCodigo solicitud)
        {
            string correo = solicitud.Correo.Trim().ToLowerInvariant();

            string codigo = solicitud.Codigo;

            string codigoHash = GenerarHash(correo, codigo);

            var objeto = new Verificacion
            {
                Correo = correo,
                CodigoHash = codigoHash
            };

            RespuestaOperacion resultado =
                await _verificacionData.Validar(objeto);

            return StatusCode(
                StatusCodes.Status200OK,
                resultado
            );
        }

        // ========================================
        // 3. COMPROBAR REENVÍO DE CÓDIGO
        // ========================================

        [HttpGet("reenviar")]
        public async Task<IActionResult> Reenviar(
            [FromQuery] string correo)
        {
            RespuestaOperacion resultado =
                await _verificacionData.Reenviar(
                    correo.Trim().ToLowerInvariant()
                );

            return StatusCode(
                StatusCodes.Status200OK,
                resultado
            );
        }

        // ========================================
        // 4. CONSULTAR CORREO VERIFICADO
        // ========================================

        [HttpGet("consultar")]
        public async Task<IActionResult> ConsultarVerificacion(
            [FromQuery] string correo)
        {
            RespuestaOperacion resultado =
                await _verificacionData.ConsultarVerificacion(
                    correo.Trim().ToLowerInvariant()
                );

            return StatusCode(
                StatusCodes.Status200OK,
                resultado
            );
        }

        // ========================================
        // 5. REGISTRAR NUEVO USUARIO CLIENTE
        // ========================================

        [HttpPost("registrar")]
        public async Task<IActionResult> RegistrarCliente(
            [FromBody] UsuarioCliente objeto)
        {
            // Validar contraseña obligatoria
            if (string.IsNullOrWhiteSpace(objeto.Password))
            {
                return StatusCode(
                    StatusCodes.Status200OK,
                    new RespuestaOperacion
                    {
                        NumeroError = 400,
                        Respuesta = "La contraseña es obligatoria."
                    }
                );
            }

            try
            {
                // Normalizar correo electrónico
                objeto.Correo =
                    objeto.Correo.Trim().ToLowerInvariant();

                // Convertir la contraseña en hash BCrypt
                string passwordHash =
                    BCrypt.Net.BCrypt.HashPassword(
                        objeto.Password,
                        workFactor: 12
                    );

                // Ejecutar el Stored Procedure
                RespuestaOperacion resultado =
                    await _verificacionData.RegistrarCliente(
                        objeto,
                        passwordHash
                    );

                return StatusCode(
                    StatusCodes.Status200OK,
                    resultado
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Error al registrar el nuevo usuario cliente."
                );

                return StatusCode(
                    StatusCodes.Status200OK,
                    new RespuestaOperacion
                    {
                        NumeroError = 500,
                        Respuesta =
                            "Ocurrió un error al registrar el usuario."
                    }
                );
            }
        }
    }

    // ========================================
    // MODELO PARA SOLICITAR CÓDIGO
    // ========================================

    public class SolicitudCorreoVerificacion
    {
        [Required]
        [EmailAddress]
        public string Correo { get; set; } = string.Empty;
    }

    // ========================================
    // MODELO PARA VALIDAR CÓDIGO
    // ========================================

    public class SolicitudValidarCodigo
    {
        [Required]
        [EmailAddress]
        public string Correo { get; set; } = string.Empty;

        [Required]
        [RegularExpression(@"^\d{6}$")]
        public string Codigo { get; set; } = string.Empty;
    }
}
