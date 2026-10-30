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
                SqlCommand cmd = new SqlCommand("USUARIO_LISTA", con)
                {
                    CommandType = CommandType.StoredProcedure
                };

                using (var reader = await cmd.ExecuteReaderAsync())
                {
                    while (await reader.ReadAsync())
                    {
                        lista.Add(new Usuario
                        {
                            IdUsuario = Convert.ToInt32(reader[0]),
                            IdRol = Convert.ToInt32(reader[1]),
                            NombreRol = reader[2]?.ToString(),
                            Nombre = reader[3]?.ToString(),
                            ApellidoPaterno = reader[4]?.ToString(),
                            ApellidoMaterno = reader[5]?.ToString(),
                            Correo = reader[6]?.ToString(),
                            Telefono = Convert.ToInt64(reader[7]),
                            Estatus = reader[8]?.ToString(),
                            CodigoQr = reader[9]?.ToString(),
                            FechaUltimaModificacion = reader[10]?.ToString()
                        });
                    }
                }
            }
            return lista;
        }

        public async Task<Usuario?> Obtener(int Id)
        {
            Usuario? objeto = null;

            using (var con = new SqlConnection(conexion))
            {
                await con.OpenAsync();
                SqlCommand cmd = new SqlCommand("USUARIO_BUSCAR_POR_ID", con)
                {
                    CommandType = CommandType.StoredProcedure
                };
                cmd.Parameters.AddWithValue("@id_usuario", Id);

                using (var reader = await cmd.ExecuteReaderAsync())
                {
                    if (await reader.ReadAsync())
                    {
                        objeto = new Usuario
                        {
                            IdUsuario = Convert.ToInt32(reader[0]),
                            IdRol = Convert.ToInt32(reader[1]),
                            Nombre = reader[2]?.ToString(),
                            ApellidoPaterno = reader[3]?.ToString(),
                            ApellidoMaterno = reader[4]?.ToString(),
                            Correo = reader[5]?.ToString(),
                            Telefono = Convert.ToInt64(reader[6]),
                            Estatus = reader[7]?.ToString(),
                            CodigoQr = reader[8]?.ToString(),
                            FechaUltimaModificacion = reader[9]?.ToString()
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
                SqlCommand cmd = new SqlCommand("USUARIO_AGREGA", con)
                {
                    CommandType = CommandType.StoredProcedure
                };
                cmd.Parameters.AddWithValue("@id_rol", objeto.IdRol);
                cmd.Parameters.AddWithValue("@nombre", objeto.Nombre);
                cmd.Parameters.AddWithValue("@apellido_paterno", objeto.ApellidoPaterno);
                cmd.Parameters.AddWithValue("@apellido_materno", objeto.ApellidoMaterno);
                cmd.Parameters.AddWithValue("@correo", objeto.Correo);
                cmd.Parameters.AddWithValue("@telefono", objeto.Telefono);
                cmd.Parameters.AddWithValue("@estatus", objeto.Estatus);
                cmd.Parameters.AddWithValue("@codigo_qr", objeto.CodigoQr ?? string.Empty);

                SqlParameter numeroError = new SqlParameter("@numeroError", SqlDbType.Int) { Direction = ParameterDirection.Output };
                SqlParameter respuesta = new SqlParameter("@respuesta", SqlDbType.VarChar, 1000) { Direction = ParameterDirection.Output };

                cmd.Parameters.Add(numeroError);
                cmd.Parameters.Add(respuesta);

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
                SqlCommand cmd = new SqlCommand("USUARIO_ACTUALIZA", con)
                {
                    CommandType = CommandType.StoredProcedure
                };
                cmd.Parameters.AddWithValue("@id_usuario", objeto.IdUsuario);
                cmd.Parameters.AddWithValue("@id_rol", objeto.IdRol);
                cmd.Parameters.AddWithValue("@nombre", objeto.Nombre);
                cmd.Parameters.AddWithValue("@apellido_paterno", objeto.ApellidoPaterno);
                cmd.Parameters.AddWithValue("@apellido_materno", objeto.ApellidoMaterno);
                cmd.Parameters.AddWithValue("@correo", objeto.Correo);
                cmd.Parameters.AddWithValue("@telefono", objeto.Telefono);
                cmd.Parameters.AddWithValue("@estatus", objeto.Estatus);
                cmd.Parameters.AddWithValue("@codigo_qr", objeto.CodigoQr ?? string.Empty);

                SqlParameter numeroError = new SqlParameter("@numeroError", SqlDbType.Int) { Direction = ParameterDirection.Output };
                SqlParameter respuesta = new SqlParameter("@respuesta", SqlDbType.VarChar, 1000) { Direction = ParameterDirection.Output };

                cmd.Parameters.Add(numeroError);
                cmd.Parameters.Add(respuesta);

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
                // Nombre corregido según SQL Server: USUARIO_ELIMINA
                SqlCommand cmd = new SqlCommand("USUARIO_ELIMINA", con)
                {
                    CommandType = CommandType.StoredProcedure
                };
                cmd.Parameters.AddWithValue("@id_usuario", id);

                SqlParameter numeroError = new SqlParameter("@numeroError", SqlDbType.Int) { Direction = ParameterDirection.Output };
                SqlParameter respuesta = new SqlParameter("@respuesta", SqlDbType.VarChar, 1000) { Direction = ParameterDirection.Output };

                cmd.Parameters.Add(numeroError);
                cmd.Parameters.Add(respuesta);

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