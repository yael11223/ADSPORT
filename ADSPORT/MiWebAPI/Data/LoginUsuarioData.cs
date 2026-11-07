
using ADSPORT.Models;
using System.Data;
using System.Data.SqlClient;

namespace ADSPORT.Data
{
    public class LoginUsuarioData
    {
        private readonly string _cadenaSQL;

        // ========================================
        // CONSTRUCTOR
        // ========================================

        public LoginUsuarioData(IConfiguration configuration)
        {
            _cadenaSQL = configuration
                .GetConnectionString("CadenaSQL")!;
        }

        // ========================================
        // 1. VALIDAR INICIO DE SESIÓN
        // ========================================

        public async Task<(
            int NumeroError,
            string Respuesta,
            long IdUsuario
        )> IniciarSesion(LoginUsuario objeto)
        {
            if (string.IsNullOrWhiteSpace(objeto.Correo) ||
                string.IsNullOrWhiteSpace(objeto.Password))
            {
                return (400, "Correo y contraseña obligatorios.", 0);
            }

            try
            {
                using (var con = new SqlConnection(_cadenaSQL))
                {
                    using (var cmd = new SqlCommand(
                        "USUARIO_LOGIN_OBTENER", con))
                    {
                        cmd.CommandType = CommandType.StoredProcedure;

                        cmd.Parameters.Add(
                            "@CORREO",
                            SqlDbType.VarChar,
                            100
                        ).Value = objeto.Correo.Trim().ToLowerInvariant();

                        await con.OpenAsync();

                        using (var reader = await cmd.ExecuteReaderAsync())
                        {
                            if (!await reader.ReadAsync())
                            {
                                return (
                                    401,
                                    "Correo o contraseña incorrectos.",
                                    0
                                );
                            }

                            int codigo = Convert.ToInt32(
                                reader["CODIGO_RESPUESTA"]
                            );

                            if (codigo != 200)
                            {
                                if (codigo == 401 || codigo == 403)
                                {
                                    return (
                                        401,
                                        "Correo o contraseña incorrectos.",
                                        0
                                    );
                                }

                                return (
                                    codigo,
                                    reader["MENSAJE"]?.ToString()
                                        ?? "Error al iniciar sesión.",
                                    0
                                );
                            }

                            long idUsuario = Convert.ToInt64(
                                reader["ID_USUARIO"]
                            );

                            string passwordHash =
                                reader["PASSWORD_HASH"]?.ToString()
                                ?? string.Empty;

                            if (string.IsNullOrWhiteSpace(passwordHash))
                            {
                                return (
                                    401,
                                    "Correo o contraseña incorrectos.",
                                    0
                                );
                            }

                            // ========================================
                            // COMPROBAR CONTRASEÑA CON BCRYPT
                            // ========================================

                            bool passwordCorrecta =
                                BCrypt.Net.BCrypt.Verify(
                                    objeto.Password,
                                    passwordHash
                                );

                            if (!passwordCorrecta)
                            {
                                return (
                                    401,
                                    "Correo o contraseña incorrectos.",
                                    0
                                );
                            }

                            // ========================================
                            // LOGIN CORRECTO
                            // ========================================

                            return (
                                200,
                                "Inicio de sesión correcto.",
                                idUsuario
                            );
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine(ex);

                return (
                    500,
                    "Error interno al iniciar sesión.",
                    0
                );
            }
        }
    }
}
