using ADSPORT.Data;
using ADSPORT.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Data.SqlClient;
using System.Security.Claims;

namespace ADSPORT.Controllers;

[ApiController]
[Route("api/Entrenador/clases")]
[Authorize(Policy = "SoloEntrenador")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class EntrenadorClasesController : ControllerBase
{
    private readonly ClaseData _data;
    private readonly ILogger<EntrenadorClasesController> _logger;

    public EntrenadorClasesController(ClaseData data, ILogger<EntrenadorClasesController> logger)
    {
        _data = data;
        _logger = logger;
    }

    private long IdEntrenador => long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> Consultar()
    {
        try { return Ok(await _data.Consultar(IdEntrenador)); }
        catch (ProcedimientoException ex) { return ErrorProcedimiento(ex); }
        catch (SqlException ex) { return ErrorSql(ex); }
    }

    [HttpPost]
    [ValidateAntiForgeryToken]
    public Task<IActionResult> Crear([FromBody] GuardarClaseSolicitud solicitud) => Guardar(null, solicitud);

    [HttpPut("{id:long:min(1)}")]
    [ValidateAntiForgeryToken]
    public Task<IActionResult> Actualizar(long id, [FromBody] GuardarClaseSolicitud solicitud) => Guardar(id, solicitud);

    private async Task<IActionResult> Guardar(long? id, GuardarClaseSolicitud solicitud)
    {
        try
        {
            var idClase = await _data.Guardar(IdEntrenador, id, solicitud);
            return Ok(new { isSuccess = true, numeroError = 0, idClase, respuesta = id.HasValue ? "Clase actualizada." : "Clase creada." });
        }
        catch (ProcedimientoException ex) { return ErrorProcedimiento(ex); }
        catch (SqlException ex) { return ErrorSql(ex); }
    }

    [HttpPut("{id:long:min(1)}/disponibilidad")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Disponibilidad(long id, [FromBody] DisponibilidadClaseSolicitud solicitud)
    {
        try
        {
            await _data.CambiarDisponibilidad(IdEntrenador, id, solicitud.Disponible!.Value);
            return Ok(new { isSuccess = true, numeroError = 0, respuesta = solicitud.Disponible.Value ? "Clase publicada." : "Clase desactivada." });
        }
        catch (ProcedimientoException ex) { return ErrorProcedimiento(ex); }
        catch (SqlException ex) { return ErrorSql(ex); }
    }

    private IActionResult ErrorProcedimiento(ProcedimientoException ex)
    {
        if (ex.NumeroError is 51000 or 51003 or 51004 or 51009)
            return StatusCode(ex.NumeroError switch { 51003 => 403, 51004 => 404, 51009 => 409, _ => 400 },
                new { isSuccess = false, numeroError = ex.NumeroError, respuesta = ex.Respuesta });
        _logger.LogError(ex, "El procedimiento de clases devolvió el error {NumeroError}.", ex.NumeroError);
        return StatusCode(503, new { isSuccess = false, numeroError = ex.NumeroError,
            respuesta = "No fue posible consultar o guardar las clases. Comprueba la conexión y la migración SQL." });
    }

    private IActionResult ErrorSql(SqlException ex)
    {
        // Only deliberately raised business errors are safe to expose.
        if (ex.Number is 51000 or 51003 or 51004 or 51009)
            return StatusCode(ex.Number switch { 51003 => 403, 51004 => 404, 51009 => 409, _ => 400 },
                new { isSuccess = false, numeroError = ex.Number, respuesta = ex.Message });
        _logger.LogError(ex, "Error SQL al administrar clases del entrenador.");
        return StatusCode(503, new { isSuccess = false, numeroError = ex.Number, respuesta = "No fue posible consultar o guardar las clases. Comprueba la conexión y la migración SQL." });
    }
}
