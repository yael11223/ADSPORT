
using ADSPORT.Data;
using ADSPORT.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

namespace MiWebAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class LoginUsuarioController : ControllerBase
    {
        private readonly LoginUsuarioData _loginUsuarioData;

        // ========================================
        // CONSTRUCTOR
        // ========================================

        public LoginUsuarioController(
            LoginUsuarioData loginUsuarioData)
        {
            _loginUsuarioData = loginUsuarioData;
        }

        // ========================================
        // 1. INICIAR SESIÓN
        // ========================================

        [HttpPost("login")]
        [AllowAnonymous]
        public async Task<IActionResult> Login(
            [FromBody] LoginUsuario objeto)
        {
            // ========================================
            // VALIDAR DATOS OBLIGATORIOS
            // ========================================

            if (objeto == null ||
                string.IsNullOrWhiteSpace(objeto.Correo) ||
                string.IsNullOrWhiteSpace(objeto.Password))
            {
                return BadRequest(new
                {
                    isSuccess = false,
                    numeroError = 400,
                    respuesta = "Correo y contraseña obligatorios."
                });
            }

            // ========================================
            // CONSULTAR SQL SERVER Y VALIDAR BCRYPT
            // ========================================

            var resultado =
                await _loginUsuarioData.IniciarSesion(objeto);

            // ========================================
            // COMPROBAR RESULTADO
            // ========================================

            if (resultado.NumeroError != 200)
            {
                if (resultado.NumeroError == 500)
                {
                    return StatusCode(500, new
                    {
                        isSuccess = false,
                        numeroError = 500,
                        respuesta = "Error interno al iniciar sesión."
                    });
                }

                return Unauthorized(new
                {
                    isSuccess = false,
                    numeroError = 401,
                    respuesta = "Correo o contraseña incorrectos."
                });
            }

            // ========================================
            // CREAR IDENTIDAD DEL USUARIO
            // ========================================

            var claims = new List<Claim>
            {
                new Claim(
                    ClaimTypes.NameIdentifier,
                    resultado.IdUsuario.ToString()
                )
            };

            var identidad = new ClaimsIdentity(
                claims,
                CookieAuthenticationDefaults.AuthenticationScheme
            );

            var usuario = new ClaimsPrincipal(identidad);

            // ========================================
            // CREAR COOKIE DE AUTENTICACIÓN
            // ========================================

            await HttpContext.SignInAsync(
                CookieAuthenticationDefaults.AuthenticationScheme,
                usuario,
                new AuthenticationProperties
                {
                    IsPersistent = false,
                    AllowRefresh = true,
                    ExpiresUtc =
                        DateTimeOffset.UtcNow.AddHours(8)
                }
            );

            // ========================================
            // RESPUESTA EXITOSA
            // ========================================

            return Ok(new
            {
                isSuccess = true,
                numeroError = 0,
                respuesta = "Inicio de sesión correcto."
            });
        }

        // ========================================
        // 2. CONSULTAR SESIÓN DEL USUARIO
        // ========================================

        [HttpGet("sesion")]
        [AllowAnonymous]
        public IActionResult ConsultarSesion()
        {
            // Comprobar la identidad autenticada
            // mediante la cookie de ASP.NET Core.

            bool autenticado =
                User.Identity?.IsAuthenticated == true;

            if (!autenticado)
            {
                return Ok(new
                {
                    autenticado = false,
                    idUsuario = (string?)null
                });
            }

            // Obtener el ID del usuario autenticado.
            string? idUsuario = User.FindFirstValue(
                ClaimTypes.NameIdentifier
            );

            return Ok(new
            {
                autenticado = true,
                idUsuario = idUsuario
            });
        }

        // ========================================
        // 3. CERRAR SESIÓN DEL USUARIO
        // ========================================

        [HttpPost("logout")]
        [Authorize(
            AuthenticationSchemes =
                CookieAuthenticationDefaults.AuthenticationScheme
        )]
        public async Task<IActionResult> CerrarSesion()
        {
            // Eliminar la autenticación por cookie.

            await HttpContext.SignOutAsync(
                CookieAuthenticationDefaults.AuthenticationScheme
            );

            // Informar al frontend.

            return Ok(new
            {
                isSuccess = true,
                numeroError = 0,
                respuesta = "Sesión cerrada correctamente."
            });
        }
    }
}
