using ADSPORT.Data;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

namespace ADSPORT.Security;

public sealed class EntrenadorRequirement : IAuthorizationRequirement { }

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
        if (context.User.Identity?.IsAuthenticated != true
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
