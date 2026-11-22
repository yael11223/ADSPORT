using ADSPORT.Models;
using ADSPORT.Services;
using System.Data;
using System.Data.SqlClient;
using System.Text.Json;

namespace ADSPORT.Data;

public sealed class CanchaData(IConfiguration configuration)
{
    private readonly string _conexion = configuration.GetConnectionString("CadenaSQL")
        ?? throw new InvalidOperationException("Falta configurar CadenaSQL.");
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<List<Cancha>> Listar(bool incluirInactivas)
    {
        using var conexion = new SqlConnection(_conexion);
        using var comando = Comando("CANCHA_LISTAR", conexion);
        comando.Parameters.Add("@IncluirInactivas", SqlDbType.Bit).Value = incluirInactivas;
        await conexion.OpenAsync();
        using var lector = await comando.ExecuteReaderAsync();
        var canchas = new Dictionary<long, Cancha>();
        while (await lector.ReadAsync())
        {
            var cancha = new Cancha { IdCancha = Convert.ToInt64(lector["ID_CANCHA"]), IdDeporte = lector["ID_DEPORTE"] is DBNull ? null : Convert.ToInt64(lector["ID_DEPORTE"]),
                Nombre = lector["NOMBRE"].ToString()!, NombreDeporte = lector["NOMBRE_DEPORTE"].ToString() ?? string.Empty,
                Ubicacion = lector["UBICACION"].ToString(), Activo = Convert.ToBoolean(lector["ACTIVO"]), DeporteActivo = Convert.ToBoolean(lector["DEPORTE_ACTIVO"]) };
            if (Convert.ToBoolean(lector["TIENE_IMAGEN"]))
                cancha.ImagenUrl = $"/api/Cancha/{cancha.IdCancha}/imagen?v={Convert.ToDateTime(lector["FECHA_MODIFICACION"]).Ticks}";
            canchas.Add(cancha.IdCancha, cancha);
        }
        if (await lector.NextResultAsync())
            while (await lector.ReadAsync())
                if (canchas.TryGetValue(Convert.ToInt64(lector["ID_CANCHA"]), out var cancha)) cancha.Horarios.Add(LeerHorario(lector));
        return canchas.Values.ToList();
    }

    public async Task<long> Guardar(long? id, GuardarCanchaSolicitud solicitud)
    {
        using var conexion = new SqlConnection(_conexion);
        using var comando = Comando("CANCHA_GUARDAR", conexion);
        comando.Parameters.Add("@IdCancha", SqlDbType.BigInt).Value = (object?)id ?? DBNull.Value;
        comando.Parameters.Add("@IdDeporte", SqlDbType.BigInt).Value = solicitud.IdDeporte;
        comando.Parameters.Add("@Nombre", SqlDbType.NVarChar, 100).Value = solicitud.Nombre.Trim();
        comando.Parameters.Add("@Ubicacion", SqlDbType.NVarChar, 100).Value = (object?)solicitud.Ubicacion?.Trim() ?? DBNull.Value;
        comando.Parameters.Add("@Activo", SqlDbType.Bit).Value = solicitud.Activo;
        comando.Parameters.Add("@Horarios", SqlDbType.NVarChar, -1).Value = JsonSerializer.Serialize(solicitud.Horarios, JsonOptions);
        var resultado = SqlResultadoProcedimiento.Agregar(comando);
        await conexion.OpenAsync();
        var idCancha = await comando.ExecuteScalarAsync();
        resultado.Comprobar();
        return Convert.ToInt64(idCancha);
    }

    public async Task<DisponibilidadCancha> Disponibilidad(long id, int? dia, long? idEntrenador, long? excluirClase)
    {
        using var conexion = new SqlConnection(_conexion);
        using var comando = Comando("CANCHA_DISPONIBILIDAD", conexion);
        comando.Parameters.Add("@IdCancha", SqlDbType.BigInt).Value = id;
        comando.Parameters.Add("@DiaISO", SqlDbType.Int).Value = (object?)dia ?? DBNull.Value;
        comando.Parameters.Add("@IdEntrenador", SqlDbType.BigInt).Value = (object?)idEntrenador ?? DBNull.Value;
        comando.Parameters.Add("@ExcluirClase", SqlDbType.BigInt).Value = (object?)excluirClase ?? DBNull.Value;
        var resultado = SqlResultadoProcedimiento.Agregar(comando);
        await conexion.OpenAsync();
        using var lector = await comando.ExecuteReaderAsync();
        var apertura = new List<HorarioClase>();
        while (await lector.ReadAsync()) apertura.Add(LeerHorario(lector));
        var ocupados = new List<OcupacionCancha>();
        if (await lector.NextResultAsync())
            while (await lector.ReadAsync()) ocupados.Add(new OcupacionCancha
            {
                DiaSemana = Convert.ToInt32(lector["DIA_ISO"]), HoraInicio = Hora(lector["HORA_INICIO"]), HoraFin = Hora(lector["HORA_FIN"]),
                IdClase = Convert.ToInt64(lector["ID_CLASE"]), NombreClase = lector["NOMBRE_CLASE"].ToString()!,
                IdCancha = lector["ID_CANCHA"] is DBNull ? null : Convert.ToInt64(lector["ID_CANCHA"])
            });
        await lector.CloseAsync();
        resultado.Comprobar();
        return new DisponibilidadCancha(DisponibilidadHorarios.Calcular(apertura, ocupados), ocupados);
    }

    public async Task<List<EntradaCronograma>> Cronograma(long? idEntrenador, long? idCancha, long? idDeporte, bool incluirNoDisponibles)
    {
        using var conexion = new SqlConnection(_conexion);
        using var comando = Comando("ADMIN_CRONOGRAMA", conexion);
        comando.Parameters.Add("@IdEntrenador", SqlDbType.BigInt).Value = (object?)idEntrenador ?? DBNull.Value;
        comando.Parameters.Add("@IdCancha", SqlDbType.BigInt).Value = (object?)idCancha ?? DBNull.Value;
        comando.Parameters.Add("@IdDeporte", SqlDbType.BigInt).Value = (object?)idDeporte ?? DBNull.Value;
        comando.Parameters.Add("@IncluirNoDisponibles", SqlDbType.Bit).Value = incluirNoDisponibles;
        await conexion.OpenAsync();
        using var lector = await comando.ExecuteReaderAsync();
        var agenda = new List<EntradaCronograma>();
        while (await lector.ReadAsync()) agenda.Add(new EntradaCronograma
        {
            IdClase = Convert.ToInt64(lector["ID_CLASE"]), NombreClase = lector["NOMBRE_CLASE"].ToString()!,
            IdEntrenador = lector["ID_ENTRENADOR"] is DBNull ? null : Convert.ToInt64(lector["ID_ENTRENADOR"]), EntrenadorNombre = lector["ENTRENADOR_NOMBRE"].ToString()!,
            IdDeporte = lector["ID_DEPORTE"] is DBNull ? 0 : Convert.ToInt64(lector["ID_DEPORTE"]), NombreDeporte = lector["NOMBRE_DEPORTE"].ToString() ?? "Sin deporte",
            IdCancha = lector["ID_CANCHA"] is DBNull ? null : Convert.ToInt64(lector["ID_CANCHA"]), NombreCancha = lector["NOMBRE_CANCHA"].ToString(),
            Ubicacion = lector["UBICACION"].ToString(), DiaSemana = Convert.ToInt32(lector["DIA_ISO"]),
            HoraInicio = Hora(lector["HORA_INICIO"]), HoraFin = Hora(lector["HORA_FIN"]),
            Disponible = Convert.ToBoolean(lector["DISPONIBLE"]), OcupaCancha = Convert.ToBoolean(lector["OCUPA_CANCHA"])
        });
        return agenda;
    }

    public async Task Eliminar(long id)
    {
        using var conexion = new SqlConnection(_conexion);
        using var comando = Comando("CANCHA_ELIMINAR", conexion);
        comando.Parameters.Add("@IdCancha", SqlDbType.BigInt).Value = id;
        var resultado = SqlResultadoProcedimiento.Agregar(comando);
        await conexion.OpenAsync();
        await comando.ExecuteNonQueryAsync();
        resultado.Comprobar();
    }

    public async Task GuardarImagen(long id, byte[] imagen, string tipo)
    {
        using var conexion = new SqlConnection(_conexion);
        using var comando = Comando("CANCHA_IMAGEN_GUARDAR", conexion);
        comando.Parameters.Add("@IdCancha", SqlDbType.BigInt).Value = id;
        comando.Parameters.Add("@Imagen", SqlDbType.VarBinary, -1).Value = imagen;
        comando.Parameters.Add("@Tipo", SqlDbType.VarChar, 50).Value = tipo;
        var resultado = SqlResultadoProcedimiento.Agregar(comando);
        await conexion.OpenAsync();
        await comando.ExecuteNonQueryAsync();
        resultado.Comprobar();
    }

    public async Task<(byte[] Datos, string Tipo)?> ObtenerImagen(long id, bool incluirInactivas)
    {
        using var conexion = new SqlConnection(_conexion);
        using var comando = Comando("CANCHA_IMAGEN_OBTENER", conexion);
        comando.Parameters.Add("@IdCancha", SqlDbType.BigInt).Value = id;
        comando.Parameters.Add("@IncluirInactivas", SqlDbType.Bit).Value = incluirInactivas;
        var resultado = SqlResultadoProcedimiento.Agregar(comando);
        await conexion.OpenAsync();
        using var lector = await comando.ExecuteReaderAsync();
        (byte[] Datos, string Tipo)? imagen = null;
        if (await lector.ReadAsync() && lector["IMAGEN"] is byte[] datos)
            imagen = (datos, lector["IMAGEN_TIPO"].ToString() ?? string.Empty);
        await lector.CloseAsync();
        try { resultado.Comprobar(); }
        catch (ProcedimientoException ex) when (ex.NumeroError == 51004) { return null; }
        return imagen;
    }

    private static SqlCommand Comando(string nombre, SqlConnection conexion) => new(nombre, conexion) { CommandType = CommandType.StoredProcedure };
    private static string Hora(object valor) => ((TimeSpan)valor).ToString(@"hh\:mm");
    private static HorarioClase LeerHorario(SqlDataReader lector) => new()
    {
        DiaSemana = Convert.ToInt32(lector["DIA_ISO"]), HoraInicio = Hora(lector["HORA_INICIO"]), HoraFin = Hora(lector["HORA_FIN"])
    };
}
