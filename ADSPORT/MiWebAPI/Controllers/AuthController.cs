using Microsoft.AspNetCore.Mvc;
using MiWebAPI.Models;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using ADSPORT.Data;
using ADSPORT.Models;
using ADSPORT.Security;

namespace MiWebAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly LoginUsuarioData _login;
        private readonly IEntrenadorCuentaData _cuentas;

        public AuthController(LoginUsuarioData login,IEntrenadorCuentaData cuentas)
        {
            _login=login;
            _cuentas=cuentas;
        }

        [HttpGet("csrf")]
        public IActionResult Csrf([FromServices] IAntiforgery antiforgery)
        {
            Response.Headers.CacheControl = "no-store";
            return Ok(new { token = antiforgery.GetAndStoreTokens(HttpContext).RequestToken });
        }

        [HttpGet("sesion")]
        public async Task<IActionResult> Sesion()
        {
            var cuenta=User.Identity?.IsAuthenticated==true && User.HasClaim("ADSPORT.Administrador","true")
                && long.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier),out var id) ? await _cuentas.ObtenerAsync(id) : null;
            return Ok(new { autenticado=cuenta?.EsAdministradorActivo==true,
                nombre=cuenta?.EsAdministradorActivo==true ? cuenta.NombreCompleto : null });
        }

        [HttpPost("logout")]
        [Authorize(Policy = "SoloAdministrador")]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Logout()
        {
            await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Ok(new { isSuccess = true });
        }

        [HttpPost("login")]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            var inicio=DateTime.UtcNow;
            var resultado=await _login.IniciarSesion(new LoginUsuario { Correo=request.Correo,Password=request.Password });
            if (resultado.NumeroError==500)
                return StatusCode(503,new { isSuccess=false,numeroError=503,respuesta="No fue posible consultar la cuenta administrativa." });
            if (resultado.NumeroError!=200)
            {
                return Unauthorized(new
                {
                    isSuccess = false,
                    numeroError = 401,
                    respuesta = "Correo o contraseña incorrectos"
                });
            }
            var cuenta=await _cuentas.ObtenerAsync(resultado.IdUsuario);
            if (cuenta?.EsAdministradorActivo!=true)
                return StatusCode(403,new { isSuccess=false,numeroError=403,respuesta="Este acceso requiere una cuenta de administrador activa." });

            var identidad = new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier,cuenta.IdUsuario.ToString(System.Globalization.CultureInfo.InvariantCulture)),
                new Claim(ClaimTypes.Name,cuenta.NombreCompleto),
                new Claim(ClaimTypes.Role,cuenta.NombreRol.Trim().ToUpperInvariant()),
                new Claim("ADSPORT.Administrador", "true"),
                new Claim("ADSPORT.Acceso","ADMINISTRADOR"),
                SesionRecuperacionPassword.CrearClaim(inicio)
            }, CookieAuthenticationDefaults.AuthenticationScheme);
            await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme,
                new ClaimsPrincipal(identidad), new AuthenticationProperties
                {
                    IsPersistent = false,
                    ExpiresUtc = DateTimeOffset.UtcNow.AddHours(8)
                });

            return Ok(new
            {
                isSuccess = true,
                numeroError = 0,
                respuesta = "Inicio de sesión correcto",
                usuario = new
                {
                    nombre = cuenta.NombreCompleto,
                    correo = cuenta.Correo
                }
            });
        }
    }
}
