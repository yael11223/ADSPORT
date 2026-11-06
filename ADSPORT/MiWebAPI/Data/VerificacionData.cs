
using ADSPORT.Models;
using MiWebAPI.Models;
using System.Data;
using System.Data.SqlClient;

namespace ADSPORT.Data
{
    public class VerificacionData
    {
        private readonly string conexion;

        public VerificacionData(IConfiguration configuration)
        {
            conexion = configuration.GetConnectionString("CadenaSQL")!;
        }

        // ========================================
        // 1. AGREGAR CÓDIGO DE VERIFICACIÓN
        // ========================================

        public async Task<RespuestaOperacion> Agregar(Verificacion objeto)
        {
            using (var con = new SqlConnection(conexion))
            {
                SqlCommand cmd = new SqlCommand("CODIGO_VERIFICACION_AGREGAR", con)
                {
                    CommandType = CommandType.StoredProcedure
                };

                cmd.Parameters.Add("@CORREO", SqlDbType.VarChar, 150).Value =
                    (object?)objeto.Correo ?? DBNull.Value;

                cmd.Parameters.Add("@CODIGO_HASH", SqlDbType.VarChar, 255).Value =
                    (object?)objeto.CodigoHash ?? DBNull.Value;

                try
                {
                    await con.OpenAsync();

                    using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        if (await reader.ReadAsync())
                        {
                            return new RespuestaOperacion
                            {
                                NumeroError = Convert.ToInt32(reader["CODIGO_RESPUESTA"]),
                                Respuesta = reader["MENSAJE"]?.ToString() ?? string.Empty
                            };
                        }
                    }

                    return new RespuestaOperacion
                    {
                        NumeroError = -1,
                        Respuesta = "No se recibió una respuesta del procedimiento."
                    };
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine(ex);

                    return new RespuestaOperacion
                    {
                        NumeroError = -1,
                        Respuesta = "Error al registrar el código de verificación."
                    };
                }
            }
        }

        // ========================================
        // 2. VALIDAR CÓDIGO DE VERIFICACIÓN
        // ========================================

        public async Task<RespuestaOperacion> Validar(Verificacion objeto)
        {
            using (var con = new SqlConnection(conexion))
            {
                SqlCommand cmd = new SqlCommand("CODIGO_VERIFICACION_VALIDAR", con)
                {
                    CommandType = CommandType.StoredProcedure
                };

                cmd.Parameters.Add("@CORREO", SqlDbType.VarChar, 150).Value =
                    (object?)objeto.Correo ?? DBNull.Value;

                cmd.Parameters.Add("@CODIGO_HASH", SqlDbType.VarChar, 255).Value =
                    (object?)objeto.CodigoHash ?? DBNull.Value;

                try
                {
                    await con.OpenAsync();

                    using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        if (await reader.ReadAsync())
                        {
                            return new RespuestaOperacion
                            {
                                NumeroError = Convert.ToInt32(reader["CODIGO_RESPUESTA"]),
                                Respuesta = reader["MENSAJE"]?.ToString() ?? string.Empty
                            };
                        }
                    }

                    return new RespuestaOperacion
                    {
                        NumeroError = -1,
                        Respuesta = "No se recibió una respuesta del procedimiento."
                    };
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine(ex);

                    return new RespuestaOperacion
                    {
                        NumeroError = -1,
                        Respuesta = "Error al validar el código de verificación."
                    };
                }
            }
        }

        // ========================================
        // 3. COMPROBAR REENVÍO DE CÓDIGO
        // ========================================

        public async Task<RespuestaOperacion> Reenviar(string correo)
        {
            using (var con = new SqlConnection(conexion))
            {
                SqlCommand cmd = new SqlCommand("CODIGO_VERIFICACION_REENVIAR", con)
                {
                    CommandType = CommandType.StoredProcedure
                };

                cmd.Parameters.Add("@CORREO", SqlDbType.VarChar, 150).Value =
                    (object?)correo ?? DBNull.Value;

                try
                {
                    await con.OpenAsync();

                    using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        if (await reader.ReadAsync())
                        {
                            return new RespuestaOperacion
                            {
                                NumeroError = Convert.ToInt32(reader["CODIGO_RESPUESTA"]),
                                Respuesta = reader["MENSAJE"]?.ToString() ?? string.Empty
                            };
                        }
                    }

                    return new RespuestaOperacion
                    {
                        NumeroError = -1,
                        Respuesta = "No se recibió una respuesta del procedimiento."
                    };
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine(ex);

                    return new RespuestaOperacion
                    {
                        NumeroError = -1,
                        Respuesta = "Error al comprobar el reenvío del código."
                    };
                }
            }
        }

        // ========================================
        // 4. CONSULTAR CORREO VERIFICADO
        // ========================================

        public async Task<RespuestaOperacion> ConsultarVerificacion(string correo)
        {
            using (var con = new SqlConnection(conexion))
            {
                SqlCommand cmd = new SqlCommand("USUARIO_CORREO_VERIFICADO", con)
                {
                    CommandType = CommandType.StoredProcedure
                };

                cmd.Parameters.Add("@CORREO", SqlDbType.VarChar, 150).Value =
                    (object?)correo ?? DBNull.Value;

                try
                {
                    await con.OpenAsync();

                    using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        if (await reader.ReadAsync())
                        {
                            return new RespuestaOperacion
                            {
                                NumeroError = Convert.ToInt32(reader["CODIGO_RESPUESTA"]),
                                Respuesta = reader["MENSAJE"]?.ToString() ?? string.Empty
                            };
                        }
                    }

                    return new RespuestaOperacion
                    {
                        NumeroError = -1,
                        Respuesta = "No se recibió una respuesta del procedimiento."
                    };
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine(ex);

                    return new RespuestaOperacion
                    {
                        NumeroError = -1,
                        Respuesta = "Error al consultar la verificación del correo."
                    };
                }
            }
        }

        // ========================================
        // 5. REGISTRAR NUEVO USUARIO CLIENTE
        // ========================================

        public async Task<RespuestaOperacion> RegistrarCliente(
            UsuarioCliente objeto,
            string passwordHash)
        {
            using (var con = new SqlConnection(conexion))
            {
                SqlCommand cmd = new SqlCommand("NUEVO_USUARIO_AGREGA", con)
                {
                    CommandType = CommandType.StoredProcedure
                };

                // ========================================
                // DATOS OBLIGATORIOS
                // ========================================

                cmd.Parameters.Add("@NOMBRE", SqlDbType.VarChar, 100).Value =
                    (object?)objeto.Nombre?.Trim() ?? DBNull.Value;

                cmd.Parameters.Add("@APELLIDO_PATERNO", SqlDbType.VarChar, 100).Value =
                    (object?)objeto.ApellidoPaterno?.Trim() ?? DBNull.Value;

                cmd.Parameters.Add("@CORREO", SqlDbType.VarChar, 100).Value =
                    (object?)objeto.Correo?.Trim().ToLowerInvariant() ?? DBNull.Value;

                // La contraseña debe venir cifrada con BCrypt desde el controlador
                cmd.Parameters.Add("@PASSWORD_HASH", SqlDbType.VarChar, 60).Value =
                    (object?)passwordHash ?? DBNull.Value;

                // ========================================
                // DATOS OPCIONALES
                // ========================================

                cmd.Parameters.Add("@APELLIDO_MATERNO", SqlDbType.VarChar, 100).Value =
                    string.IsNullOrWhiteSpace(objeto.ApellidoMaterno)
                        ? DBNull.Value
                        : objeto.ApellidoMaterno.Trim();

                cmd.Parameters.Add("@TELEFONO", SqlDbType.VarChar, 100).Value =
                    string.IsNullOrWhiteSpace(objeto.Telefono)
                        ? DBNull.Value
                        : objeto.Telefono.Trim();

                // ========================================
                // EJECUTAR STORED PROCEDURE
                // ========================================

                try
                {
                    await con.OpenAsync();

                    using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        if (await reader.ReadAsync())
                        {
                            return new RespuestaOperacion
                            {
                                NumeroError = Convert.ToInt32(
                                    reader["CODIGO_RESPUESTA"]
                                ),

                                Respuesta =
                                    reader["MENSAJE"]?.ToString()
                                    ?? string.Empty
                            };
                        }
                    }

                    return new RespuestaOperacion
                    {
                        NumeroError = -1,
                        Respuesta = "No se recibió una respuesta del procedimiento."
                    };
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine(ex);

                    return new RespuestaOperacion
                    {
                        NumeroError = -1,
                        Respuesta = "Error al registrar el nuevo usuario."
                    };
                }
            }
        }

    }
}
