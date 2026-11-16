using Microsoft.AspNetCore.Mvc;
using MiWebAPI.Models;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

namespace MiWebAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly IConfiguration _configuration;

        public AuthController(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        [HttpGet("csrf")]
        public IActionResult Csrf([FromServices] IAntiforgery antiforgery)
        {
            Response.Headers.CacheControl = "no-store";
            return Ok(new { token = antiforgery.GetAndStoreTokens(HttpContext).RequestToken });
        }

        [HttpGet("sesion")]
        public IActionResult Sesion() => Ok(new
        {
            autenticado = User.Identity?.IsAuthenticated == true &&
                User.HasClaim("ADSPORT.Administrador", "true")
        });

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
            string correoConfigurado = _configuration["DemoLogin:Correo"] ?? string.Empty;
            string passwordConfigurado = _configuration["DemoLogin:Password"] ?? string.Empty;
            string nombreConfigurado = _configuration["DemoLogin:Nombre"] ?? "Usuario";

            bool credencialesCorrectas =
                !string.IsNullOrWhiteSpace(correoConfigurado) &&
                !string.IsNullOrWhiteSpace(passwordConfigurado) &&
                string.Equals(request.Correo, correoConfigurado, StringComparison.OrdinalIgnoreCase) &&
                request.Password == passwordConfigurado;

            if (!credencialesCorrectas)
            {
                return Unauthorized(new
                {
                    isSuccess = false,
                    numeroError = 401,
                    respuesta = "Correo o contraseña incorrectos"
                });
            }

            var identidad = new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, "administrador-demo"),
                new Claim(ClaimTypes.Name, nombreConfigurado),
                new Claim("ADSPORT.Administrador", "true")
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
                    nombre = nombreConfigurado,
                    correo = correoConfigurado
                }
            });
        }
    }
}
