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
            conexion = configuration.GetConnectionString("CadenaSQL")!;
        }

        public async Task<List<Usuario>> Lista()
        {
            List<Usuario> lista = new List<Usuario>();

            using (var con = new SqlConnection(conexion))
            {
                await con.OpenAsync();
                SqlCommand cmd = new SqlCommand("USUARIO_LISTA", con);
                cmd.CommandType = CommandType.StoredProcedure;

                using (var reader = await cmd.ExecuteReaderAsync())
                {
                    while (await reader.ReadAsync()) {
                        lista.Add(new Usuario
                        {
                            IdUsuario = Convert.ToInt32(reader["ID_USUARIO"]),
                            IdRol = Convert.ToInt32(reader["ID_ROL"]),
                            Nombre = reader["NOMBRE"].ToString(),
                            ApellidoPaterno = reader["APELLIDO_PATERNO"].ToString(),
                            ApellidoMaterno = reader["APELLIDO_MATERNO"].ToString(),
                            Correo = reader["CORREO"].ToString(),
                            Telefono = Convert.ToInt64 (reader["TELEFONO"]),
                            Estatus = reader["ESTATUS"].ToString(),
                            CodigoQr = reader["CODIGO_QR"].ToString(),
                            FechaUltimaModificacion = reader["FECHA__ULTIMA_MODIFICACION"].ToString()
                        });
                    }
                }
            }
            return lista;
        }

        public async Task<Usuario> Obtener(int Id)
        {
            Usuario objeto = new Usuario();

            using (var con = new SqlConnection(conexion))
            {
                await con.OpenAsync();
                SqlCommand cmd = new SqlCommand("USUARIO_BUSCAR_POR_ID", con);
                cmd.Parameters.AddWithValue("@id_usuario", Id);
                cmd.CommandType = CommandType.StoredProcedure;

                using (var reader = await cmd.ExecuteReaderAsync())
                {
                    while (await reader.ReadAsync())
                    {
                        objeto = new Usuario
                        {
                            IdUsuario = Convert.ToInt32(reader["ID_USUARIO"]),
                            IdRol = Convert.ToInt32(reader["ID_ROL"]),
                            Nombre = reader["NombreCompleto"].ToString(),
                            ApellidoPaterno = reader["APELLIDO_PATERNO"].ToString(),
                            ApellidoMaterno = reader["APELLIDO_MATERNO"].ToString(),
                            Correo = reader["CORREO"].ToString(),
                            Telefono = Convert.ToInt32(reader["TELEFONO"]),
                            Estatus = reader["ESTATUS"].ToString(),
                            CodigoQr = reader["CODIGO_QR"].ToString(),
                            FechaUltimaModificacion = reader["FECHA__ULTIMA_MODIFICACION"].ToString()
                        };
                    }
                }
            }
            return objeto;
        }

        public async Task<RespuestaOperacion> Crear(Usuario objeto)
        {
            using (var con = new SqlConnection(conexion))
            {
                SqlCommand cmd = new SqlCommand("USUARIO_AGREGA", con);
                cmd.Parameters.AddWithValue("@id_rol", objeto.IdRol);
                cmd.Parameters.AddWithValue("@nombre", objeto.Nombre);
                cmd.Parameters.AddWithValue("@apellido_paterno", objeto.ApellidoPaterno);
                cmd.Parameters.AddWithValue("@apellido_materno", objeto.ApellidoMaterno);
                cmd.Parameters.AddWithValue("@correo", objeto.Correo);
                cmd.Parameters.AddWithValue("@telefono", objeto.Telefono);
                cmd.Parameters.AddWithValue("@estatus", objeto.Estatus);
                cmd.Parameters.AddWithValue("@codigo_qr", objeto.Estatus);
                SqlParameter numeroError = new SqlParameter("@numeroError", SqlDbType.Int)
                {
                    Direction = ParameterDirection.Output
                };
                SqlParameter respuesta = new SqlParameter("@respuesta", SqlDbType.VarChar, 1000)
                {
                    Direction = ParameterDirection.Output
                };
                cmd.Parameters.Add(numeroError);
                cmd.Parameters.Add(respuesta);
                cmd.CommandType = CommandType.StoredProcedure;

                try
                {
                    await con.OpenAsync();
                    await cmd.ExecuteNonQueryAsync();

                    return new RespuestaOperacion
                    {
                        NumeroError = Convert.ToInt32(numeroError.Value),
                        Respuesta = respuesta.Value?.ToString() ?? string.Empty
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

        public async Task<RespuestaOperacion> Editar(Usuario objeto)
        {
            using (var con = new SqlConnection(conexion))
            {
                SqlCommand cmd = new SqlCommand("USUARIO_ACTUALIZA", con);
                cmd.Parameters.AddWithValue("@id_usuario", objeto.IdUsuario);
                cmd.Parameters.AddWithValue("@id_rol", objeto.IdRol);
                cmd.Parameters.AddWithValue("@nombre ", objeto.Nombre);
                cmd.Parameters.AddWithValue("@apellido_paterno ", objeto.ApellidoPaterno);
                cmd.Parameters.AddWithValue("@apellido_materno ", objeto.ApellidoMaterno);
                cmd.Parameters.AddWithValue("@correo", objeto.Correo);
                cmd.Parameters.AddWithValue("@telefono", objeto.Telefono);
                cmd.Parameters.AddWithValue("@estatus", objeto.Estatus);
                cmd.Parameters.AddWithValue("@codigo_qr", objeto.Estatus);
                SqlParameter numeroError = new SqlParameter("@numeroError", SqlDbType.Int)
                {
                    Direction = ParameterDirection.Output
                };
                SqlParameter respuesta = new SqlParameter("@respuesta", SqlDbType.VarChar, 1000)
                {
                    Direction = ParameterDirection.Output
                };
                cmd.Parameters.Add(numeroError);
                cmd.Parameters.Add(respuesta);
                cmd.CommandType = CommandType.StoredProcedure;

                try
                {
                    await con.OpenAsync();
                    await cmd.ExecuteNonQueryAsync();

                    return new RespuestaOperacion
                    {
                        NumeroError = Convert.ToInt32(numeroError.Value),
                        Respuesta = respuesta.Value?.ToString() ?? string.Empty
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

        public async Task<RespuestaOperacion> Eliminar(int id)
        {
            using (var con = new SqlConnection(conexion))
            {
                SqlCommand cmd = new SqlCommand("USUARIO_ELIMINAR", con);
                cmd.Parameters.AddWithValue("@id_usuario", id);
                SqlParameter numeroError = new SqlParameter("@numeroError", SqlDbType.Int)
                {
                    Direction = ParameterDirection.Output
                };
                SqlParameter respuesta = new SqlParameter("@respuesta", SqlDbType.VarChar, 1000)
                {
                    Direction = ParameterDirection.Output
                };
                cmd.Parameters.Add(numeroError);
                cmd.Parameters.Add(respuesta);
                cmd.CommandType = CommandType.StoredProcedure;

                try
                {
                    await con.OpenAsync();
                    await cmd.ExecuteNonQueryAsync();

                    return new RespuestaOperacion
                    {
                        NumeroError = Convert.ToInt32(numeroError.Value),
                        Respuesta = respuesta.Value?.ToString() ?? string.Empty
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
