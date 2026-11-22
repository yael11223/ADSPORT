using ADSPORT.Data;
using System.Threading.Channels;

namespace ADSPORT.Services;

// El envío se procesa fuera de la respuesta HTTP para no revelar cuentas por el tiempo del SMTP.
public sealed class ColaCorreoRecuperacion(IServiceScopeFactory scopes, ILogger<ColaCorreoRecuperacion> logger) : BackgroundService
{
    private sealed record Envio(string Correo, string? Codigo, long? IdCodigo);
    private readonly Channel<Envio> pendientes = Channel.CreateBounded<Envio>(new BoundedChannelOptions(100)
    {
        SingleReader = true, FullMode = BoundedChannelFullMode.Wait
    });

    public bool Agregar(string correo, string codigo, long idCodigo) => pendientes.Writer.TryWrite(new(correo, codigo, idCodigo));
    public void NotificarCambio(string correo)
    {
        if (!pendientes.Writer.TryWrite(new(correo, null, null)))
            logger.LogWarning("La cola de notificaciones de contraseña está llena.");
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var envio in pendientes.Reader.ReadAllAsync(stoppingToken))
        {
            using var scope = scopes.CreateScope();
            try
            {
                var correo = scope.ServiceProvider.GetRequiredService<CorreoService>();
                if (envio.Codigo is null) await correo.NotificarPasswordRestablecida(envio.Correo, stoppingToken);
                else await correo.EnviarCodigoRecuperacion(envio.Correo, envio.Codigo, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex)
            {
                logger.LogError(ex, "No fue posible enviar un correo de recuperación de contraseña.");
                if (envio.IdCodigo.HasValue)
                {
                    try { await scope.ServiceProvider.GetRequiredService<RecuperacionPasswordData>().InvalidarEnvio(envio.IdCodigo.Value); }
                    catch (Exception error) { logger.LogError(error, "No fue posible invalidar el código cuyo envío falló."); }
                }
            }
        }
    }
}
