using System.Data;
using System.Data.SqlClient;

namespace ADSPORT.Data;

public sealed class AdministracionData(IConfiguration configuracion)
{
    public async Task<object> Inicio()
    {
        using var db=new SqlConnection(configuracion.GetConnectionString("CadenaSQL"));
        using var cmd=new SqlCommand("ADMIN_INICIO_CONSULTAR",db) { CommandType=CommandType.StoredProcedure };
        var resultado=SqlResultadoProcedimiento.Agregar(cmd); await db.OpenAsync();
        using var r=await cmd.ExecuteReaderAsync();
        object? datos=null;
        if (await r.ReadAsync()) datos=new { usuarios=(int)r["USUARIOS"],entrenadores=(int)r["ENTRENADORES"],
            deportes=(int)r["DEPORTES"],canchas=(int)r["CANCHAS"],clases=(int)r["CLASES"],actualizadoUtc=DateTime.UtcNow };
        await r.CloseAsync(); resultado.Comprobar();
        return datos ?? throw new ProcedimientoException(51004,"No se pudo cargar el resumen.");
    }
}
