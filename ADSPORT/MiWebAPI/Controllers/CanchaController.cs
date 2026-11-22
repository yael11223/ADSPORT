using ADSPORT.Data;
using ADSPORT.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Buffers.Binary;

namespace ADSPORT.Controllers;

[ApiController]
[Route("api/Cancha")]
[Authorize(Policy = "SoloPersonal")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class CanchaController(CanchaData canchas) : ControllerBase
{
    private const int MaximoImagen = 5 * 1024 * 1024;

    [HttpPost("{id:long:min(1)}/imagen")]
    [Authorize(Policy = "SoloAdministrador")]
    [ValidateAntiForgeryToken]
    [RequestSizeLimit(6 * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 6 * 1024 * 1024)]
    public async Task<IActionResult> SubirImagen(long id, [FromForm] IFormFile? archivo)
    {
        if (archivo is null || archivo.Length == 0) return BadRequest(new { respuesta = "Selecciona una imagen JPEG, PNG o WebP." });
        if (archivo.Length > MaximoImagen) return StatusCode(413, new { respuesta = "La imagen no puede superar 5 MB." });
        await using var buffer = new MemoryStream();
        await archivo.CopyToAsync(buffer, HttpContext.RequestAborted);
        var imagen = buffer.ToArray();
        var tipo = DetectarTipo(imagen);
        if (tipo is null) return BadRequest(new { respuesta = "El archivo no corresponde a una imagen JPEG, PNG o WebP." });
        await canchas.GuardarImagen(id, imagen, tipo);
        return Ok(new { isSuccess = true, numeroError = 0, respuesta = "Imagen de la instalación guardada.",
            imagenUrl = $"/api/Cancha/{id}/imagen?v={DateTime.UtcNow.Ticks}" });
    }

    [HttpGet("{id:long:min(1)}/imagen")]
    [AllowAnonymous]
    public async Task<IActionResult> Imagen(long id)
    {
        var imagen = await canchas.ObtenerImagen(id, User.HasClaim("ADSPORT.Administrador", "true"));
        if (!imagen.HasValue) return NotFound();
        var tipo = DetectarTipo(imagen.Value.Datos);
        if (tipo is null || tipo != imagen.Value.Tipo) return StatusCode(415);
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        return File(imagen.Value.Datos, tipo);
    }

    private static string? DetectarTipo(ReadOnlySpan<byte> datos)
    {
        if (datos.Length >= 3 && datos[0] == 255 && datos[1] == 216 && datos[2] == 255) return "image/jpeg";
        if (datos.Length >= 8 && datos[..8].SequenceEqual(new byte[] {137,80,78,71,13,10,26,10})) return "image/png";
        if (datos.Length >= 12 && datos[..4].SequenceEqual("RIFF"u8) && datos.Slice(8,4).SequenceEqual("WEBP"u8)
            && BinaryPrimitives.ReadUInt32LittleEndian(datos.Slice(4,4)) == (uint)(datos.Length - 8)) return "image/webp";
        return null;
    }

    [HttpGet]
    public async Task<IActionResult> Lista([FromQuery] bool incluirInactivas = false)
    {
        if (incluirInactivas && !User.HasClaim("ADSPORT.Administrador", "true")) return Forbid();
        return Ok(await canchas.Listar(incluirInactivas));
    }

    [HttpPost]
    [Authorize(Policy = "SoloAdministrador")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Crear([FromBody] GuardarCanchaSolicitud solicitud)
    {
        var id = await canchas.Guardar(null, solicitud);
        return StatusCode(201, new { isSuccess = true, numeroError = 0, idCancha = id, respuesta = "Cancha registrada." });
    }

    [HttpPut("{id:long:min(1)}")]
    [Authorize(Policy = "SoloAdministrador")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Editar(long id, [FromBody] GuardarCanchaSolicitud solicitud)
    {
        await canchas.Guardar(id, solicitud);
        return Ok(new { isSuccess = true, numeroError = 0, idCancha = id, respuesta = "Cancha actualizada." });
    }

    [HttpDelete("{id:long:min(1)}")]
    [Authorize(Policy = "SoloAdministrador")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Eliminar(long id)
    {
        await canchas.Eliminar(id);
        return Ok(new { isSuccess = true, numeroError = 0,
            respuesta = "Cancha eliminada definitivamente. Las clases afectadas quedaron sin cancha y dejaron de publicarse." });
    }

    [HttpGet("{id:long:min(1)}/disponibilidad")]
    public async Task<IActionResult> Disponibilidad(long id, [FromQuery, Range(1, 7)] int? diaSemana,
        [FromQuery, Range(1, long.MaxValue)] long? excluirClase)
    {
        long? entrenador = User.HasClaim("ADSPORT.Administrador", "true") ? null : long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        return Ok(await canchas.Disponibilidad(id, diaSemana, entrenador, excluirClase));
    }
}
