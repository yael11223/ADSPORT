using ADSPORT.Data;
using ADSPORT.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Buffers.Binary;
using System.Data.SqlClient;

namespace ADSPORT.Controllers;

[ApiController]
[Route("api/Deporte")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class DeporteController : ControllerBase
{
    private const int MaximoImagen = 5 * 1024 * 1024;
    private readonly DeporteData _datos;
    private readonly IAuthorizationService _autorizacion;
    private readonly ILogger<DeporteController> _logger;

    public DeporteController(DeporteData datos, IAuthorizationService autorizacion, ILogger<DeporteController> logger)
    {
        _datos = datos;
        _autorizacion = autorizacion;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> Lista([FromQuery] bool incluirInactivos = false)
    {
        if (incluirInactivos && !await EsAdministrador()) return AccesoDenegado();
        try { return Ok(await _datos.Lista(incluirInactivos)); }
        catch (ProcedimientoException ex) { return ErrorProcedimiento(ex); }
        catch (SqlException ex) { return ErrorSql(ex); }
    }

    [HttpGet("{id:long:min(1)}")]
    public async Task<IActionResult> Obtener(long id)
    {
        try
        {
            var deporte = await _datos.Obtener(id, await EsAdministrador());
            return deporte is null ? NoEncontrado() : Ok(deporte);
        }
        catch (ProcedimientoException ex) { return ErrorProcedimiento(ex); }
        catch (SqlException ex) { return ErrorSql(ex); }
    }

    [HttpPost]
    [Authorize(Policy = "SoloAdministrador")]
    [ValidateAntiForgeryToken]
    public Task<IActionResult> Crear([FromBody] GuardarDeporteSolicitud solicitud) => Guardar(null, solicitud);

    [HttpPut("{id:long:min(1)}")]
    [Authorize(Policy = "SoloAdministrador")]
    [ValidateAntiForgeryToken]
    public Task<IActionResult> Editar(long id, [FromBody] GuardarDeporteSolicitud solicitud) => Guardar(id, solicitud);

    private async Task<IActionResult> Guardar(long? id, GuardarDeporteSolicitud solicitud)
    {
        if (string.IsNullOrWhiteSpace(solicitud.NombreDeporte))
            return BadRequest(Error(51000, "El nombre del deporte es obligatorio."));
        try
        {
            var idDeporte = await _datos.Guardar(id, solicitud);
            return Ok(new { isSuccess = true, numeroError = 0, idDeporte,
                respuesta = id.HasValue ? "Deporte actualizado." : "Deporte registrado." });
        }
        catch (ProcedimientoException ex) { return ErrorProcedimiento(ex); }
        catch (SqlException ex) { return ErrorSql(ex); }
    }

    [HttpDelete("{id:long:min(1)}")]
    [Authorize(Policy = "SoloAdministrador")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Desactivar(long id)
    {
        try
        {
            await _datos.Desactivar(id);
            return Ok(new { isSuccess = true, numeroError = 0, respuesta = "Deporte desactivado. Sus clases y datos se conservan." });
        }
        catch (ProcedimientoException ex) { return ErrorProcedimiento(ex); }
        catch (SqlException ex) { return ErrorSql(ex); }
    }

    [HttpPost("{id:long:min(1)}/imagen")]
    [Authorize(Policy = "SoloAdministrador")]
    [ValidateAntiForgeryToken]
    [RequestSizeLimit(6 * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 6 * 1024 * 1024)]
    public async Task<IActionResult> SubirImagen(long id, [FromForm] IFormFile? archivo)
    {
        if (archivo is null || archivo.Length == 0)
            return BadRequest(Error(51000, "Selecciona una imagen JPEG, PNG o WebP."));
        if (archivo.Length > MaximoImagen)
            return StatusCode(413, Error(413, "La imagen no puede superar 5 MB."));

        await using var buffer = new MemoryStream();
        await archivo.CopyToAsync(buffer, HttpContext.RequestAborted);
        var imagen = buffer.ToArray();
        if (imagen.Length == 0 || imagen.Length > MaximoImagen)
            return StatusCode(413, Error(413, "La imagen debe tener contenido y no superar 5 MB."));
        var tipo = DetectarTipo(imagen);
        if (tipo is null) return BadRequest(Error(51000, "El contenido del archivo no corresponde a una imagen JPEG, PNG o WebP."));
        try
        {
            await _datos.GuardarImagen(id, imagen, tipo);
            return Ok(new { isSuccess = true, numeroError = 0, idDeporte = id, respuesta = "Imagen guardada correctamente.",
                imagenUrl = $"/api/Deporte/{id}/imagen?v={DateTime.UtcNow.Ticks}" });
        }
        catch (ProcedimientoException ex) { return ErrorProcedimiento(ex); }
        catch (SqlException ex) { return ErrorSql(ex); }
    }

    [HttpGet("{id:long:min(1)}/imagen")]
    public async Task<IActionResult> Imagen(long id)
    {
        try
        {
            var imagen = await _datos.ObtenerImagen(id, await EsAdministrador());
            if (!imagen.HasValue) return NoEncontrado();
            var tipoReal = DetectarTipo(imagen.Value.Datos);
            if (tipoReal is null || tipoReal != imagen.Value.Tipo)
                return StatusCode(415, Error(415, "El formato de la imagen no es compatible."));
            Response.Headers["X-Content-Type-Options"] = "nosniff";
            return File(imagen.Value.Datos, tipoReal);
        }
        catch (ProcedimientoException ex) { return ErrorProcedimiento(ex); }
        catch (SqlException ex) { return ErrorSql(ex); }
    }

    private async Task<bool> EsAdministrador() => (await _autorizacion.AuthorizeAsync(User, "SoloAdministrador")).Succeeded;
    private IActionResult AccesoDenegado() => StatusCode(User.Identity?.IsAuthenticated == true ? 403 : 401,
        Error(User.Identity?.IsAuthenticated == true ? 403 : 401, "Esta consulta requiere una sesión administrativa."));
    private IActionResult NoEncontrado() => NotFound(Error(51004, "No se encontró el deporte o su imagen."));
    private static object Error(int numeroError, string respuesta) => new { isSuccess = false, numeroError, respuesta };

    private IActionResult ErrorProcedimiento(ProcedimientoException ex)
    {
        if (ex.NumeroError is 51000 or 51004 or 51009)
            return StatusCode(ex.NumeroError switch { 51004 => 404, 51009 => 409, _ => 400 }, Error(ex.NumeroError, ex.Respuesta));
        _logger.LogError(ex, "El procedimiento de deportes devolvió el error {NumeroError}.", ex.NumeroError);
        return StatusCode(503, Error(ex.NumeroError, "No fue posible consultar o guardar el deporte. Comprueba la conexión y la migración SQL."));
    }

    private IActionResult ErrorSql(SqlException ex)
    {
        _logger.LogError(ex, "Error SQL en el catálogo de deportes.");
        return StatusCode(503, Error(ex.Number, "No fue posible consultar o guardar el deporte. Comprueba la conexión y la migración SQL."));
    }

    private static string? DetectarTipo(ReadOnlySpan<byte> datos)
    {
        if (datos.Length >= 3 && datos[0] == 0xff && datos[1] == 0xd8 && datos[2] == 0xff) return "image/jpeg";
        if (datos.Length >= 8 && datos[..8].SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 })) return "image/png";
        if (datos.Length >= 12 && datos[..4].SequenceEqual("RIFF"u8) && datos.Slice(8, 4).SequenceEqual("WEBP"u8)
            && BinaryPrimitives.ReadUInt32LittleEndian(datos.Slice(4, 4)) == (uint)(datos.Length - 8)) return "image/webp";
        return null;
    }
}
