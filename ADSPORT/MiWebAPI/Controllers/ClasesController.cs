using ADSPORT.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Data.SqlClient;

namespace ADSPORT.Controllers;

[ApiController]
[Route("api/Clases")]
[AllowAnonymous]
public sealed class ClasesController : ControllerBase
{
    private readonly ClaseData _data;
    private readonly ILogger<ClasesController> _logger;
    public ClasesController(ClaseData data, ILogger<ClasesController> logger) { _data = data; _logger = logger; }

    [HttpGet]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<IActionResult> Consultar([FromQuery] string? deporte = null)
    {
        if (deporte?.Length > 50) return BadRequest(new { isSuccess = false, numeroError = 400, respuesta = "El deporte admite hasta 50 caracteres." });
        try { return Ok(await _data.Consultar(null, deporte)); }
        catch (ProcedimientoException ex) { return ErrorProcedimiento(ex); }
        catch (SqlException ex) { return ErrorSql(ex); }
    }

    [HttpGet("deportes")]
    public async Task<IActionResult> Deportes()
    {
        try { return Ok(await _data.Deportes()); }
        catch (ProcedimientoException ex) { return ErrorProcedimiento(ex); }
        catch (SqlException ex) { return ErrorSql(ex); }
    }

    [HttpGet("{id:long:min(1)}/foto")]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<IActionResult> Foto(long id)
    {
        try
        {
            byte[]? bytes = await _data.FotoPublica(id);
            if (bytes is null || bytes.Length == 0) return NotFound(new { isSuccess = false, numeroError = 404, respuesta = "No hay fotografía disponible para esta clase." });
            string? tipo = bytes.Length >= 3 && bytes[0] == 0xff && bytes[1] == 0xd8 && bytes[2] == 0xff ? "image/jpeg"
                : bytes.Length >= 8 && bytes.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }) ? "image/png"
                : bytes.Length >= 12 && System.Text.Encoding.ASCII.GetString(bytes, 0, 4) == "RIFF" && System.Text.Encoding.ASCII.GetString(bytes, 8, 4) == "WEBP" ? "image/webp" : null;
            if (tipo is null) return StatusCode(415, new { isSuccess = false, numeroError = 415, respuesta = "El formato de la fotografía no es compatible." });
            Response.Headers["X-Content-Type-Options"] = "nosniff";
            return File(bytes, tipo);
        }
        catch (ProcedimientoException ex) { return ErrorProcedimiento(ex); }
        catch (SqlException ex) { return ErrorSql(ex); }
    }

    private IActionResult ErrorProcedimiento(ProcedimientoException ex)
    {
        if (ex.NumeroError is 51000 or 51003 or 51004 or 51009)
            return StatusCode(ex.NumeroError switch { 51003 => 403, 51004 => 404, 51009 => 409, _ => 400 },
                new { isSuccess = false, numeroError = ex.NumeroError, respuesta = ex.Respuesta });
        _logger.LogError(ex, "El catálogo de clases devolvió el error {NumeroError}.", ex.NumeroError);
        return StatusCode(503, new { isSuccess = false, numeroError = ex.NumeroError, respuesta = "No fue posible cargar las clases. Inténtalo más tarde." });
    }

    private IActionResult ErrorSql(SqlException ex)
    {
        _logger.LogError(ex, "Error al consultar el catálogo de clases.");
        return StatusCode(503, new { isSuccess = false, numeroError = ex.Number, respuesta = "No fue posible cargar las clases. Inténtalo más tarde." });
    }
}
