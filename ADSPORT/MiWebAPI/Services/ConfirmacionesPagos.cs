using ADSPORT.Data;
using Microsoft.Extensions.Options;
using System.Data.SqlClient;

namespace ADSPORT.Services;

// Cola persistente: el SMTP no bloquea ni revierte la confirmación del pago.
public sealed class ConfirmacionesPagos(IServiceScopeFactory scopes, ILogger<ConfirmacionesPagos> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                for (int i = 0; i < 10; i++)
                {
                    using var scope = scopes.CreateScope();
                    var config = scope.ServiceProvider.GetRequiredService<IConfiguration>();
                    bool prueba = scope.ServiceProvider.GetRequiredService<IOptions<MercadoPagoOpciones>>().Value.ModoPrueba;
                    using var db = new SqlConnection(config.GetConnectionString("CadenaSQL"));
                    await db.OpenAsync(ct);
                    var lease = Guid.NewGuid();
                    using var claim = new SqlCommand("""
                        UPDATE TOP(1) dbo.PAGO_CONFIRMACION_CORREO WITH(UPDLOCK,READPAST,READCOMMITTEDLOCK)
                        SET LEASE_ID=@lease,LEASE_HASTA_UTC=DATEADD(minute,5,SYSUTCDATETIME()),INTENTOS=INTENTOS+1
                        OUTPUT inserted.ID_COBRO
                        WHERE ENVIADO_UTC IS NULL AND PROXIMO_INTENTO_UTC<=SYSUTCDATETIME()
                            AND (LEASE_HASTA_UTC IS NULL OR LEASE_HASTA_UTC<SYSUTCDATETIME())
                            AND EXISTS(SELECT 1 FROM dbo.PAGO_MERCADOPAGO p JOIN dbo.RESERVA rv ON rv.ID_RESERVA=p.ID_RESERVA
                                JOIN dbo.USUARIO u ON u.ID_USUARIO=rv.ID_USUARIO
                                WHERE p.ID_COBRO=PAGO_CONFIRMACION_CORREO.ID_COBRO AND p.ESTADO='APROBADO'
                                AND rv.ESTATUS_RESERVA='CONFIRMADA' AND p.MODO_PRUEBA=@prueba AND UPPER(LTRIM(RTRIM(u.ESTATUS)))='ACTIVO'
                                AND rv.SEMANA_FIN>=CONVERT(date,SYSDATETIMEOFFSET() AT TIME ZONE 'Central Standard Time (Mexico)'))
                        """, db);
                    claim.Parameters.AddWithValue("@lease", lease); claim.Parameters.AddWithValue("@prueba", prueba);
                    if (await claim.ExecuteScalarAsync(ct) is not Guid cobro) break;
                    bool enviado = false;
                    try
                    {
                        var pago = (await scope.ServiceProvider.GetRequiredService<PagoClaseData>().Consultar(null, cobro, prueba)).Single();
                        if (pago.CodigoAcceso is not null)
                        {
                            await scope.ServiceProvider.GetRequiredService<CorreoService>().EnviarConfirmacionClase(pago, ct);
                            enviado = true;
                        }
                    }
                    catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
                    catch (Exception ex) { logger.LogWarning("No se pudo enviar la confirmación {Cobro}: {Tipo}. Se reintentará.", cobro, ex.GetType().Name); }
                    using var resultado = new SqlCommand("""
                        UPDATE dbo.PAGO_CONFIRMACION_CORREO SET ENVIADO_UTC=CASE WHEN @enviado=1 THEN SYSUTCDATETIME() ELSE ENVIADO_UTC END,
                            PROXIMO_INTENTO_UTC=DATEADD(second,CASE WHEN INTENTOS<6 THEN 30*INTENTOS ELSE 300 END,SYSUTCDATETIME()),
                            LEASE_ID=NULL,LEASE_HASTA_UTC=NULL WHERE ID_COBRO=@cobro AND LEASE_ID=@lease
                        """, db);
                    resultado.Parameters.AddWithValue("@cobro", cobro); resultado.Parameters.AddWithValue("@lease", lease);
                    resultado.Parameters.AddWithValue("@enviado", enviado); await resultado.ExecuteNonQueryAsync(ct);
                }
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogWarning("No se pudo consultar la cola de confirmaciones ({Tipo}). Comprueba la migración 012.", ex.GetType().Name); }
            try { await Task.Delay(TimeSpan.FromSeconds(5), ct); }
            catch (OperationCanceledException) { break; }
        }
    }
}
