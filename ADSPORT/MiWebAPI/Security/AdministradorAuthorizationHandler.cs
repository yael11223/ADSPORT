using ADSPORT.Data;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

namespace ADSPORT.Security;

public sealed class AdministradorRequirement : IAuthorizationRequirement;
public sealed class AdministradorAuthorizationHandler(IEntrenadorCuentaData cuentas,
    ILogger<AdministradorAuthorizationHandler> logger) : AuthorizationHandler<AdministradorRequirement>
{
    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context,AdministradorRequirement requirement)
    {
        if (context.User.Identity?.IsAuthenticated!=true || !context.User.HasClaim("ADSPORT.Administrador","true")
            || !long.TryParse(context.User.FindFirstValue(ClaimTypes.NameIdentifier),out var id) || id<=0) return;
        try { if ((await cuentas.ObtenerAsync(id))?.EsAdministradorActivo==true) context.Succeed(requirement); }
        catch (Exception ex) { logger.LogError(ex,"No se pudo comprobar el acceso administrativo."); context.Fail(); }
    }
}
