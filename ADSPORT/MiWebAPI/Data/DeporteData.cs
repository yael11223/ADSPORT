using ADSPORT.Models;
using System.Data;
using System.Data.SqlClient;

namespace ADSPORT.Data;

public sealed class DeporteData
{
    private readonly string _conexion;
    public DeporteData(IConfiguration configuration)
    {
        _conexion = configuration.GetConnectionString("CadenaSQL")
            ?? throw new InvalidOperationException("Falta configurar CadenaSQL.");
    }

    public async Task<List<Deporte>> Lista(bool incluirInactivos = false)
    {
        using var conexion = new SqlConnection(_conexion);
        using var comando = CrearComando("DEPORTE_LISTA", conexion);
        comando.Parameters.Add("@incluir_inactivos", SqlDbType.Bit).Value = incluirInactivos;
        var resultado = SqlResultadoProcedimiento.Agregar(comando);
        await conexion.OpenAsync();
        using var reader = await comando.ExecuteReaderAsync();
        var lista = new List<Deporte>();
        while (await reader.ReadAsync()) lista.Add(LeerDeporte(reader));
        await reader.CloseAsync();
        resultado.Comprobar();
        return lista;
    }

    public async Task<Deporte?> Obtener(long id, bool incluirInactivos = false)
    {
        using var conexion = new SqlConnection(_conexion);
        using var comando = CrearComando("DEPORTE_OBTENER", conexion);
        comando.Parameters.Add("@id_deporte", SqlDbType.BigInt).Value = id;
        comando.Parameters.Add("@incluir_inactivos", SqlDbType.Bit).Value = incluirInactivos;
        var resultado = SqlResultadoProcedimiento.Agregar(comando);
        await conexion.OpenAsync();
        using var reader = await comando.ExecuteReaderAsync();
        var deporte = await reader.ReadAsync() ? LeerDeporte(reader) : null;
        await reader.CloseAsync();
        resultado.Comprobar();
        return deporte;
    }

    public async Task<long> Guardar(long? id, GuardarDeporteSolicitud solicitud)
    {
        using var conexion = new SqlConnection(_conexion);
        using var comando = CrearComando("DEPORTE_GUARDAR", conexion);
        comando.Parameters.Add("@id_deporte", SqlDbType.BigInt).Value = (object?)id ?? DBNull.Value;
        comando.Parameters.Add("@nombre_deporte", SqlDbType.NVarChar, -1).Value = solicitud.NombreDeporte.Trim();
        comando.Parameters.Add("@descripcion", SqlDbType.NVarChar, -1).Value = string.IsNullOrWhiteSpace(solicitud.Descripcion) ? DBNull.Value : solicitud.Descripcion.Trim();
        comando.Parameters.Add("@activo", SqlDbType.Bit).Value = solicitud.Activo!.Value;
        var resultado = SqlResultadoProcedimiento.Agregar(comando);
        await conexion.OpenAsync();
        var idGuardado = await comando.ExecuteScalarAsync();
        resultado.Comprobar();
        return Convert.ToInt64(idGuardado);
    }

    public async Task Eliminar(long id)
    {
        using var conexion = new SqlConnection(_conexion);
        using var comando = CrearComando("DEPORTE_BORRAR", conexion);
        comando.Parameters.Add("@id_deporte", SqlDbType.BigInt).Value = id;
        var resultado = SqlResultadoProcedimiento.Agregar(comando);
        await conexion.OpenAsync();
        await comando.ExecuteNonQueryAsync();
        resultado.Comprobar();
    }

    public async Task Desactivar(long id)
    {
        using var conexion = new SqlConnection(_conexion);
        using var comando = CrearComando("DEPORTE_DESACTIVAR", conexion);
        comando.Parameters.Add("@id_deporte", SqlDbType.BigInt).Value = id;
        var resultado = SqlResultadoProcedimiento.Agregar(comando);
        await conexion.OpenAsync();
        await comando.ExecuteNonQueryAsync();
        resultado.Comprobar();
    }

    public async Task GuardarImagen(long id, byte[] imagen, string tipo)
    {
        using var conexion = new SqlConnection(_conexion);
        using var comando = CrearComando("DEPORTE_IMAGEN_GUARDAR", conexion);
        comando.Parameters.Add("@id_deporte", SqlDbType.BigInt).Value = id;
        comando.Parameters.Add("@imagen", SqlDbType.VarBinary, -1).Value = imagen;
        comando.Parameters.Add("@imagen_tipo", SqlDbType.VarChar, 50).Value = tipo;
        var resultado = SqlResultadoProcedimiento.Agregar(comando);
        await conexion.OpenAsync();
        await comando.ExecuteNonQueryAsync();
        resultado.Comprobar();
    }

    public async Task<(byte[] Datos, string Tipo)?> ObtenerImagen(long id, bool incluirInactivos = false)
    {
        using var conexion = new SqlConnection(_conexion);
        using var comando = CrearComando("DEPORTE_IMAGEN_OBTENER", conexion);
        comando.Parameters.Add("@id_deporte", SqlDbType.BigInt).Value = id;
        comando.Parameters.Add("@incluir_inactivos", SqlDbType.Bit).Value = incluirInactivos;
        var resultado = SqlResultadoProcedimiento.Agregar(comando);
        await conexion.OpenAsync();
        using var reader = await comando.ExecuteReaderAsync();
        (byte[] Datos, string Tipo)? imagen = null;
        if (await reader.ReadAsync() && reader["IMAGEN"] is byte[] datos)
            imagen = (datos, reader["IMAGEN_TIPO"].ToString() ?? string.Empty);
        await reader.CloseAsync();
        resultado.Comprobar();
        return imagen;
    }

    private static SqlCommand CrearComando(string nombre, SqlConnection conexion) =>
        new(nombre, conexion) { CommandType = CommandType.StoredProcedure };

    private static Deporte LeerDeporte(SqlDataReader reader)
    {
        var id = Convert.ToInt64(reader["ID_DEPORTE"]);
        var fecha = reader["FECHA_UTIMA_MODIFICACION"] is DBNull ? (DateTime?)null : Convert.ToDateTime(reader["FECHA_UTIMA_MODIFICACION"]);
        return new Deporte
        {
            IdDeporte = id,
            NombreDeporte = reader["NOMBRE_DEPORTE"].ToString() ?? string.Empty,
            Descripcion = reader["DESCRIPCION"] is DBNull ? null : reader["DESCRIPCION"].ToString(),
            Activo = Convert.ToBoolean(reader["ACTIVO"]),
            FechaUltimaModificacion = fecha,
            ImagenUrl = Convert.ToBoolean(reader["TIENE_IMAGEN"])
                ? $"/api/Deporte/{id}/imagen?v={fecha?.Ticks ?? 0}" : null
        };
    }
}
