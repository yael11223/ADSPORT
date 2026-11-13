
using ADSPORT.Models;
using MiWebAPI.Models;
using System.Data;
using System.Data.SqlClient;

namespace ADSPORT.Data
{
    public class UsuarioData
    {
        private readonly string conexion;

        public UsuarioData(IConfiguration configuration)
        {
            conexion = configuration
                .GetConnectionString("CadenaSQL")!;
        }

        // ========================================
        // 1. LISTAR USUARIOS
        // ========================================

        public async Task<List<Usuario>> Lista()
        {
            List<Usuario> lista = new List<Usuario>();

            using (var con = new SqlConnection(conexion))
            {
                await con.OpenAsync();

                using var cmd = new SqlCommand(
                    "USUARIO_LISTA", con)
                {
                    CommandType = CommandType.StoredProcedure
                };

                using var reader =
                    await cmd.ExecuteReaderAsync();

                while (await reader.ReadAsync())
                {
                    lista.Add(new Usuario
                    {
                        IdUsuario = Convert.ToInt32(
                            reader["ID_USUARIO"]),

                        IdRol = Convert.ToInt32(
                            reader["ID_ROL"]),

                        NombreRol = reader["NOMBRE_ROL"]?
                            .ToString(),

                        Nombre = reader["NOMBRE"]?
                            .ToString(),

                        ApellidoPaterno =
                            reader["APELLIDO_PATERNO"]?
                            .ToString(),

                        ApellidoMaterno =
                            reader["APELLIDO_MATERNO"]?
                            .ToString(),

                        Correo = reader["CORREO"]?
                            .ToString(),

                        Telefono = reader["TELEFONO"]?
                            .ToString(),

                        Estatus = reader["ESTATUS"]?
                            .ToString(),

                        CodigoQr = reader["CODIGO_QR"]?
                            .ToString(),

                        // NUEVO: FOTO DE PERFIL
                        Foto = reader["FOTO"] == DBNull.Value
                            ? null
                            : (byte[])reader["FOTO"],

                        FechaUltimaModificacion =
                            reader["FECHA__ULTIMA_MODIFICACION"]?
                            .ToString()
                    });
                }
            }

            return lista;
        }

        // ========================================
        // 2. OBTENER USUARIO POR ID
        // ========================================

        public async Task<Usuario?> Obtener(int Id)
        {
            Usuario? objeto = null;

            using (var con = new SqlConnection(conexion))
            {
                await con.OpenAsync();

                using var cmd = new SqlCommand(
                    "USUARIO_BUSCAR_POR_ID", con)
                {
                    CommandType = CommandType.StoredProcedure
                };

                cmd.Parameters.Add(
                    "@id_usuario",
                    SqlDbType.BigInt
                ).Value = Id;

                using var reader =
                    await cmd.ExecuteReaderAsync();

                if (await reader.ReadAsync())
                {
                    objeto = new Usuario
                    {
                        IdUsuario = Convert.ToInt32(
                            reader["ID_USUARIO"]),

                        IdRol = Convert.ToInt32(
                            reader["ID_ROL"]),

                        NombreRol = reader["NOMBRE_ROL"]?
                            .ToString(),

                        // El SP utiliza este alias.
                        Nombre = reader["NombreCompleto"]?
                            .ToString(),

                        ApellidoPaterno =
                            reader["APELLIDO_PATERNO"]?
                            .ToString(),

                        ApellidoMaterno =
                            reader["APELLIDO_MATERNO"]?
                            .ToString(),

                        Correo = reader["CORREO"]?
                            .ToString(),

                        Telefono = reader["TELEFONO"]?
                            .ToString(),

                        Estatus = reader["ESTATUS"]?
                            .ToString(),

                        CodigoQr = reader["CODIGO_QR"]?
                            .ToString(),

                        // NUEVO: FOTO DE PERFIL
                        Foto = reader["FOTO"] == DBNull.Value
                            ? null
                            : (byte[])reader["FOTO"],

                        FechaUltimaModificacion =
                            reader["FECHA__ULTIMA_MODIFICACION"]?
                            .ToString()
                    };
                }
            }

            return objeto;
        }

        // ========================================
        // 3. CREAR USUARIO
        // ========================================

        public async Task<RespuestaOperacion> Crear(
            Usuario objeto)
        {
            using (var con = new SqlConnection(conexion))
            {
                using var cmd = new SqlCommand(
                    "USUARIO_AGREGA", con)
                {
                    CommandType = CommandType.StoredProcedure
                };

                cmd.Parameters.AddWithValue(
                    "@id_rol", objeto.IdRol);

                cmd.Parameters.AddWithValue(
                    "@nombre", objeto.Nombre);

                cmd.Parameters.AddWithValue(
                    "@apellido_paterno",
                    objeto.ApellidoPaterno);

                cmd.Parameters.AddWithValue(
                    "@apellido_materno",
                    objeto.ApellidoMaterno);

                cmd.Parameters.AddWithValue(
                    "@correo", objeto.Correo);

                cmd.Parameters.AddWithValue(
                    "@telefono", objeto.Telefono);

                cmd.Parameters.AddWithValue(
                    "@estatus", objeto.Estatus);

                cmd.Parameters.AddWithValue(
                    "@codigo_qr",
                    objeto.CodigoQr ?? string.Empty);

                // NUEVO: FOTOGRAFÍA OPCIONAL
                cmd.Parameters.Add(
                    "@foto",
                    SqlDbType.VarBinary,
                    -1
                ).Value = (object?)objeto.Foto
                    ?? DBNull.Value;

                var numeroError = new SqlParameter(
                    "@numeroError", SqlDbType.Int)
                {
                    Direction = ParameterDirection.Output
                };

                var respuesta = new SqlParameter(
                    "@respuesta", SqlDbType.VarChar, 1000)
                {
                    Direction = ParameterDirection.Output
                };

                cmd.Parameters.Add(numeroError);
                cmd.Parameters.Add(respuesta);

                try
                {
                    await con.OpenAsync();
                    await cmd.ExecuteNonQueryAsync();

                    return new RespuestaOperacion
                    {
                        NumeroError = Convert.ToInt32(
                            numeroError.Value),

                        Respuesta = respuesta.Value?
                            .ToString() ?? string.Empty
                    };
                }
                catch (Exception ex)
                {
                    return new RespuestaOperacion
                    {
                        NumeroError = -1,
                        Respuesta = ex.Message
                    };
                }
            }
        }

        // ========================================
        // 4. ACTUALIZAR USUARIO
        // ========================================

        public async Task<RespuestaOperacion> Editar(
            Usuario objeto)
        {
            using (var con = new SqlConnection(conexion))
            {
                using var cmd = new SqlCommand(
                    "USUARIO_ACTUALIZA", con)
                {
                    CommandType = CommandType.StoredProcedure
                };

                cmd.Parameters.AddWithValue(
                    "@id_usuario", objeto.IdUsuario);

                cmd.Parameters.AddWithValue(
                    "@id_rol", objeto.IdRol);

                cmd.Parameters.AddWithValue(
                    "@nombre", objeto.Nombre);

                cmd.Parameters.AddWithValue(
                    "@apellido_paterno",
                    objeto.ApellidoPaterno);

                cmd.Parameters.AddWithValue(
                    "@apellido_materno",
                    objeto.ApellidoMaterno);

                cmd.Parameters.AddWithValue(
                    "@correo", objeto.Correo);

                cmd.Parameters.AddWithValue(
                    "@telefono", objeto.Telefono);

                cmd.Parameters.AddWithValue(
                    "@estatus", objeto.Estatus);

                cmd.Parameters.AddWithValue(
                    "@codigo_qr",
                    objeto.CodigoQr ?? string.Empty);

                // NUEVO: FOTOGRAFÍA
                // Si es NULL, el SP conserva
                // la imagen anterior.
                cmd.Parameters.Add(
                    "@foto",
                    SqlDbType.VarBinary,
                    -1
                ).Value = (object?)objeto.Foto
                    ?? DBNull.Value;

                var numeroError = new SqlParameter(
                    "@numeroError", SqlDbType.Int)
                {
                    Direction = ParameterDirection.Output
                };

                var respuesta = new SqlParameter(
                    "@respuesta", SqlDbType.VarChar, 1000)
                {
                    Direction = ParameterDirection.Output
                };

                cmd.Parameters.Add(numeroError);
                cmd.Parameters.Add(respuesta);

                try
                {
                    await con.OpenAsync();
                    await cmd.ExecuteNonQueryAsync();

                    return new RespuestaOperacion
                    {
                        NumeroError = Convert.ToInt32(
                            numeroError.Value),

                        Respuesta = respuesta.Value?
                            .ToString() ?? string.Empty
                    };
                }
                catch (Exception ex)
                {
                    return new RespuestaOperacion
                    {
                        NumeroError = -1,
                        Respuesta = ex.Message
                    };
                }
            }
        }

        // ========================================
        // 5. ELIMINAR USUARIO
        // ========================================

        public async Task<RespuestaOperacion> Eliminar(
            int id)
        {
            using (var con = new SqlConnection(conexion))
            {
                using var cmd = new SqlCommand(
                    "USUARIO_ELIMINA", con)
                {
                    CommandType = CommandType.StoredProcedure
                };

                cmd.Parameters.Add(
                    "@id_usuario",
                    SqlDbType.BigInt
                ).Value = id;

                var numeroError = new SqlParameter(
                    "@numeroError", SqlDbType.Int)
                {
                    Direction = ParameterDirection.Output
                };

                var respuesta = new SqlParameter(
                    "@respuesta", SqlDbType.VarChar, 1000)
                {
                    Direction = ParameterDirection.Output
                };

                cmd.Parameters.Add(numeroError);
                cmd.Parameters.Add(respuesta);

                try
                {
                    await con.OpenAsync();
                    await cmd.ExecuteNonQueryAsync();

                    return new RespuestaOperacion
                    {
                        NumeroError = Convert.ToInt32(
                            numeroError.Value),

                        Respuesta = respuesta.Value?
                            .ToString() ?? string.Empty
                    };
                }
                catch (Exception ex)
                {
                    return new RespuestaOperacion
                    {
                        NumeroError = -1,
                        Respuesta = ex.Message
                    };
                }
            }
        }
    }
}
