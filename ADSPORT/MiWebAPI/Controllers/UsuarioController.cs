
using ADSPORT.Data;
using ADSPORT.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authentication.Cookies;
using MiWebAPI.Models;
using System.Security.Claims;

namespace ADSPORT.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UsuarioController : ControllerBase
    {
        private readonly UsuarioData _usuarioData;

        public UsuarioController(UsuarioData usuarioData)
        {
            _usuarioData = usuarioData;
        }

        // ========================================
        // 1. LISTAR USUARIOS
        // ========================================

        [HttpGet]
        public async Task<IActionResult> Lista()
        {
            List<Usuario> lista =
                await _usuarioData.Lista();

            return StatusCode(
                StatusCodes.Status200OK,
                lista
            );
        }

        // ========================================
        // 2. OBTENER USUARIO POR ID
        // ========================================

        [HttpGet("{id}")]
        public async Task<IActionResult> Obtener(int id)
        {
            Usuario? objeto =
                await _usuarioData.Obtener(id);

            if (objeto == null)
            {
                return NotFound(new
                {
                    numeroError = 1,
                    respuesta = "Usuario no encontrado"
                });
            }

            return StatusCode(
                StatusCodes.Status200OK,
                objeto
            );
        }

        // ========================================
        // 3. CREAR USUARIO
        // ========================================

        [HttpPost]
        public async Task<IActionResult> Crear(
            [FromBody] Usuario objeto)
        {
            RespuestaOperacion resultado =
                await _usuarioData.Crear(objeto);

            return StatusCode(
                StatusCodes.Status200OK,
                resultado
            );
        }

        // ========================================
        // 4. EDITAR USUARIO
        // ========================================

        [HttpPut("{id}")]
        public async Task<IActionResult> Editar(
            int id,
            [FromBody] Usuario objeto)
        {
            objeto.IdUsuario = id;

            RespuestaOperacion resultado =
                await _usuarioData.Editar(objeto);

            return StatusCode(
                StatusCodes.Status200OK,
                resultado
            );
        }

        // ========================================
        // 5. ELIMINAR USUARIO
        // ========================================

        [HttpDelete("{id}")]
        public async Task<IActionResult> Eliminar(int id)
        {
            RespuestaOperacion resultado =
                await _usuarioData.Eliminar(id);

            return StatusCode(
                StatusCodes.Status200OK,
                resultado
            );
        }

        // ========================================
        // 6. OBTENER MI PERFIL
        // ========================================

        [HttpGet("mi-perfil")]
        [Authorize(
            AuthenticationSchemes =
                CookieAuthenticationDefaults
                    .AuthenticationScheme
        )]
        public async Task<IActionResult> MiPerfil()
        {
            // Obtener el ID de la sesión.
            string? idSesion = User.FindFirstValue(
                ClaimTypes.NameIdentifier
            );

            if (!int.TryParse(
                idSesion,
                out int idUsuario))
            {
                return Unauthorized(new
                {
                    numeroError = 1,
                    respuesta = "Sesión no válida."
                });
            }

            // Consultar al usuario.
            Usuario? usuario =
                await _usuarioData.Obtener(idUsuario);

            if (usuario == null)
            {
                return NotFound(new
                {
                    numeroError = 2,
                    respuesta = "Usuario no encontrado."
                });
            }

            // Construir nombre completo.
            string nombreCompleto = string.Join(
                " ",
                new[]
                {
                    usuario.Nombre,
                    usuario.ApellidoPaterno,
                    usuario.ApellidoMaterno
                }
                .Where(nombre =>
                    !string.IsNullOrWhiteSpace(nombre))
            );

            // Devolver solamente los datos
            // necesarios para el Header.
            return Ok(new
            {
                idUsuario = usuario.IdUsuario,
                nombre = usuario.Nombre,
                nombreCompleto = nombreCompleto,
                tieneFoto = usuario.Foto != null
                    && usuario.Foto.Length > 0
            });
        }

        // ========================================
        // 7. OBTENER MI FOTOGRAFÍA
        // ========================================

        [HttpGet("mi-foto")]
        [Authorize(
            AuthenticationSchemes =
                CookieAuthenticationDefaults
                    .AuthenticationScheme
        )]
        public async Task<IActionResult> MiFoto()
        {
            // Obtener ID desde la sesión.
            string? idSesion = User.FindFirstValue(
                ClaimTypes.NameIdentifier
            );

            if (!int.TryParse(
                idSesion,
                out int idUsuario))
            {
                return Unauthorized();
            }

            // Consultar fotografía.
            Usuario? usuario =
                await _usuarioData.Obtener(idUsuario);

            if (usuario == null ||
                usuario.Foto == null ||
                usuario.Foto.Length == 0)
            {
                return NotFound();
            }

            // Detectar formato real de la imagen.
            string? tipoImagen =
                DetectarTipoImagen(usuario.Foto);

            if (tipoImagen == null)
            {
                return StatusCode(
                    StatusCodes
                        .Status415UnsupportedMediaType
                );
            }

            // Evitar almacenar la fotografía
            // privada en cachés compartidas.
            Response.Headers.CacheControl =
                "private, no-store";

            return File(
                usuario.Foto,
                tipoImagen
            );
        }

        // ========================================
        // 8. DETECTAR TIPO DE IMAGEN
        // ========================================

        private static string? DetectarTipoImagen(
            byte[] datos)
        {
            // JPEG
            if (datos.Length >= 3 &&
                datos[0] == 0xFF &&
                datos[1] == 0xD8 &&
                datos[2] == 0xFF)
            {
                return "image/jpeg";
            }

            // PNG
            if (datos.Length >= 8 &&
                datos[0] == 0x89 &&
                datos[1] == 0x50 &&
                datos[2] == 0x4E &&
                datos[3] == 0x47 &&
                datos[4] == 0x0D &&
                datos[5] == 0x0A &&
                datos[6] == 0x1A &&
                datos[7] == 0x0A)
            {
                return "image/png";
            }

            // WebP
            if (datos.Length >= 12 &&
                datos[0] == 0x52 &&
                datos[1] == 0x49 &&
                datos[2] == 0x46 &&
                datos[3] == 0x46 &&
                datos[8] == 0x57 &&
                datos[9] == 0x45 &&
                datos[10] == 0x42 &&
                datos[11] == 0x50)
            {
                return "image/webp";
            }

            return null;
        }
    }
}
