using ADSPORT.Data;
using ADSPORT.Models;
using ADSPORT.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using System.Security.Claims;

namespace ADSPORT.Controllers;

[ApiController, Route("api/Entrenador/clases"), Authorize(Policy = "SoloEntrenador")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class AsistenciaClaseController(AsistenciaClaseData data, MercadoPagoService mercado) : ControllerBase
{
    private long Entrenador => long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    [HttpGet("{id:long:min(1)}/asistencias")]
    public async Task<IActionResult> Consultar(long id, [FromQuery] DateOnly? inicioSemana)
    {
        var hoy = TiempoClub.Hoy;
        var inicio = inicioSemana ?? hoy.AddDays(-(((int)hoy.DayOfWeek + 6) % 7));
        return Ok(await data.Consultar(Entrenador, id, inicio, mercado.ModoPrueba));
    }
    [HttpPost("{id:long:min(1)}/acceso"), ValidateAntiForgeryToken, EnableRateLimiting("asistencias")]
    public async Task<IActionResult> Escanear(long id, EscanearAccesoClase solicitud) => Ok(await data.Registrar(Entrenador,
        id, solicitud.Fecha!.Value, solicitud.HoraInicio, mercado.ModoPrueba, null, solicitud.CodigoAcceso, true));

    [HttpPut("{id:long:min(1)}/asistencias/{cobro:guid}"), ValidateAntiForgeryToken, EnableRateLimiting("asistencias")]
    public async Task<IActionResult> Marcar(long id, Guid cobro, MarcarAsistenciaClase solicitud) => Ok(await data.Registrar(Entrenador,
        id, solicitud.Fecha!.Value, solicitud.HoraInicio, mercado.ModoPrueba, cobro, null, solicitud.Presente!.Value));
}
