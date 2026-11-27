using ADSPORT.Data;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using System.Globalization;
using System.Security.Claims;

namespace ADSPORT.Security;

public static class SesionRecuperacionPassword
{
    public const string ClaimInicio = "ADSPORT.InicioSesion";

    public static Claim CrearClaim(DateTime inicio) => new(ClaimInicio, inicio.Ticks.ToString(CultureInfo.InvariantCulture));

    public static async Task Validar(CookieValidatePrincipalContext context)
    {
        if (!long.TryParse(context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier), out var id) || id<=0)
        {
            context.RejectPrincipal();
            await context.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return;
        }
        var inicio = context.Properties.IssuedUtc?.UtcDateTime ?? DateTime.MinValue;
        if (long.TryParse(context.Principal?.FindFirstValue(ClaimInicio), out var ticks)
            && ticks >= DateTime.MinValue.Ticks && ticks <= DateTime.MaxValue.Ticks)
            inicio = new DateTime(ticks, DateTimeKind.Utc);
        try
        {
            var datos = context.HttpContext.RequestServices.GetRequiredService<RecuperacionPasswordData>();
            if (!await datos.SesionRevocada(id, inicio)) return;
        }
        catch (Exception ex)
        {
            context.HttpContext.RequestServices.GetRequiredService<ILoggerFactory>()
                .CreateLogger("SesionRecuperacionPassword").LogError(ex, "No fue posible comprobar la vigencia de la sesión.");
        }
        context.RejectPrincipal();
        await context.HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    }
}
