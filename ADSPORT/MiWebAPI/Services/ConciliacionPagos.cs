using ADSPORT.Data;

namespace ADSPORT.Services;

// Recupera pagos pendientes si la notificación no llegó. Nunca aprueba basándose en el navegador.
public sealed class ConciliacionPagos(IServiceScopeFactory scopes, ILogger<ConciliacionPagos> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var reloj = new PeriodicTimer(TimeSpan.FromMinutes(2));
        try
        {
            while (await reloj.WaitForNextTickAsync(stoppingToken))
            {
                using var scope = scopes.CreateScope();
                var servicio = scope.ServiceProvider.GetRequiredService<MercadoPagoService>();
                if (!servicio.Configurado) continue;
                try
                {
                    var data = scope.ServiceProvider.GetRequiredService<PagoClaseData>();
                    foreach (var (cobro, orden) in await data.Pendientes(servicio.ModoPrueba))
                    {
                        if (stoppingToken.IsCancellationRequested) return;
                        try { await servicio.Notificar(orden, stoppingToken); }
                        catch (Exception) when (!stoppingToken.IsCancellationRequested)
                        { logger.LogWarning("No se pudo conciliar el cobro {Cobro}; se reintentará.", cobro); }
                    }
                }
                catch (Exception) when (!stoppingToken.IsCancellationRequested)
                { logger.LogWarning("No se pudo consultar la cola de pagos. Comprueba la migración 011 y la configuración SQL."); }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
    }
}
