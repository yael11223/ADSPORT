using ADSPORT.Data;
using ADSPORT.Models;
using ADSPORT.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using QRCoder;
using System.Security.Claims;

namespace ADSPORT.Controllers;

[ApiController]
[Route("api/Usuario")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class UsuarioController(UsuarioData usuarios, ClaseData clases) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = "SoloAdministrador")]
    public async Task<IActionResult> Lista([FromQuery] string? rol = null)
    {
        if (rol?.Length > 100) return BadRequest(new { respuesta = "El rol admite hasta 100 caracteres." });
        return Ok(await usuarios.Lista(rol));
    }

    [HttpGet("{id:long:min(1)}")]
    [Authorize(Policy = "SoloAdministrador")]
    public async Task<IActionResult> Obtener(long id)
    {
        var usuario = await usuarios.Obtener(id);
        return usuario is null ? NotFound(new { respuesta = "Usuario no encontrado." }) : Ok(usuario);
    }

    [HttpPost]
    [Authorize(Policy = "SoloAdministrador")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Crear([FromBody] AltaEmpleadoRequest solicitud)
    {
        var error = PoliticaPassword.Validar(solicitud.PasswordInicial);
        if (error is not null) return BadRequest(new { isSuccess = false, numeroError = 400, respuesta = error });
        var resultado = await usuarios.Crear(solicitud, BCrypt.Net.BCrypt.HashPassword(solicitud.PasswordInicial, workFactor: 12));
        return Created($"/api/Usuario/{resultado.IdUsuario}", resultado);
    }

    [HttpPut("{id:long:min(1)}")]
    [Authorize(Policy = "SoloAdministrador")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Editar(long id, [FromBody] Usuario solicitud)
    {
        solicitud.IdUsuario = id;
        return Ok(await usuarios.Editar(solicitud));
    }

    [HttpDelete("{id:long:min(1)}")]
    [Authorize(Policy = "SoloAdministrador")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Eliminar(long id) => Ok(await usuarios.Eliminar(id));

    [HttpPost("{id:long:min(1)}/desactivar")]
    [Authorize(Policy = "SoloAdministrador")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Desactivar(long id) => Ok(await usuarios.Desactivar(id));

    [HttpGet("{id:long:min(1)}/clases")]
    [Authorize(Policy = "SoloAdministrador")]
    public async Task<IActionResult> Clases(long id)
    {
        var usuario = await usuarios.Obtener(id);
        if (usuario is null || !string.Equals(usuario.NombreRol?.Trim(), "ENTRENADOR", StringComparison.OrdinalIgnoreCase))
            return NotFound(new { respuesta = "No se encontró al profesor." });
        return Ok(await clases.Consultar(id, administracion: true));
    }

    [HttpGet("{id:long:min(1)}/qr")]
    [Authorize(Policy = "SoloAdministrador")]
    public async Task<IActionResult> Qr(long id)
    {
        var usuario = await usuarios.Obtener(id);
        if (usuario is null || string.IsNullOrWhiteSpace(usuario.CodigoQr)) return NotFound();
        using var datos = QRCodeGenerator.GenerateQrCode(usuario.CodigoQr, QRCodeGenerator.ECCLevel.Q);
        using var qr = new PngByteQRCode(datos);
        return File(qr.GetGraphic(10), "image/png");
    }

    [HttpGet("mi-perfil")]
    [Authorize]
    public async Task<IActionResult> MiPerfil()
    {
        if (!long.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id)) return Unauthorized();
        var usuario = await usuarios.Obtener(id);
        if (usuario is null) return NotFound();
        return Ok(new
        {
            usuario.IdUsuario, usuario.Nombre, usuario.ApellidoPaterno, usuario.ApellidoMaterno,
            nombreCompleto = string.Join(" ", new[] { usuario.Nombre, usuario.ApellidoPaterno, usuario.ApellidoMaterno }.Where(x => !string.IsNullOrWhiteSpace(x))),
            usuario.Correo, usuario.Telefono, usuario.NombreRol, usuario.Estatus, usuario.TieneFoto
        });
    }

    [HttpGet("mi-foto")]
    [Authorize]
    public async Task<IActionResult> MiFoto()
    {
        if (!long.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id)) return Unauthorized();
        var usuario = await usuarios.Obtener(id);
        if (usuario?.Foto is not { Length: > 0 } foto) return NotFound();
        var tipo = foto.Length >= 3 && foto[0] == 255 && foto[1] == 216 && foto[2] == 255 ? "image/jpeg"
            : foto.Length >= 8 && foto.AsSpan(0, 8).SequenceEqual(new byte[] { 137,80,78,71,13,10,26,10 }) ? "image/png"
            : foto.Length >= 12 && System.Text.Encoding.ASCII.GetString(foto, 0, 4) == "RIFF"
              && System.Text.Encoding.ASCII.GetString(foto, 8, 4) == "WEBP" ? "image/webp" : null;
        return tipo is null ? StatusCode(415) : File(foto, tipo);
    }
}
