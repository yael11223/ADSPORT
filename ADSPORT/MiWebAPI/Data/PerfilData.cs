using ADSPORT.Models;
using ADSPORT.Security;
using System.Data;
using System.Data.SqlClient;

namespace ADSPORT.Data;

public sealed class PerfilData(IConfiguration configuracion)
{
    private readonly string _conexion = configuracion.GetConnectionString("CadenaSQL") ?? "";
    public async Task<PerfilPropio> Obtener(long id)
    {
        using var db = new SqlConnection(_conexion);
        using var cmd = new SqlCommand("USUARIO_PERFIL_CONSULTAR",db) { CommandType = CommandType.StoredProcedure };
        cmd.Parameters.Add("@IdUsuario",SqlDbType.BigInt).Value=id;
        return await Leer(db,cmd);
    }
    public async Task<PerfilPropio> Guardar(long id, GuardarPerfilPropio solicitud)
    {
        var foto=await ImagenPerfil.Leer(solicitud.Foto);
        var fondo=await ImagenPerfil.Leer(solicitud.Fondo);
        if (string.IsNullOrWhiteSpace(solicitud.Nombre)) throw new ProcedimientoException(51000,"Escribe tu nombre.");
        if (foto is not null && solicitud.QuitarFoto || fondo is not null && solicitud.QuitarFondo)
            throw new ProcedimientoException(51000,"Elige una nueva imagen o quítala; no ambas acciones a la vez.");
        using var db=new SqlConnection(_conexion);
        using var cmd=new SqlCommand("USUARIO_PERFIL_GUARDAR",db) { CommandType=CommandType.StoredProcedure };
        cmd.Parameters.Add("@IdUsuario",SqlDbType.BigInt).Value=id;
        cmd.Parameters.Add("@Nombre",SqlDbType.VarChar,100).Value=solicitud.Nombre.Trim();
        cmd.Parameters.Add("@Paterno",SqlDbType.VarChar,100).Value=(object?)solicitud.ApellidoPaterno?.Trim() ?? DBNull.Value;
        cmd.Parameters.Add("@Materno",SqlDbType.VarChar,100).Value=(object?)solicitud.ApellidoMaterno?.Trim() ?? DBNull.Value;
        cmd.Parameters.Add("@Telefono",SqlDbType.VarChar,100).Value=(object?)solicitud.Telefono?.Trim() ?? DBNull.Value;
        cmd.Parameters.Add("@Foto",SqlDbType.VarBinary,-1).Value=(object?)foto ?? DBNull.Value;
        cmd.Parameters.Add("@Fondo",SqlDbType.VarBinary,-1).Value=(object?)fondo ?? DBNull.Value;
        cmd.Parameters.Add("@FondoTipo",SqlDbType.VarChar,32).Value=fondo is null ? DBNull.Value : ImagenPerfil.Tipo(fondo)!;
        cmd.Parameters.Add("@QuitarFoto",SqlDbType.Bit).Value=solicitud.QuitarFoto;
        cmd.Parameters.Add("@QuitarFondo",SqlDbType.Bit).Value=solicitud.QuitarFondo;
        return await Leer(db,cmd);
    }
    private static async Task<PerfilPropio> Leer(SqlConnection db, SqlCommand cmd)
    {
        var resultado=SqlResultadoProcedimiento.Agregar(cmd);
        await db.OpenAsync(); using var r=await cmd.ExecuteReaderAsync();
        PerfilPropio? perfil=null;
        if (await r.ReadAsync()) perfil=new PerfilPropio {
            IdUsuario=Convert.ToInt64(r["ID_USUARIO"]),Nombre=(string)r["NOMBRE"],ApellidoPaterno=r["APELLIDO_PATERNO"] as string,
            ApellidoMaterno=r["APELLIDO_MATERNO"] as string,Correo=r["CORREO"] as string,Telefono=r["TELEFONO"] as string,
            NombreRol=r["NOMBRE_ROL"] as string,Estatus=(string)r["ESTATUS"],TieneFoto=(bool)r["TIENE_FOTO"],TieneFondo=(bool)r["TIENE_FONDO"],
            ModificadoUtc=r["FECHA__ULTIMA_MODIFICACION"] is DateTime fecha ? DateTime.SpecifyKind(fecha,DateTimeKind.Utc) : null
        };
        await r.CloseAsync(); resultado.Comprobar();
        return perfil ?? throw new ProcedimientoException(51004,"No se encontró tu perfil.");
    }
    public async Task<byte[]?> Imagen(long id,bool fondo)
    {
        using var db=new SqlConnection(_conexion);
        using var cmd=new SqlCommand("USUARIO_PERFIL_IMAGEN",db) { CommandType=CommandType.StoredProcedure };
        cmd.Parameters.Add("@IdUsuario",SqlDbType.BigInt).Value=id; cmd.Parameters.Add("@Fondo",SqlDbType.Bit).Value=fondo;
        var resultado=SqlResultadoProcedimiento.Agregar(cmd); await db.OpenAsync();
        var imagen=await cmd.ExecuteScalarAsync(); resultado.Comprobar(); return imagen as byte[];
    }
}
