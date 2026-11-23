using ADSPORT.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.ComponentModel.DataAnnotations;

namespace ADSPORT.Controllers;

[ApiController]
[Route("api/Administracion")]
[Authorize(Policy = "SoloAdministrador")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class AdministracionController(CanchaData canchas, ClaseData clases) : ControllerBase
{
    [HttpGet("clases")]
    public async Task<IActionResult> Clases() => Ok(await clases.Consultar(null, administracion: true));

    [HttpDelete("clases/{id:long:min(1)}")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> EliminarClase(long id)
    {
        await clases.Eliminar(id, administracion: true);
        return Ok(new { isSuccess = true, numeroError = 0, respuesta = "Clase eliminada definitivamente. Las reservas y pagos se conservaron." });
    }

    [HttpGet("cronograma")]
    public async Task<IActionResult> Cronograma([FromQuery, Range(1, long.MaxValue)] long? idEntrenador,
        [FromQuery, Range(1, long.MaxValue)] long? idCancha, [FromQuery, Range(1, long.MaxValue)] long? idDeporte,
        [FromQuery] bool incluirNoDisponibles = false) =>
        Ok(await canchas.Cronograma(idEntrenador, idCancha, idDeporte, incluirNoDisponibles));
}
