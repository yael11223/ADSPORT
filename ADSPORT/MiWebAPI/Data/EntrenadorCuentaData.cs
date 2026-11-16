using ADSPORT.Models;
using System.Data;
using System.Data.SqlClient;

namespace ADSPORT.Data;

public interface IEntrenadorCuentaData
{
    Task<EntrenadorCuenta?> ObtenerAsync(long idUsuario);
    Task<byte[]?> ObtenerFotoAsync(long idUsuario);
    Task<string?> ObtenerPasswordHashAsync(long idUsuario);
    Task<bool> CambiarPasswordAsync(long idUsuario, string hashAnterior, string hashNuevo);
}

public sealed class EntrenadorCuentaData : IEntrenadorCuentaData
{
    private readonly string _conexion;

    public EntrenadorCuentaData(IConfiguration configuration)
    {
        _conexion = configuration.GetConnectionString("CadenaSQL")
            ?? throw new InvalidOperationException("Falta configurar CadenaSQL.");
    }

    public async Task<EntrenadorCuenta?> ObtenerAsync(long idUsuario)
    {
        using var conexion = new SqlConnection(_conexion);
        using var comando = CrearComando("ENTRENADOR_CUENTA_OBTENER", conexion, idUsuario);
        var resultado = SqlResultadoProcedimiento.Agregar(comando);
        await conexion.OpenAsync();
        EntrenadorCuenta? cuenta = null;
        using (var reader = await comando.ExecuteReaderAsync())
        {
            if (await reader.ReadAsync())
                cuenta = new EntrenadorCuenta
                {
                    IdUsuario = Convert.ToInt64(reader["ID_USUARIO"]),
                    NombreCompleto = reader["NOMBRE_COMPLETO"]?.ToString() ?? string.Empty,
                    Correo = reader["CORREO"]?.ToString() ?? string.Empty,
                    Telefono = reader["TELEFONO"]?.ToString() ?? string.Empty,
                    Estatus = reader["ESTATUS"]?.ToString() ?? string.Empty,
                    NombreRol = reader["NOMBRE_ROL"]?.ToString() ?? string.Empty,
                    TieneFoto = Convert.ToBoolean(reader["TIENE_FOTO"])
                };
        }
        // SQL envía los OUTPUT cuando el lector se cierra, aunque no haya devuelto filas.
        try { resultado.Comprobar(); }
        catch (ProcedimientoException ex) when (ex.NumeroError == 404) { return null; }
        return cuenta;
    }

    public async Task<byte[]?> ObtenerFotoAsync(long idUsuario)
    {
        using var conexion = new SqlConnection(_conexion);
        using var comando = CrearComando("ENTRENADOR_FOTO_OBTENER", conexion, idUsuario);
        var operacion = SqlResultadoProcedimiento.Agregar(comando);
        await conexion.OpenAsync();
        var resultado = await comando.ExecuteScalarAsync();
        try { operacion.Comprobar(); }
        catch (ProcedimientoException ex) when (ex.NumeroError == 404) { return null; }
        return resultado is byte[] foto ? foto : null;
    }

    public async Task<string?> ObtenerPasswordHashAsync(long idUsuario)
    {
        using var conexion = new SqlConnection(_conexion);
        using var comando = CrearComando("ENTRENADOR_PASSWORD_OBTENER", conexion, idUsuario);
        var operacion = SqlResultadoProcedimiento.Agregar(comando);
        await conexion.OpenAsync();
        var hash = await comando.ExecuteScalarAsync() as string;
        try { operacion.Comprobar(); }
        catch (ProcedimientoException ex) when (ex.NumeroError == 404) { return null; }
        return hash;
    }

    public async Task<bool> CambiarPasswordAsync(long idUsuario, string hashAnterior, string hashNuevo)
    {
        using var conexion = new SqlConnection(_conexion);
        using var comando = CrearComando("ENTRENADOR_PASSWORD_CAMBIAR", conexion, idUsuario);
        var operacion = SqlResultadoProcedimiento.Agregar(comando);
        comando.Parameters.Add("@password_anterior", SqlDbType.VarChar, 60).Value = hashAnterior;
        comando.Parameters.Add("@password_nuevo", SqlDbType.VarChar, 60).Value = hashNuevo;
        await conexion.OpenAsync();
        var cambiado = Convert.ToInt32(await comando.ExecuteScalarAsync()) == 1;
        operacion.Comprobar();
        return cambiado;
    }

    private static SqlCommand CrearComando(string nombre, SqlConnection conexion, long idUsuario)
    {
        var comando = new SqlCommand(nombre, conexion) { CommandType = CommandType.StoredProcedure };
        comando.Parameters.Add("@id_usuario", SqlDbType.BigInt).Value = idUsuario;
        return comando;
    }
}
