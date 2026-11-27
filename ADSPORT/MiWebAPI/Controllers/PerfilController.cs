using ADSPORT.Data;
using ADSPORT.Models;
using ADSPORT.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ADSPORT.Controllers;

[ApiController,Route("api/Perfil"),Authorize]
[ResponseCache(NoStore=true,Location=ResponseCacheLocation.None)]
public sealed class PerfilController(PerfilData perfiles) : ControllerBase
{
    private long Id => long.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier),out var id) && id>0 ? id
        : throw new ProcedimientoException(51003,"Inicia sesión con una cuenta de la base de datos.");
    [HttpGet] public async Task<IActionResult> Consultar() => Ok(await perfiles.Obtener(Id));
    [HttpPut,ValidateAntiForgeryToken,RequestSizeLimit(12*1024*1024)]
    [RequestFormLimits(MultipartBodyLengthLimit=12*1024*1024)]
    public async Task<IActionResult> Guardar([FromForm] GuardarPerfilPropio solicitud) => Ok(await perfiles.Guardar(Id,solicitud));
    [HttpGet("foto")] public Task<IActionResult> Foto() => Imagen(false);
    [HttpGet("fondo")] public Task<IActionResult> Fondo() => Imagen(true);
    private async Task<IActionResult> Imagen(bool fondo)
    {
        var datos=await perfiles.Imagen(Id,fondo);
        if (datos is null || datos.Length==0) return NotFound();
        var tipo=ImagenPerfil.Tipo(datos);
        if (tipo is null) return StatusCode(415);
        Response.Headers["X-Content-Type-Options"]="nosniff";
        return File(datos,tipo);
    }
}
