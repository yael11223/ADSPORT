using ADSPORT.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ADSPORT.Controllers;

[ApiController]
[Route("api/Instalaciones")]
[AllowAnonymous]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class InstalacionesController(CanchaData canchas) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Lista() => Ok((await canchas.Listar(false)).Select(c => new
    {
        c.IdCancha, c.Nombre, c.IdDeporte, c.NombreDeporte, c.Ubicacion, c.ImagenUrl,
        horarios = c.Horarios.Select(h => new { h.DiaSemana, h.HoraInicio, h.HoraFin })
    }));
}
