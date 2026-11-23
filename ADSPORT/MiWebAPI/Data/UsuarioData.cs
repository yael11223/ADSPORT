using ADSPORT.Models;
using MiWebAPI.Models;
using System.Data;
using System.Data.SqlClient;

namespace ADSPORT.Data;

public sealed class UsuarioData(IConfiguration configuration)
{
    private readonly string _conexion = configuration.GetConnectionString("CadenaSQL")
        ?? throw new InvalidOperationException("Falta configurar CadenaSQL.");

    public async Task<List<Usuario>> Lista(string? rol = null)
    {
        using var conexion = new SqlConnection(_conexion);
        using var comando = CrearComando("USUARIO_LISTA", conexion);
        comando.Parameters.Add("@Rol", SqlDbType.VarChar, 100).Value = (object?)rol ?? DBNull.Value;
        await conexion.OpenAsync();
        using var lector = await comando.ExecuteReaderAsync();
        var usuarios = new List<Usuario>();
        while (await lector.ReadAsync()) usuarios.Add(Leer(lector));
        return usuarios;
    }

    public async Task<Usuario?> Obtener(long id)
    {
        using var conexion = new SqlConnection(_conexion);
        using var comando = CrearComando("USUARIO_BUSCAR_POR_ID", conexion);
        comando.Parameters.Add("@id_usuario", SqlDbType.BigInt).Value = id;
        await conexion.OpenAsync();
        using var lector = await comando.ExecuteReaderAsync();
        return await lector.ReadAsync() ? Leer(lector, incluirFoto: true) : null;
    }

    public async Task<RespuestaOperacion> Crear(Usuario usuario, string hash)
    {
        using var conexion = new SqlConnection(_conexion);
        using var comando = CrearComando("USUARIO_AGREGA", conexion);
        AgregarDatos(comando, usuario);
        comando.Parameters.Add("@password_hash", SqlDbType.VarChar, 60).Value = hash;
        var id = comando.Parameters.Add("@id_usuario", SqlDbType.BigInt);
        id.Direction = ParameterDirection.Output;
        var codigo = comando.Parameters.Add("@codigo_generado", SqlDbType.VarChar, 128);
        codigo.Direction = ParameterDirection.Output;
        var resultado = SqlResultadoProcedimiento.Agregar(comando);
        await conexion.OpenAsync();
        await comando.ExecuteNonQueryAsync();
        resultado.Comprobar();
        return new RespuestaOperacion { IdUsuario = Convert.ToInt64(id.Value), CodigoQr = codigo.Value.ToString(),
            Respuesta = "Usuario registrado con sus credenciales y su código QR." };
    }

    public async Task<RespuestaOperacion> Editar(Usuario usuario)
    {
        using var conexion = new SqlConnection(_conexion);
        using var comando = CrearComando("USUARIO_ACTUALIZA", conexion);
        comando.Parameters.Add("@id_usuario", SqlDbType.BigInt).Value = usuario.IdUsuario;
        AgregarDatos(comando, usuario);
        var resultado = SqlResultadoProcedimiento.Agregar(comando);
        await conexion.OpenAsync();
        await comando.ExecuteNonQueryAsync();
        resultado.Comprobar();
        return new RespuestaOperacion { IdUsuario = usuario.IdUsuario, Respuesta = "Usuario actualizado. Su código QR se conserva." };
    }

    public Task<RespuestaOperacion> Eliminar(long id) => EjecutarAccion(id, "USUARIO_BORRAR",
        "Usuario eliminado definitivamente de la base de datos. Las reservas y pagos se conservaron.");

    public Task<RespuestaOperacion> Desactivar(long id) => EjecutarAccion(id, "USUARIO_ELIMINA",
        "Usuario desactivado. Se conservan sus clases, reservas y código QR.");

    private async Task<RespuestaOperacion> EjecutarAccion(long id, string procedimiento, string mensaje)
    {
        using var conexion = new SqlConnection(_conexion);
        using var comando = CrearComando(procedimiento, conexion);
        comando.Parameters.Add("@id_usuario", SqlDbType.BigInt).Value = id;
        var resultado = SqlResultadoProcedimiento.Agregar(comando);
        await conexion.OpenAsync();
        await comando.ExecuteNonQueryAsync();
        resultado.Comprobar();
        return new RespuestaOperacion { Respuesta = mensaje };
    }

    private static SqlCommand CrearComando(string nombre, SqlConnection conexion) => new(nombre, conexion) { CommandType = CommandType.StoredProcedure };

    private static void AgregarDatos(SqlCommand comando, Usuario usuario)
    {
        comando.Parameters.Add("@id_rol", SqlDbType.BigInt).Value = usuario.IdRol;
        comando.Parameters.Add("@nombre", SqlDbType.VarChar, 100).Value = usuario.Nombre.Trim();
        comando.Parameters.Add("@apellido_paterno", SqlDbType.VarChar, 100).Value = (object?)usuario.ApellidoPaterno?.Trim() ?? DBNull.Value;
        comando.Parameters.Add("@apellido_materno", SqlDbType.VarChar, 100).Value = (object?)usuario.ApellidoMaterno?.Trim() ?? DBNull.Value;
        comando.Parameters.Add("@correo", SqlDbType.VarChar, 100).Value = usuario.Correo!.Trim().ToLowerInvariant();
        comando.Parameters.Add("@telefono", SqlDbType.VarChar, 100).Value = (object?)usuario.Telefono?.Trim() ?? DBNull.Value;
        comando.Parameters.Add("@estatus", SqlDbType.VarChar, 50).Value = usuario.Estatus.ToUpperInvariant();
        comando.Parameters.Add("@foto", SqlDbType.VarBinary, -1).Value = (object?)usuario.Foto ?? DBNull.Value;
        // El identificador QR se genera en SQL y no se toma del navegador.
    }

    private static Usuario Leer(SqlDataReader lector, bool incluirFoto = false) => new()
    {
        IdUsuario = Convert.ToInt64(lector["ID_USUARIO"]), IdRol = Convert.ToInt64(lector["ID_ROL"]),
        Nombre = lector["NOMBRE"].ToString() ?? string.Empty,
        ApellidoPaterno = lector["APELLIDO_PATERNO"].ToString(), ApellidoMaterno = lector["APELLIDO_MATERNO"].ToString(),
        NombreRol = lector["NOMBRE_ROL"].ToString(), Correo = lector["CORREO"].ToString(), Telefono = lector["TELEFONO"].ToString(),
        Estatus = lector["ESTATUS"].ToString() ?? string.Empty, CodigoQr = lector["CODIGO_QR"].ToString(),
        FechaUltimaModificacion = lector["FECHA__ULTIMA_MODIFICACION"].ToString(),
        TieneFoto = Convert.ToBoolean(lector["TIENE_FOTO"]),
        Foto = incluirFoto && lector["FOTO"] is byte[] foto ? foto : null
    };
}
