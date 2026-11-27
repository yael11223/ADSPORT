using Microsoft.AspNetCore.DataProtection;
using System.Globalization;
using System.Security.Cryptography;

namespace ADSPORT.Security;

// La autorización solo viaja en una cookie protegida del navegador que verificó el código.
public sealed class RegistroVerificado(IDataProtectionProvider provider, IWebHostEnvironment environment)
{
    private const string Cookie = "ADSPORT.RegistroVerificado";
    private readonly ITimeLimitedDataProtector protector = provider.CreateProtector("ADSPORT.RegistroVerificado.v1")
        .ToTimeLimitedDataProtector();

    private CookieOptions Opciones() => new()
    {
        HttpOnly = true, Secure = !environment.IsDevelopment(), SameSite = SameSiteMode.Strict,
        Path = "/api/Verificacion", IsEssential = true
    };

    public void Guardar(HttpResponse response, string correo, long idCodigo)
    {
        var opciones = Opciones();
        opciones.MaxAge = TimeSpan.FromMinutes(10);
        response.Cookies.Append(Cookie, protector.Protect(idCodigo.ToString(CultureInfo.InvariantCulture) + "\n" + correo,
            TimeSpan.FromMinutes(10)), opciones);
    }

    public long? Leer(HttpRequest request, string correo)
    {
        if (!request.Cookies.TryGetValue(Cookie, out var token)) return null;
        try
        {
            var partes = protector.Unprotect(token, out _).Split('\n', 2);
            return partes.Length == 2 && string.Equals(partes[1], correo, StringComparison.OrdinalIgnoreCase)
                && long.TryParse(partes[0], NumberStyles.None, CultureInfo.InvariantCulture, out var id) && id > 0 ? id : null;
        }
        catch (CryptographicException) { return null; }
    }

    public void Borrar(HttpResponse response) => response.Cookies.Delete(Cookie, Opciones());
}
