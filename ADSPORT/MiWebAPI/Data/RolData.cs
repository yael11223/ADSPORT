using ADSPORT.Models;
using System.Data;
using System.Data.SqlClient;

namespace ADSPORT.Data
{
    public class RolData
    {
        private readonly string _cadenaSQL;

        public RolData(IConfiguration configuration)
        {
            _cadenaSQL = configuration.GetConnectionString("CadenaSQL")!;
        }

        public async Task<List<Rol>> ObtenerRolesAsync()
        {
            var lista = new List<Rol>();

            using (var conexion = new SqlConnection(_cadenaSQL))
            {
                await conexion.OpenAsync();
                using (var comando = new SqlCommand("ROL_CONSULTA", conexion))
                {
                    comando.CommandType = CommandType.StoredProcedure;
                    using (var lector = await comando.ExecuteReaderAsync())
                    {
                        while (await lector.ReadAsync())
                        {
                            lista.Add(new Rol
                            {
                                IdRol = Convert.ToInt32(lector[0]),
                                NombreRol = lector[1]?.ToString() ?? ""
                            });
                        }
                    }
                }
            }
            return lista;
        }

        public async Task<Rol?> ObtenerRolPorIdAsync(int idRol)
        {
            Rol? objeto = null;

            using (var conexion = new SqlConnection(_cadenaSQL))
            {
                await conexion.OpenAsync();
                using (var comando = new SqlCommand("ROL_CONSULTA_BY_ID", conexion))
                {
                    comando.CommandType = CommandType.StoredProcedure;
                    comando.Parameters.AddWithValue("@IdRol", idRol);

                    using (var lector = await comando.ExecuteReaderAsync())
                    {
                        if (await lector.ReadAsync())
                        {
                            objeto = new Rol
                            {
                                IdRol = Convert.ToInt32(lector[0]),
                                NombreRol = lector[1]?.ToString() ?? ""
                            };
                        }
                    }
                }
            }
            return objeto;
        }

        public async Task<(bool esExito, string mensaje)> RegistrarRolAsync(Rol objeto)
        {
            using (var conexion = new SqlConnection(_cadenaSQL))
            {
                await conexion.OpenAsync();
                using (var comando = new SqlCommand("ROL_REGISTRAR", conexion))
                {
                    comando.CommandType = CommandType.StoredProcedure;
                    comando.Parameters.AddWithValue("@NombreRol", objeto.NombreRol);

                    var paramResultado = comando.Parameters.Add("@Resultado", SqlDbType.Bit);
                    paramResultado.Direction = ParameterDirection.Output;

                    var paramMensaje = comando.Parameters.Add("@Mensaje", SqlDbType.VarChar, 500);
                    paramMensaje.Direction = ParameterDirection.Output;

                    await comando.ExecuteNonQueryAsync();

                    bool esExito = Convert.ToBoolean(paramResultado.Value);
                    string mensaje = paramMensaje.Value?.ToString() ?? "";

                    return (esExito, mensaje);
                }
            }
        }

        public async Task<(bool esExito, string mensaje)> ActualizarRolAsync(Rol objeto)
        {
            using (var conexion = new SqlConnection(_cadenaSQL))
            {
                await conexion.OpenAsync();
                using (var comando = new SqlCommand("ROL_ACTUALIZA", conexion))
                {
                    comando.CommandType = CommandType.StoredProcedure;
                    comando.Parameters.AddWithValue("@IdRol", objeto.IdRol);
                    comando.Parameters.AddWithValue("@NombreRol", objeto.NombreRol);

                    var paramResultado = comando.Parameters.Add("@Resultado", SqlDbType.Bit);
                    paramResultado.Direction = ParameterDirection.Output;

                    var paramMensaje = comando.Parameters.Add("@Mensaje", SqlDbType.VarChar, 500);
                    paramMensaje.Direction = ParameterDirection.Output;

                    await comando.ExecuteNonQueryAsync();

                    bool esExito = Convert.ToBoolean(paramResultado.Value);
                    string mensaje = paramMensaje.Value?.ToString() ?? "";

                    return (esExito, mensaje);
                }
            }
        }

        public async Task<(bool esExito, string mensaje)> EliminarRolAsync(int idRol)
        {
            using (var conexion = new SqlConnection(_cadenaSQL))
            {
                await conexion.OpenAsync();
                using (var comando = new SqlCommand("ROL_ELIMINA", conexion))
                {
                    comando.CommandType = CommandType.StoredProcedure;
                    comando.Parameters.AddWithValue("@IdRol", idRol);

                    var paramResultado = comando.Parameters.Add("@Resultado", SqlDbType.Bit);
                    paramResultado.Direction = ParameterDirection.Output;

                    var paramMensaje = comando.Parameters.Add("@Mensaje", SqlDbType.VarChar, 500);
                    paramMensaje.Direction = ParameterDirection.Output;

                    await comando.ExecuteNonQueryAsync();

                    bool esExito = Convert.ToBoolean(paramResultado.Value);
                    string mensaje = paramMensaje.Value?.ToString() ?? "";

                    return (esExito, mensaje);
                }
            }
        }
    }
}