using ADSPORT.Data;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

namespace ADSPORT.Security;

public sealed class EntrenadorRequirement(bool permitirAdministrador = false) : IAuthorizationRequirement
{
    public bool PermitirAdministrador { get; } = permitirAdministrador;
}

public sealed class EntrenadorAuthorizationHandler : AuthorizationHandler<EntrenadorRequirement>
{
    private readonly IEntrenadorCuentaData _datos;
    private readonly ILogger<EntrenadorAuthorizationHandler> _logger;

    public EntrenadorAuthorizationHandler(IEntrenadorCuentaData datos,
        ILogger<EntrenadorAuthorizationHandler> logger)
    {
        _datos = datos;
        _logger = logger;
    }

    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context,
        EntrenadorRequirement requirement)
    {
        if (requirement.PermitirAdministrador && context.User.Identity?.IsAuthenticated == true
            && context.User.HasClaim("ADSPORT.Administrador", "true"))
        {
            if (long.TryParse(context.User.FindFirstValue(ClaimTypes.NameIdentifier),out var idAdmin)
                && (await _datos.ObtenerAsync(idAdmin))?.EsAdministradorActivo==true) context.Succeed(requirement);
            return;
        }
        if (context.User.Identity?.IsAuthenticated != true
            || !context.User.IsInRole("ENTRENADOR")
            || context.User.FindFirstValue("ADSPORT.Acceso") is not (null or "ENTRENADOR")
            || !long.TryParse(context.User.FindFirstValue(ClaimTypes.NameIdentifier), out var id)
            || id <= 0) return;

        try
        {
            // No confiar en un rol enviado por el navegador ni en un claim antiguo.
            // Revocar el rol/desactivar la cuenta impide las siguientes operaciones.
            var cuenta = await _datos.ObtenerAsync(id);
            if (cuenta?.EsEntrenadorActivo == true) context.Succeed(requirement);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "No se pudo verificar el permiso de entrenador.");
            context.Fail();
        }
    }
}
