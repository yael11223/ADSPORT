using ADSPORT.Models;
using System.Data;
using System.Data.SqlClient;
using System.Text.Json;

namespace ADSPORT.Data;

public sealed class ClaseData
{
    private readonly string _cadenaSql;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public ClaseData(IConfiguration configuration)
    {
        _cadenaSql = configuration.GetConnectionString("CadenaSQL")
            ?? throw new InvalidOperationException("Falta configurar CadenaSQL.");
    }

    public async Task<List<ClaseDeportiva>> Consultar(long? idEntrenador, string? deporte = null, long? idDeporte = null)
    {
        using var conexion = new SqlConnection(_cadenaSql);
        using var comando = new SqlCommand("ENTRENADOR_CLASES_CONSULTAR", conexion) { CommandType = CommandType.StoredProcedure };
        comando.Parameters.Add("@IdEntrenador", SqlDbType.BigInt).Value = (object?)idEntrenador ?? DBNull.Value;
        comando.Parameters.Add("@Deporte", SqlDbType.NVarChar, 50).Value = idDeporte.HasValue || string.IsNullOrWhiteSpace(deporte) ? DBNull.Value : deporte.Trim();
        comando.Parameters.Add("@IdDeporte", SqlDbType.BigInt).Value = (object?)idDeporte ?? DBNull.Value;
        var resultado = SqlResultadoProcedimiento.Agregar(comando);
        await conexion.OpenAsync();
        using var reader = await comando.ExecuteReaderAsync();
        var clases = new Dictionary<long, ClaseDeportiva>();
        while (await reader.ReadAsync())
        {
            var clase = new ClaseDeportiva
            {
                IdClase = Convert.ToInt64(reader["ID_CLASE"]),
                IdDeporte = reader["ID_DEPORTE"] is DBNull ? 0 : Convert.ToInt64(reader["ID_DEPORTE"]),
                NombreDeporte = reader["NOMBRE_DEPORTE"].ToString() ?? "Sin disciplina",
                DeporteActivo = Convert.ToBoolean(reader["DEPORTE_ACTIVO"]),
                NombreClase = reader["NOMBRE_CLASE"].ToString() ?? string.Empty,
                Descripcion = reader["DESCRIPCION"].ToString() ?? string.Empty,
                Precio = reader["PRECIO"] is DBNull ? null : Convert.ToDecimal(reader["PRECIO"]),
                CupoMaximo = reader["CUPO_MAXIMO"] is DBNull ? null : Convert.ToInt32(reader["CUPO_MAXIMO"]),
                Disponible = Convert.ToBoolean(reader["DISPONIBLE"]),
                Ubicacion = reader["UBICACION"] is DBNull ? null : reader["UBICACION"].ToString(),
                AlumnosInscritos = Convert.ToInt32(reader["ALUMNOS_INSCRITOS"]),
                EntrenadorNombre = reader["ENTRENADOR_NOMBRE"].ToString() ?? string.Empty
            };
            clase.CuposDisponibles = clase.CupoMaximo.HasValue ? Math.Max(0, clase.CupoMaximo.Value - clase.AlumnosInscritos) : null;
            if (Convert.ToBoolean(reader["TIENE_FOTO"]))
                clase.FotoUrl = idEntrenador.HasValue ? "/api/Entrenador/foto" : $"/api/Clases/{clase.IdClase}/foto";
            clases.Add(clase.IdClase, clase);
        }
        if (await reader.NextResultAsync())
        {
            while (await reader.ReadAsync())
                if (clases.TryGetValue(Convert.ToInt64(reader["ID_CLASE"]), out var clase))
                    clase.Horarios.Add(new HorarioClase
                    {
                        DiaSemana = Convert.ToInt32(reader["DIA_ISO"]),
                        HoraInicio = ((TimeSpan)reader["HORA_INICIO"]).ToString(@"hh\:mm"),
                        HoraFin = ((TimeSpan)reader["HORA_FIN"]).ToString(@"hh\:mm")
                    });
        }
        // ADO.NET entrega los parámetros OUTPUT únicamente después de cerrar el lector.
        await reader.CloseAsync();
        resultado.Comprobar();
        return clases.Values.ToList();
    }

    public async Task<List<DeporteClase>> Deportes()
    {
        using var conexion = new SqlConnection(_cadenaSql);
        using var comando = new SqlCommand("DEPORTE_LISTAR", conexion) { CommandType = CommandType.StoredProcedure };
        var resultado = SqlResultadoProcedimiento.Agregar(comando);
        await conexion.OpenAsync();
        using var reader = await comando.ExecuteReaderAsync();
        var lista = new List<DeporteClase>();
        while (await reader.ReadAsync())
            lista.Add(new DeporteClase(Convert.ToInt64(reader["ID_DEPORTE"]), reader["NOMBRE_DEPORTE"].ToString() ?? string.Empty));
        await reader.CloseAsync();
        resultado.Comprobar();
        return lista;
    }

    public async Task<long> Guardar(long idEntrenador, long? idClase, GuardarClaseSolicitud solicitud)
    {
        using var conexion = new SqlConnection(_cadenaSql);
        using var comando = new SqlCommand("ENTRENADOR_CLASE_GUARDAR", conexion) { CommandType = CommandType.StoredProcedure };
        comando.Parameters.Add("@IdEntrenador", SqlDbType.BigInt).Value = idEntrenador;
        comando.Parameters.Add("@IdClase", SqlDbType.BigInt).Value = (object?)idClase ?? DBNull.Value;
        comando.Parameters.Add("@IdDeporte", SqlDbType.BigInt).Value = solicitud.IdDeporte;
        comando.Parameters.Add("@NombreClase", SqlDbType.NVarChar, 100).Value = solicitud.NombreClase.Trim();
        comando.Parameters.Add("@Descripcion", SqlDbType.NVarChar, 2000).Value = solicitud.Descripcion.Trim();
        var precio = comando.Parameters.Add("@Precio", SqlDbType.Decimal);
        precio.Precision = 10;
        precio.Scale = 2;
        precio.Value = solicitud.Precio;
        comando.Parameters.Add("@CupoMaximo", SqlDbType.Int).Value = solicitud.CupoMaximo;
        comando.Parameters.Add("@Disponible", SqlDbType.Bit).Value = solicitud.Disponible;
        comando.Parameters.Add("@Ubicacion", SqlDbType.NVarChar, 100).Value = string.IsNullOrWhiteSpace(solicitud.Ubicacion) ? DBNull.Value : solicitud.Ubicacion.Trim();
        comando.Parameters.Add("@Horarios", SqlDbType.NVarChar, -1).Value = JsonSerializer.Serialize(solicitud.Horarios, JsonOptions);
        var resultado = SqlResultadoProcedimiento.Agregar(comando);
        await conexion.OpenAsync();
        var idGuardado = await comando.ExecuteScalarAsync();
        resultado.Comprobar();
        return Convert.ToInt64(idGuardado);
    }

    public async Task CambiarDisponibilidad(long idEntrenador, long idClase, bool disponible)
    {
        using var conexion = new SqlConnection(_cadenaSql);
        using var comando = new SqlCommand("ENTRENADOR_CLASE_DISPONIBILIDAD", conexion) { CommandType = CommandType.StoredProcedure };
        comando.Parameters.Add("@IdEntrenador", SqlDbType.BigInt).Value = idEntrenador;
        comando.Parameters.Add("@IdClase", SqlDbType.BigInt).Value = idClase;
        comando.Parameters.Add("@Disponible", SqlDbType.Bit).Value = disponible;
        var resultado = SqlResultadoProcedimiento.Agregar(comando);
        await conexion.OpenAsync();
        await comando.ExecuteNonQueryAsync();
        resultado.Comprobar();
    }

    public async Task<byte[]?> FotoPublica(long idClase)
    {
        using var conexion = new SqlConnection(_cadenaSql);
        using var comando = new SqlCommand("CLASE_FOTO_PUBLICA", conexion) { CommandType = CommandType.StoredProcedure };
        comando.Parameters.Add("@IdClase", SqlDbType.BigInt).Value = idClase;
        var resultado = SqlResultadoProcedimiento.Agregar(comando);
        await conexion.OpenAsync();
        var foto = await comando.ExecuteScalarAsync() as byte[];
        resultado.Comprobar();
        return foto;
    }
}
