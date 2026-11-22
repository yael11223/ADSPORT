using System.Data;
using System.Data.SqlClient;

namespace ADSPORT.Data;

public sealed class RecuperacionPasswordData(IConfiguration configuration)
{
    private readonly string conexion = configuration.GetConnectionString("CadenaSQL")!;

    public async Task<long?> Solicitar(string correo, string codigoHash)
    {
        using var con = new SqlConnection(conexion);
        using var cmd = new SqlCommand("RECUPERACION_PASSWORD_SOLICITAR", con) { CommandType = CommandType.StoredProcedure };
        cmd.Parameters.Add("@Correo", SqlDbType.VarChar, 100).Value = correo;
        cmd.Parameters.Add("@CodigoHash", SqlDbType.VarChar, 64).Value = codigoHash;
        var id = cmd.Parameters.Add("@IdCodigo", SqlDbType.BigInt);
        id.Direction = ParameterDirection.Output;
        var resultado = SqlResultadoProcedimiento.Agregar(cmd);
        await con.OpenAsync();
        await cmd.ExecuteNonQueryAsync();
        resultado.Comprobar();
        return id.Value is DBNull ? null : Convert.ToInt64(id.Value);
    }

    public async Task Restablecer(string correo, string codigoHash, string passwordHash)
    {
        using var con = new SqlConnection(conexion);
        using var cmd = new SqlCommand("RECUPERACION_PASSWORD_RESTABLECER", con) { CommandType = CommandType.StoredProcedure };
        cmd.Parameters.Add("@Correo", SqlDbType.VarChar, 100).Value = correo;
        cmd.Parameters.Add("@CodigoHash", SqlDbType.VarChar, 64).Value = codigoHash;
        cmd.Parameters.Add("@PasswordHash", SqlDbType.VarChar, 60).Value = passwordHash;
        var resultado = SqlResultadoProcedimiento.Agregar(cmd);
        await con.OpenAsync();
        await cmd.ExecuteNonQueryAsync();
        resultado.Comprobar();
    }

    public async Task InvalidarEnvio(long idCodigo)
    {
        using var con = new SqlConnection(conexion);
        using var cmd = new SqlCommand("RECUPERACION_PASSWORD_INVALIDAR_ENVIO", con) { CommandType = CommandType.StoredProcedure };
        cmd.Parameters.Add("@IdCodigo", SqlDbType.BigInt).Value = idCodigo;
        await con.OpenAsync();
        await cmd.ExecuteNonQueryAsync();
    }

    public async Task<bool> SesionRevocada(long idUsuario, DateTime inicioSesion)
    {
        using var con = new SqlConnection(conexion);
        using var cmd = new SqlCommand("RECUPERACION_PASSWORD_SESION_REVOCADA", con) { CommandType = CommandType.StoredProcedure };
        cmd.Parameters.Add("@IdUsuario", SqlDbType.BigInt).Value = idUsuario;
        cmd.Parameters.Add("@InicioSesion", SqlDbType.DateTime2).Value = inicioSesion;
        await con.OpenAsync();
        return Convert.ToBoolean(await cmd.ExecuteScalarAsync());
    }
}
