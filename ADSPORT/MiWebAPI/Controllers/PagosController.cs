using ADSPORT.Data;
using ADSPORT.Models;
using ADSPORT.Security;
using ADSPORT.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using System.Security.Claims;

namespace ADSPORT.Controllers;

[ApiController, Route("api/Pagos"), Authorize]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class PagosController(PagoClaseData data, MercadoPagoService mercado, IOptions<MercadoPagoOpciones> opciones,
    IEntrenadorCuentaData cuentas) : ControllerBase
{
    private async Task<long> UsuarioId()
    {
        if (!long.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) || id <= 0
            || User.IsInRole("ENTRENADOR") || User.FindFirstValue("ADSPORT.Acceso") is not (null or "USUARIO")
            || (await cuentas.ObtenerAsync(id))?.EsUsuarioActivo != true)
            throw new ProcedimientoException(51003, "Inicia sesión desde el acceso de usuarios para pagar tus clases.");
        return id;
    }

    [HttpGet("estado"), AllowAnonymous]
    public IActionResult Estado() => Ok(new {
        habilitado = mercado.Configurado, modoPrueba = mercado.ModoPrueba, retornoLocal = mercado.RetornoLocal,
        mensaje = mercado.Configurado ? "" : "El club todavía no ha habilitado los pagos con Mercado Pago. Intenta más tarde o consulta al club."
    });

    [HttpGet("politicas"), AllowAnonymous]
    public IActionResult Politicas() => Ok(new { version = PoliticasClase.Version, tasaIva = PoliticasClase.TasaIva, apartados = PoliticasClase.Apartados });

    [HttpGet("clases/{id:long:min(1)}/semanas"), AllowAnonymous]
    public async Task<IActionResult> Semanas(long id) => Ok(new {
        habilitado = mercado.Configurado, modoPrueba = mercado.ModoPrueba, retornoLocal = mercado.RetornoLocal, moneda = "MXN",
        mensaje = mercado.Configurado ? "" : "El club todavía no ha habilitado los pagos con Mercado Pago. Intenta más tarde o consulta al club.",
        versionPoliticas = PoliticasClase.Version,
        semanas = await data.Cotizar(id, mercado.ModoPrueba)
    });

    [HttpGet]
    public async Task<IActionResult> Consultar() => Ok(await data.Consultar(await UsuarioId(), null, mercado.ModoPrueba));

    [HttpGet("{cobro:guid}")]
    public async Task<IActionResult> ConsultarUno(Guid cobro) => Ok(await Propio(cobro));

    [HttpGet("{cobro:guid}/acceso/qr")]
    public async Task<IActionResult> Qr(Guid cobro)
    {
        var pago = await Propio(cobro);
        if (pago.CodigoAcceso is null) return Conflict(new { respuesta = "El acceso no está disponible: comprueba la aprobación, la clase y la vigencia de tu semana." });
        return File(QrAccesoClase.Generar(pago.CodigoAcceso), "image/png");
    }

    [HttpPost, ValidateAntiForgeryToken, EnableRateLimiting("pagos")]
    public async Task<IActionResult> Crear(CrearPagoClase solicitud, CancellationToken ct)
    {
        long usuario = await UsuarioId();
        if (!solicitud.AceptaPoliticas || solicitud.VersionPoliticas != PoliticasClase.Version)
            return BadRequest(new { respuesta = "Lee y acepta las políticas vigentes antes de pagar." });
        if (decimal.Round(solicitud.PrecioEsperado!.Value, 2) != solicitud.PrecioEsperado.Value
            || decimal.Round(solicitud.TotalEsperado!.Value, 2) != solicitud.TotalEsperado.Value)
            return BadRequest(new { respuesta = "El precio admite hasta dos decimales." });
        mercado.ExigirConfiguracion();
        var pago = await data.Preparar(usuario, solicitud, mercado.ModoPrueba, mercado.UrlRetorno);
        return Ok(await mercado.Iniciar(pago, ct));
    }

    [HttpPost("{cobro:guid}/actualizar"), ValidateAntiForgeryToken, EnableRateLimiting("pagos")]
    public async Task<IActionResult> Actualizar(Guid cobro, CancellationToken ct) => Ok(await mercado.Actualizar(await Propio(cobro), ct));

    [HttpPost("mercadopago/webhook"), AllowAnonymous, RequestSizeLimit(65536)]
    public async Task<IActionResult> Webhook(CancellationToken ct)
    {
        if (!mercado.Configurado) return StatusCode(503);
        if (Request.Query["type"].Count != 1 || Request.Query["type"] != "order") return BadRequest();
        if (Request.Query["data.id"].Count != 1) return Unauthorized();
        string id = Request.Query["data.id"].ToString();
        if (!MercadoPagoService.IdOrdenValido(id) || !FirmaMercadoPago.Validar(Request.Headers["x-signature"],
            Request.Headers["x-request-id"], id, opciones.Value.WebhookSecret)) return Unauthorized();
        // El cuerpo no determina estado, importe ni usuario. Se consulta la API oficial con el id firmado.
        await mercado.Notificar(id, ct);
        return Ok(new { recibido = true });
    }

    private async Task<PagoClase> Propio(Guid cobro) => (await data.Consultar(await UsuarioId(), cobro, mercado.ModoPrueba)).SingleOrDefault()
        ?? throw new ProcedimientoException(51004, "No se encontró el pago en tu cuenta.");
}
