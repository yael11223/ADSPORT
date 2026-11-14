using ADSPORT.Models;
using MiWebAPI.Models;
using System.Data;
using System.Data.SqlClient;

namespace ADSPORT.Data
{
    public class ClaseData
    {
        private readonly string conexion;

        public ClaseData(IConfiguration configuration)
        {
            conexion = configuration.GetConnectionString("CadenaSQL")!;
        }

        // 1. LISTAR CLASES POR DEPORTE (Para la vista pública)
        public async Task<List<Clase>> ListaPorDeporte(long idDeporte)
        {
            List<Clase> lista = new List<Clase>();

            using (var con = new SqlConnection(conexion))
            {
                await con.OpenAsync();
                using var cmd = new SqlCommand("CLASE_LISTA_POR_DEPORTE", con)
                {
                    CommandType = CommandType.StoredProcedure
                };

                cmd.Parameters.Add("@id_deporte", SqlDbType.BigInt).Value = idDeporte;

                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    lista.Add(new Clase
                    {
                        IdClase = Convert.ToInt64(reader["ID_CLASE"]),
                        IdDeporte = Convert.ToInt64(reader["ID_DEPORTE"]),
                        NombreDeporte = reader["NOMBRE_DEPORTE"]?.ToString() ?? string.Empty,
                        IdEntrenador = Convert.ToInt64(reader["ID_ENTRENADOR"]),
                        NombreEntrenador = reader["NOMBRE_ENTRENADOR"]?.ToString() ?? string.Empty,
                        CorreoEntrenador = reader["CORREO_ENTRENADOR"]?.ToString(),
                        TieneFoto = Convert.ToInt32(reader["TIENE_FOTO"]) == 1,
                        NombreClase = reader["NOMBRE_CLASE"]?.ToString() ?? string.Empty,
                        Precio = reader["PRECIO"] != DBNull.Value ? Convert.ToDecimal(reader["PRECIO"]) : 0,
                        CupoMaximo = reader["CUPO_MAXIMO"] != DBNull.Value ? Convert.ToInt32(reader["CUPO_MAXIMO"]) : 0,
                        IdHorario = reader["ID_HORARIO"] != DBNull.Value ? Convert.ToInt64(reader["ID_HORARIO"]) : null,
                        DiaSemana = reader["DIA_SEMANA"] != DBNull.Value ? Convert.ToDateTime(reader["DIA_SEMANA"]) : null,
                        HoraInicio = reader["HORA_INICIO"]?.ToString(),
                        HoraFin = reader["HORA_FIN"]?.ToString(),
                        Cancha = reader["CANCHA"]?.ToString()
                    });
                }
            }

            return lista;
        }

        // 2. LISTAR CLASES POR ENTRENADOR (Para el panel del entrenador)
        public async Task<List<Clase>> ListaPorEntrenador(long idEntrenador)
        {
            List<Clase> lista = new List<Clase>();

            using (var con = new SqlConnection(conexion))
            {
                await con.OpenAsync();
                using var cmd = new SqlCommand("CLASE_LISTA_POR_ENTRENADOR", con)
                {
                    CommandType = CommandType.StoredProcedure
                };

                cmd.Parameters.Add("@id_entrenador", SqlDbType.BigInt).Value = idEntrenador;

                using var reader = await cmd.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    lista.Add(new Clase
                    {
                        IdClase = Convert.ToInt64(reader["ID_CLASE"]),
                        IdDeporte = Convert.ToInt64(reader["ID_DEPORTE"]),
                        NombreDeporte = reader["NOMBRE_DEPORTE"]?.ToString() ?? string.Empty,
                        IdEntrenador = idEntrenador,
                        NombreClase = reader["NOMBRE_CLASE"]?.ToString() ?? string.Empty,
                        Precio = reader["PRECIO"] != DBNull.Value ? Convert.ToDecimal(reader["PRECIO"]) : 0,
                        CupoMaximo = reader["CUPO_MAXIMO"] != DBNull.Value ? Convert.ToInt32(reader["CUPO_MAXIMO"]) : 0,
                        IdHorario = reader["ID_HORARIO"] != DBNull.Value ? Convert.ToInt64(reader["ID_HORARIO"]) : null,
                        DiaSemana = reader["DIA_SEMANA"] != DBNull.Value ? Convert.ToDateTime(reader["DIA_SEMANA"]) : null,
                        HoraInicio = reader["HORA_INICIO"]?.ToString(),
                        HoraFin = reader["HORA_FIN"]?.ToString(),
                        Cancha = reader["CANCHA"]?.ToString()
                    });
                }
            }

            return lista;
        }

        // 3. CREAR CLASE CON HORARIO
        public async Task<RespuestaOperacion> Crear(Clase objeto)
        {
            using (var con = new SqlConnection(conexion))
            {
                using var cmd = new SqlCommand("CLASE_AGREGA", con)
                {
                    CommandType = CommandType.StoredProcedure
                };

                cmd.Parameters.Add("@id_deporte", SqlDbType.BigInt).Value = objeto.IdDeporte;
                cmd.Parameters.Add("@id_entrenador", SqlDbType.BigInt).Value = objeto.IdEntrenador;
                cmd.Parameters.AddWithValue("@nombre_clase", objeto.NombreClase);
                cmd.Parameters.Add("@precio", SqlDbType.Decimal).Value = objeto.Precio;
                cmd.Parameters.Add("@cupo_maximo", SqlDbType.Int).Value = objeto.CupoMaximo;
                cmd.Parameters.Add("@dia_semana", SqlDbType.DateTime).Value = objeto.DiaSemana ?? DateTime.Today;
                cmd.Parameters.Add("@hora_inicio", SqlDbType.Time).Value = TimeSpan.Parse(objeto.HoraInicio ?? "09:00");
                cmd.Parameters.Add("@hora_fin", SqlDbType.Time).Value = TimeSpan.Parse(objeto.HoraFin ?? "10:00");
                cmd.Parameters.AddWithValue("@cancha", (object?)objeto.Cancha ?? DBNull.Value);

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

        // 4. ELIMINAR CLASE
        public async Task<RespuestaOperacion> Eliminar(long idClase)
        {
            using (var con = new SqlConnection(conexion))
            {
                using var cmd = new SqlCommand("CLASE_ELIMINA", con)
                {
                    CommandType = CommandType.StoredProcedure
                };

                cmd.Parameters.Add("@id_clase", SqlDbType.BigInt).Value = idClase;

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