using ADSPORT.Data;
using ADSPORT.Models;
using ADSPORT.Security;
using ADSPORT.Services;
using Microsoft.AspNetCore.Mvc;
using MiWebAPI.Models;
using System.ComponentModel.DataAnnotations;
using System.Security.Cryptography;

namespace ADSPORT.Controllers;

[Route("api/[controller]")]
[ApiController]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class VerificacionController(VerificacionData datos, CorreoService correoService,
    RegistroVerificado registroVerificado, IConfiguration configuration, ILogger<VerificacionController> logger) : ControllerBase
{
    private static RespuestaOperacion Error(int codigo, string mensaje) => new() { NumeroError = codigo, Respuesta = mensaje };

    [HttpPost("agregar")]
    public async Task<IActionResult> Agregar(SolicitudCorreoVerificacion solicitud)
    {
        var correo = solicitud.Correo.Trim().ToLowerInvariant();
        var permiso = await datos.Reenviar(correo);
        if (permiso.NumeroError != 200) return Ok(permiso);
        var codigo = RandomNumberGenerator.GetInt32(0, 1000000).ToString("D6");
        var resultado = await datos.Agregar(new Verificacion
        {
            Correo = correo, CodigoHash = CodigoVerificacionSeguro.CrearHash(configuration, correo, codigo)
        });
        if (resultado.NumeroError != 200) return Ok(resultado);
        registroVerificado.Borrar(Response);
        try
        {
            await correoService.EnviarCodigo(correo, codigo);
            return Ok(new RespuestaOperacion { NumeroError = 200, Respuesta = "Código de verificación enviado correctamente." });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error al enviar el correo de verificación.");
            return Ok(Error(502, "El código se registró, pero no se pudo enviar el correo. Intenta reenviarlo después de la espera."));
        }
    }

    [HttpPost("validar")]
    public async Task<IActionResult> Validar(SolicitudValidarCodigo solicitud)
    {
        var correo = solicitud.Correo.Trim().ToLowerInvariant();
        var resultado = await datos.Validar(new Verificacion
        {
            Correo = correo, CodigoHash = CodigoVerificacionSeguro.CrearHash(configuration, correo, solicitud.Codigo)
        });
        if (resultado.NumeroError == 200)
        {
            if (!resultado.IdCodigoVerificado.HasValue)
                return Ok(Error(500, "La verificación requiere la actualización SQL de registro seguro."));
            registroVerificado.Guardar(Response, correo, resultado.IdCodigoVerificado.Value);
        }
        return Ok(resultado);
    }

    [HttpGet("reenviar")]
    public async Task<IActionResult> Reenviar([FromQuery, Required, EmailAddress, StringLength(100)] string correo) =>
        Ok(await datos.Reenviar(correo.Trim().ToLowerInvariant()));

    [HttpGet("consultar")]
    public async Task<IActionResult> ConsultarVerificacion([FromQuery, Required, EmailAddress, StringLength(100)] string correo)
    {
        correo = correo.Trim().ToLowerInvariant();
        if (registroVerificado.Leer(Request, correo) is null)
            return Ok(Error(403, "Verifica el correo desde este navegador antes de continuar."));
        return Ok(await datos.ConsultarVerificacion(correo));
    }

    [HttpPost("registrar")]
    public async Task<IActionResult> RegistrarCliente(UsuarioCliente solicitud)
    {
        solicitud.Correo = solicitud.Correo.Trim().ToLowerInvariant();
        var idCodigo = registroVerificado.Leer(Request, solicitud.Correo);
        if (idCodigo is null) return Ok(Error(403, "Verifica el correo desde este navegador antes de registrarte."));
        var error = PoliticaPassword.Validar(solicitud.Password);
        if (error is not null) return Ok(Error(400, error));
        var hash = BCrypt.Net.BCrypt.HashPassword(solicitud.Password, workFactor: 12);
        var resultado = await datos.RegistrarCliente(solicitud, hash, idCodigo.Value);
        if (resultado.NumeroError == 201) registroVerificado.Borrar(Response);
        return Ok(resultado);
    }
}

public class SolicitudCorreoVerificacion
{
    [Required, EmailAddress, StringLength(100)]
    public string Correo { get; set; } = string.Empty;
}

public sealed class SolicitudValidarCodigo : SolicitudCorreoVerificacion
{
    [Required, RegularExpression(@"^[0-9]{6}$")]
    public string Codigo { get; set; } = string.Empty;
}
