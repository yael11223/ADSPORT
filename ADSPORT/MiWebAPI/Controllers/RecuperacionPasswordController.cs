using ADSPORT.Data;
using ADSPORT.Models;
using ADSPORT.Security;
using ADSPORT.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using System.Security.Cryptography;

namespace ADSPORT.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/RecuperacionPassword")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class RecuperacionPasswordController(RecuperacionPasswordData datos,
    ColaCorreoRecuperacion cola, IConfiguration configuration) : ControllerBase
{
    [HttpPost("solicitar")]
    [EnableRateLimiting("recuperacion-envio")]
    public async Task<IActionResult> Solicitar(SolicitarRecuperacionPassword solicitud)
    {
        var correo = solicitud.Correo.Trim().ToLowerInvariant();
        var codigo = RandomNumberGenerator.GetInt32(0, 1000000).ToString("D6");
        var hash = CodigoVerificacionSeguro.CrearHash(configuration, correo, codigo, recuperacion: true);
        var id = await datos.Solicitar(correo, hash);
        if (id.HasValue && !cola.Agregar(correo, codigo, id.Value)) await datos.InvalidarEnvio(id.Value);
        return Ok(new { isSuccess = true, numeroError = 0,
            respuesta = "Si el correo corresponde a una cuenta activa, recibirás un código para recuperar tu contraseña. Revisa también la carpeta de spam.",
            reenviarEnSegundos = 60 });
    }

    [HttpPost("restablecer")]
    [EnableRateLimiting("recuperacion-cambio")]
    public async Task<IActionResult> Restablecer(RestablecerPasswordSolicitud solicitud)
    {
        var error = PoliticaPassword.Validar(solicitud.NuevaPassword);
        if (error is not null) return BadRequest(new { isSuccess = false, numeroError = 400, respuesta = error });
        var correo = solicitud.Correo.Trim().ToLowerInvariant();
        var hash = CodigoVerificacionSeguro.CrearHash(configuration, correo, solicitud.Codigo, recuperacion: true);
        var passwordHash = BCrypt.Net.BCrypt.HashPassword(solicitud.NuevaPassword, workFactor: 12);
        await datos.Restablecer(correo, hash, passwordHash);
        cola.NotificarCambio(correo);
        return Ok(new { isSuccess = true, numeroError = 0,
            respuesta = "Tu contraseña se actualizó. Inicia sesión con la nueva contraseña." });
    }
}
