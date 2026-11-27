namespace ADSPORT.Services;

public sealed class MercadoPagoOpciones
{
    public bool ModoPrueba { get; set; } = true;
    public string AccessToken { get; set; } = "";
    public string WebhookSecret { get; set; } = "";
    public string UrlPublica { get; set; } = "";
    public string VendedorId { get; set; } = "";
    // Exclusivo de las pruebas de integración locales. Se rechaza fuera de Development.
    public string ApiLocalPruebas { get; set; } = "";

    public bool EstaConfigurado(IHostEnvironment entorno)
    {
        bool local = EsApiLocalValida(entorno);
        if (!string.IsNullOrEmpty(ApiLocalPruebas) && !local) return false;
        if (string.IsNullOrWhiteSpace(AccessToken) || string.IsNullOrWhiteSpace(WebhookSecret)) return false;
        // Checkout Pro con Orders también entrega credenciales APP_USR en el entorno de prueba.
        // El entorno de la orden se comprueba al consultar la respuesta de Mercado Pago.
        if (ModoPrueba && !AccessToken.StartsWith("TEST-", StringComparison.Ordinal)
            && !AccessToken.StartsWith("APP_USR-", StringComparison.Ordinal)) return false;
        if (!ModoPrueba && AccessToken.StartsWith("TEST-", StringComparison.Ordinal)) return false;
        return Uri.TryCreate(UrlPublica, UriKind.Absolute, out var url) && string.IsNullOrEmpty(url.UserInfo)
            && url.AbsolutePath == "/" && string.IsNullOrEmpty(url.Query) && string.IsNullOrEmpty(url.Fragment)
            && (url.Scheme == "https" || entorno.IsDevelopment() && ModoPrueba && url.Scheme == "http" && url.IsLoopback);
    }

    // En local no se envían URLs privadas de retorno al proveedor. La página
    // permanece abierta y consulta el resultado con la API de Orders.
    public static bool EsRetornoLocal(string url, bool prueba) => prueba
        && Uri.TryCreate(url, UriKind.Absolute, out var retorno) && retorno.IsLoopback;

    public bool EsApiLocalValida(IHostEnvironment entorno) => entorno.IsDevelopment() && ModoPrueba
        && Uri.TryCreate(ApiLocalPruebas, UriKind.Absolute, out var url) && url.Scheme == "http" && url.IsLoopback
        && string.IsNullOrEmpty(url.UserInfo) && url.AbsolutePath == "/" && string.IsNullOrEmpty(url.Query) && string.IsNullOrEmpty(url.Fragment);
}

public sealed class PagoProveedorException(string mensaje) : Exception(mensaje);
