using ADSPORT.Models;
using MiWebAPI.Models;
using System.Data;
using System.Data.SqlClient;

namespace ADSPORT.Data
{
    public class DeporteData
    {
        private readonly string conexion;

        public DeporteData(IConfiguration configuration)
        {
            conexion = configuration.GetConnectionString("CadenaSQL")!;
        }

        // 1. LISTAR DEPORTES
        public async Task<List<Deporte>> Lista()
        {
            List<Deporte> lista = new List<Deporte>();

            using (var con = new SqlConnection(conexion))
            {
                await con.OpenAsync();
                using var cmd = new SqlCommand("DEPORTE_LISTA", con)
                {
                    CommandType = CommandType.StoredProcedure
                };

                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    lista.Add(new Deporte
                    {
                        IdDeporte = Convert.ToInt32(reader["ID_DEPORTE"]),
                        NombreDeporte = reader["NOMBRE_DEPORTE"]?.ToString() ?? string.Empty,
                        Descripcion = reader["DESCRIPCION"]?.ToString(),
                        FechaUltimaModificacion = reader["FECHA_UTIMA_MODIFICACION"]?.ToString()
                    });
                }
            }

            return lista;
        }

        // 2. OBTENER DEPORTE POR ID
        public async Task<Deporte?> Obtener(int id)
        {
            Deporte? objeto = null;

            using (var con = new SqlConnection(conexion))
            {
                await con.OpenAsync();
                using var cmd = new SqlCommand("DEPORTE_BUSCAR_POR_ID", con)
                {
                    CommandType = CommandType.StoredProcedure
                };

                cmd.Parameters.Add("@id_deporte", SqlDbType.BigInt).Value = id;

                using var reader = await cmd.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    objeto = new Deporte
                    {
                        IdDeporte = Convert.ToInt32(reader["ID_DEPORTE"]),
                        NombreDeporte = reader["NOMBRE_DEPORTE"]?.ToString() ?? string.Empty,
                        Descripcion = reader["DESCRIPCION"]?.ToString(),
                        FechaUltimaModificacion = reader["FECHA_UTIMA_MODIFICACION"]?.ToString()
                    };
                }
            }

            return objeto;
        }

        // 3. CREAR DEPORTE
        public async Task<RespuestaOperacion> Crear(Deporte objeto)
        {
            using (var con = new SqlConnection(conexion))
            {
                using var cmd = new SqlCommand("DEPORTE_AGREGAR", con)
                {
                    CommandType = CommandType.StoredProcedure
                };

                cmd.Parameters.AddWithValue("@nombre_deporte", objeto.NombreDeporte);
                cmd.Parameters.AddWithValue("@descripcion", (object?)objeto.Descripcion ?? DBNull.Value);

                var numeroError = new SqlParameter("@numeroError", SqlDbType.Int)
                {
                    Direction = ParameterDirection.Output
                };
                var respuesta = new SqlParameter("@respuesta", SqlDbType.VarChar, 1000)
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

        // 4. EDITAR DEPORTE
        public async Task<RespuestaOperacion> Editar(Deporte objeto)
        {
            using (var con = new SqlConnection(conexion))
            {
                using var cmd = new SqlCommand("DEPORTE_ACTUALIZA", con)
                {
                    CommandType = CommandType.StoredProcedure
                };

                cmd.Parameters.Add("@id_deporte", SqlDbType.BigInt).Value = objeto.IdDeporte;
                cmd.Parameters.AddWithValue("@nombre_deporte", objeto.NombreDeporte);
                cmd.Parameters.AddWithValue("@descripcion", (object?)objeto.Descripcion ?? DBNull.Value);

                var numeroError = new SqlParameter("@numeroError", SqlDbType.Int)
                {
                    Direction = ParameterDirection.Output
                };
                var respuesta = new SqlParameter("@respuesta", SqlDbType.VarChar, 1000)
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

        // 5. ELIMINAR DEPORTE
        public async Task<RespuestaOperacion> Eliminar(int id)
        {
            using (var con = new SqlConnection(conexion))
            {
                using var cmd = new SqlCommand("DEPORTE_ELIMINA", con)
                {
                    CommandType = CommandType.StoredProcedure
                };

                cmd.Parameters.Add("@id_deporte", SqlDbType.BigInt).Value = id;

                var numeroError = new SqlParameter("@numeroError", SqlDbType.Int)
                {
                    Direction = ParameterDirection.Output
                };
                var respuesta = new SqlParameter("@respuesta", SqlDbType.VarChar, 1000)
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