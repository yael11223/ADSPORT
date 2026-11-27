using ADSPORT.Data;
using ADSPORT.Models;
using Microsoft.Extensions.Options;
using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace ADSPORT.Services;

public sealed class MercadoPagoService(HttpClient http, PagoClaseData data, IOptions<MercadoPagoOpciones> opciones,
    IHostEnvironment entorno, ILogger<MercadoPagoService> logger)
{
    private MercadoPagoOpciones Opciones => opciones.Value;
    public bool Configurado => Opciones.EstaConfigurado(entorno);
    public bool ModoPrueba => Opciones.ModoPrueba;
    public string UrlRetorno => Opciones.UrlPublica.TrimEnd('/') + "/pagos.html";
    public bool RetornoLocal => MercadoPagoOpciones.EsRetornoLocal(UrlRetorno, ModoPrueba);

    public void ExigirConfiguracion()
    {
        if (!Configurado) throw new PagoProveedorException("Los pagos todavía no están configurados. Intenta más tarde o consulta al club.");
    }

    public async Task<PagoClase> Iniciar(PagoClase pago, CancellationToken ct)
    {
        ExigirConfiguracion();
        if (pago.OrdenId is not null) return await Actualizar(pago, ct);
        if (pago.Estado != "CREANDO") return pago;
        if (pago.IdClase is null || DateTime.UtcNow >= pago.CreadoUtc.AddSeconds(pago.VigenciaSegundos))
            throw new ProcedimientoException(51009, "El inicio del pago venció o la clase fue eliminada. Vuelve a elegir una semana desde el catálogo.");
        string importe = pago.Importe.ToString("0.00", CultureInfo.InvariantCulture);
        string retorno = pago.UrlRetorno + "?cobro=" + pago.IdCobro.ToString("N");
        var online = new Dictionary<string, object>();
        // El modo de cada intento queda determinado por la URL guardada en SQL,
        // para conservar el mismo cuerpo al reintentar su clave de idempotencia.
        if (!MercadoPagoOpciones.EsRetornoLocal(pago.UrlRetorno, pago.ModoPrueba))
        {
            online["success_url"] = retorno; online["failure_url"] = retorno;
            online["pending_url"] = retorno; online["auto_return"] = "all";
        }
        online["retries"] = new { allowed = false };
        // Todos los campos provienen de la instantánea SQL. La misma referencia es la clave de idempotencia.
        var contenido = new {
            type = "online", processing_mode = "manual", capture_mode = "automatic_async",
            total_amount = importe, external_reference = pago.IdCobro.ToString("N"),
            expiration_time = $"PT{pago.VigenciaSegundos}S", payer = new { email = pago.Correo },
            items = new[] { new { title = pago.NombreClase,
                description = $"Semana {pago.InicioSemana:yyyy-MM-dd} a {pago.FinSemana:yyyy-MM-dd}", unit_price = importe, quantity = 1 } },
            config = new { online }
        };
        using var solicitud = Solicitud(HttpMethod.Post, "v1/orders");
        solicitud.Headers.Add("X-Idempotency-Key", pago.IdCobro.ToString("D"));
        solicitud.Content = new StringContent(JsonSerializer.Serialize(contenido), Encoding.UTF8, "application/json");
        using var respuesta = await Enviar(solicitud, ct);
        await Aplicar(pago, respuesta.RootElement);
        return (await data.Consultar(null, pago.IdCobro, ModoPrueba)).Single();
    }

    public async Task<PagoClase> Actualizar(PagoClase pago, CancellationToken ct)
    {
        ExigirConfiguracion();
        if (pago.OrdenId is null) return pago.Estado == "CREANDO" ? await Iniciar(pago, ct) : pago;
        using var orden = await ObtenerOrden(pago.OrdenId, ct);
        await Aplicar(pago, orden.RootElement);
        return (await data.Consultar(null, pago.IdCobro, ModoPrueba)).Single();
    }

    public async Task Notificar(string idOrden, CancellationToken ct)
    {
        ExigirConfiguracion();
        using var orden = await ObtenerOrden(idOrden, ct);
        string referencia = Campo(orden.RootElement, "external_reference");
        if (!Guid.TryParseExact(referencia, "N", out var cobro)) return;
        var pago = (await data.Consultar(null, cobro, ModoPrueba)).SingleOrDefault();
        if (pago is null) return; // La cuenta puede recibir órdenes de otros sistemas.
        await Aplicar(pago, orden.RootElement);
    }

    public static bool IdOrdenValido(string id) => id.Length <= 64 && Regex.IsMatch(id, @"^ORD[A-Za-z0-9]{8,61}$", RegexOptions.CultureInvariant);

    private async Task<JsonDocument> ObtenerOrden(string id, CancellationToken ct)
    {
        if (!IdOrdenValido(id)) throw new PagoProveedorException("El identificador de la orden no es válido.");
        using var solicitud = Solicitud(HttpMethod.Get, "v1/orders/" + Uri.EscapeDataString(id));
        var orden = await Enviar(solicitud, ct);
        if (Campo(orden.RootElement, "id") != id) { orden.Dispose(); throw new PagoProveedorException("No se pudo verificar la orden de pago."); }
        return orden;
    }

    private HttpRequestMessage Solicitud(HttpMethod metodo, string ruta)
    {
        string raiz = Opciones.EsApiLocalValida(entorno) ? Opciones.ApiLocalPruebas : "https://api.mercadopago.com/";
        var solicitud = new HttpRequestMessage(metodo, raiz.TrimEnd('/') + "/" + ruta);
        solicitud.Headers.Authorization = new AuthenticationHeaderValue("Bearer", Opciones.AccessToken);
        solicitud.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        return solicitud;
    }

    private async Task<JsonDocument> Enviar(HttpRequestMessage solicitud, CancellationToken ct)
    {
        try
        {
            using var respuesta = await http.SendAsync(solicitud, ct);
            if (!respuesta.IsSuccessStatusCode)
            {
                logger.LogWarning("Mercado Pago devolvió HTTP {Status}. No se registró una aprobación local.", (int)respuesta.StatusCode);
                throw new PagoProveedorException("Mercado Pago no pudo completar la solicitud. Reintenta desde Mis pagos; se conservará la misma referencia.");
            }
            return JsonDocument.Parse(await respuesta.Content.ReadAsStringAsync(ct));
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or JsonException)
        {
            logger.LogWarning("Falló la comunicación de pagos: {Tipo}, causa {Causa}.", ex.GetType().Name, ex.InnerException?.GetType().Name ?? "sin detalle");
            throw new PagoProveedorException("No se pudo comprobar la respuesta de Mercado Pago. Reintenta desde Mis pagos antes de iniciar otro pago.");
        }
    }

    private async Task Aplicar(PagoClase pago, JsonElement orden)
    {
        string id = Campo(orden, "id"), referencia = Campo(orden, "external_reference");
        decimal total = Importe(orden, "total_amount"), pagado = ImportePagado(orden);
        bool ordenPrueba = id.StartsWith("ORDTST", StringComparison.Ordinal);
        if (!IdOrdenValido(id) || referencia != pago.IdCobro.ToString("N") || total != pago.Importe
            || Campo(orden, "currency") != "MXN" || Campo(orden, "country_code") != "MEX"
            || ordenPrueba != pago.ModoPrueba || pago.ModoPrueba != ModoPrueba
            || Campo(orden, "type") != "online" || Campo(orden, "processing_mode") != "manual"
            || pago.OrdenId is not null && pago.OrdenId != id
            || orden.TryGetProperty("live_mode", out var vivo) && (vivo.ValueKind is not (JsonValueKind.True or JsonValueKind.False) || vivo.GetBoolean() == ModoPrueba)
            || !string.IsNullOrWhiteSpace(Opciones.VendedorId) && Campo(orden, "user_id") != Opciones.VendedorId)
        {
            logger.LogWarning("Se rechazó una respuesta incompatible con el cobro {Cobro}.", pago.IdCobro);
            throw new PagoProveedorException("La orden recibida no coincide con el pago registrado. Consulta al club.");
        }
        string estadoMp = Campo(orden, "status"), detalle = Campo(orden, "status_detail");
        if (estadoMp.Length > 32 || detalle.Length > 100) throw new PagoProveedorException("No se pudo reconocer el estado del pago.");
        string estado = (estadoMp, detalle) switch {
            ("processed", "accredited") when pagado == total => "APROBADO",
            ("processed", "partially_refunded") => "REEMBOLSO_PARCIAL",
            ("refunded", "refunded") => "REEMBOLSADO",
            ("failed", _) => "RECHAZADO", ("canceled", _) => "CANCELADO",
            ("created", _) or ("processing", _) or ("action_required", _) => "PENDIENTE",
            _ => "EN_REVISION"
        };
        string fecha = Regex.Replace(Campo(orden, "last_updated_date"), @"(\.\d{7})\d+(?=Z|[+-]\d{2}:\d{2})", "$1");
        if (!DateTimeOffset.TryParse(fecha, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var actualizacion))
            throw new PagoProveedorException("Mercado Pago no devolvió la fecha de actualización de la orden.");
        string? url = Campo(orden, "checkout_url") is { Length: > 0 } enlace ? enlace : null;
        if (url is not null && !UrlCheckoutValida(url)) throw new PagoProveedorException("Mercado Pago devolvió un enlace de pago no válido para México.");
        await data.Sincronizar(pago.IdCobro, id, estado, estadoMp, detalle, pagado, actualizacion.UtcDateTime, url);
    }

    public static bool UrlCheckoutValida(string enlace) => enlace.Length <= 2048
        && Uri.TryCreate(enlace, UriKind.Absolute, out var url) && url.Scheme == "https" && url.IsDefaultPort
        && string.IsNullOrEmpty(url.UserInfo) && url.Host is "www.mercadopago.com.mx" or "mercadopago.com.mx"
        && url.AbsolutePath.StartsWith("/checkout/", StringComparison.Ordinal);

    private static string Campo(JsonElement json, string campo) => json.TryGetProperty(campo, out var valor) ? valor.ToString() : "";
    private static decimal ImportePagado(JsonElement orden)
    {
        // Una orden recién creada puede omitir el total pagado o devolver null antes del checkout.
        // En los demás estados se exige el importe: su ausencia nunca permite aprobar un pago.
        if (Campo(orden, "status") == "created"
            && (!orden.TryGetProperty("total_paid_amount", out var pagado) || pagado.ValueKind == JsonValueKind.Null))
            return 0m;
        return Importe(orden, "total_paid_amount");
    }

    private static decimal Importe(JsonElement json, string campo)
    {
        if (!decimal.TryParse(Campo(json, campo), NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out var valor)
            || valor < 0 || valor > 99999999.99m || decimal.Round(valor, 2) != valor)
            throw new PagoProveedorException("Mercado Pago devolvió un importe no válido.");
        return valor;
    }
}
