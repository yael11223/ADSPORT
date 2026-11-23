using ADSPORT.Data;
using ADSPORT.Models;
using ADSPORT.Security;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Globalization;
using System.Security.Claims;

namespace ADSPORT.Controllers;

[ApiController]
[Route("api/Entrenador")]
[Authorize(Policy = "SoloEntrenador")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class EntrenadorController : ControllerBase
{
    private readonly LoginUsuarioData _login;
    private readonly IEntrenadorCuentaData _datos;
    private readonly ILogger<EntrenadorController> _logger;

    public EntrenadorController(LoginUsuarioData login, IEntrenadorCuentaData datos,
        ILogger<EntrenadorController> logger)
    {
        _login = login;
        _datos = datos;
        _logger = logger;
    }

    [HttpGet("csrf")]
    [AllowAnonymous]
    public IActionResult Csrf([FromServices] IAntiforgery antiforgery)
    {
        var tokens = antiforgery.GetAndStoreTokens(HttpContext);
        return Ok(new { token = tokens.RequestToken });
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Login(LoginEntrenadorRequest request)
    {
        if (System.Text.Encoding.UTF8.GetByteCount(request.Password) > 72)
            return Unauthorized(Error("Correo o contraseña incorrectos.", 401));

        try
        {
            var inicioSesion = DateTime.UtcNow;
            var resultado = await _login.IniciarSesion(new LoginUsuario
            {
                Correo = request.Correo,
                Password = request.Password
            });
            if (resultado.NumeroError == 500) return ErrorBaseDatos();
            if (resultado.NumeroError != 200)
                return Unauthorized(Error("Correo o contraseña incorrectos.", 401));

            var cuenta = await _datos.ObtenerAsync(resultado.IdUsuario);
            if (cuenta?.EsEntrenadorActivo != true)
                return StatusCode(403, Error("Este acceso requiere una cuenta de entrenador activa.", 403));

            var identidad = new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, cuenta.IdUsuario.ToString(CultureInfo.InvariantCulture)),
                new Claim(ClaimTypes.Name, cuenta.NombreCompleto),
                new Claim(ClaimTypes.Role, "ENTRENADOR"),
                SesionRecuperacionPassword.CrearClaim(inicioSesion)
            }, CookieAuthenticationDefaults.AuthenticationScheme);

            // No trasladar claims administrativos ni permisos de una sesión anterior.
            await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme,
                new ClaimsPrincipal(identidad), new AuthenticationProperties
                {
                    IsPersistent = false,
                    AllowRefresh = true,
                    ExpiresUtc = DateTimeOffset.UtcNow.AddHours(8)
                });
            return Ok(new { isSuccess = true, numeroError = 0, respuesta = "Inicio de sesión correcto." });
        }
        catch (ProcedimientoException ex) { return ErrorProcedimiento(ex); }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al iniciar sesión de entrenador.");
            return ErrorBaseDatos();
        }
    }

    [HttpGet("perfil")]
    public async Task<IActionResult> Perfil()
    {
        try
        {
            var cuenta = await _datos.ObtenerAsync(IdSesion());
            if (cuenta?.EsEntrenadorActivo != true)
                return StatusCode(403, Error("La cuenta no tiene acceso como entrenador activo.", 403));
            return Ok(new
            {
                cuenta.IdUsuario,
                cuenta.NombreCompleto,
                cuenta.Correo,
                cuenta.Telefono,
                cuenta.Estatus,
                cuenta.NombreRol,
                cuenta.TieneFoto,
                fotoUrl = cuenta.TieneFoto ? "/api/Entrenador/foto" : "/Accet/perfil.png"
            });
        }
        catch (ProcedimientoException ex) { return ErrorProcedimiento(ex); }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al consultar el perfil del entrenador.");
            return ErrorBaseDatos();
        }
    }

    [HttpGet("foto")]
    public async Task<IActionResult> Foto()
    {
        try
        {
            var foto = await _datos.ObtenerFotoAsync(IdSesion());
            if (foto == null || foto.Length == 0) return NotFound(Error("El entrenador no tiene fotografía.", 404));
            var tipo = TipoImagen(foto);
            if (tipo == null) return StatusCode(StatusCodes.Status415UnsupportedMediaType,
                Error("El formato de la fotografía no es compatible.", 415));
            return File(foto, tipo);
        }
        catch (ProcedimientoException ex) { return ErrorProcedimiento(ex); }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al consultar la fotografía del entrenador.");
            return ErrorBaseDatos();
        }
    }

    [HttpPut("password")]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> CambiarPassword(CambiarPasswordEntrenadorRequest request)
    {
        var error = PoliticaPassword.Validar(request.PasswordNueva);
        if (error != null) return BadRequest(Error(error));
        if (request.PasswordNueva != request.ConfirmarPassword)
            return BadRequest(Error("La confirmación no coincide con la contraseña nueva."));
        if (request.PasswordNueva == request.PasswordActual)
            return BadRequest(Error("La contraseña nueva debe ser diferente de la actual."));
        if (System.Text.Encoding.UTF8.GetByteCount(request.PasswordActual) > 72)
            return BadRequest(Error("La contraseña actual es incorrecta."));

        try
        {
            var id = IdSesion();
            var hashActual = await _datos.ObtenerPasswordHashAsync(id);
            if (string.IsNullOrEmpty(hashActual)
                || !BCrypt.Net.BCrypt.Verify(request.PasswordActual, hashActual))
                return BadRequest(Error("La contraseña actual es incorrecta."));

            var hashNuevo = BCrypt.Net.BCrypt.HashPassword(request.PasswordNueva, workFactor: 12);
            // Compara el hash anterior en SQL para no sobrescribir un cambio simultáneo.
            if (!await _datos.CambiarPasswordAsync(id, hashActual, hashNuevo))
                return Conflict(Error("No se pudo cambiar la contraseña. Comprueba tu sesión e inténtalo de nuevo.", 409));
            return Ok(new { isSuccess = true, numeroError = 0, respuesta = "Contraseña actualizada correctamente." });
        }
        catch (ProcedimientoException ex) { return ErrorProcedimiento(ex); }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al cambiar la contraseña del entrenador.");
            return ErrorBaseDatos();
        }
    }

    [HttpPost("logout")]
    [AllowAnonymous]
    [ValidateAntiForgeryToken]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return Ok(new { isSuccess = true, numeroError = 0, respuesta = "Sesión cerrada correctamente." });
    }

    private long IdSesion() => long.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!, CultureInfo.InvariantCulture);
    private static object Error(string mensaje, int numeroError = 400) => new { isSuccess = false, numeroError, respuesta = mensaje };
    private ObjectResult ErrorBaseDatos(int numeroError = 503) => StatusCode(503,
        Error("No fue posible consultar la cuenta. Comprueba la conexión y los scripts de entrenadores.", numeroError));
    private IActionResult ErrorProcedimiento(ProcedimientoException ex)
    {
        if (ex.NumeroError is 400 or 403 or 404 or 409)
            return StatusCode(ex.NumeroError, Error(ex.Respuesta, ex.NumeroError));
        // Los errores técnicos quedan disponibles en SQL OUTPUT y en el registro, nunca en el navegador.
        _logger.LogError(ex, "Error del procedimiento de cuenta de entrenador ({NumeroError}).", ex.NumeroError);
        return ErrorBaseDatos(ex.NumeroError);
    }

    private static string? TipoImagen(byte[] foto)
    {
        if (foto.Length >= 3 && foto[0] == 0xff && foto[1] == 0xd8 && foto[2] == 0xff) return "image/jpeg";
        if (foto.Length >= 8 && foto.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 })) return "image/png";
        if (foto.Length >= 12 && System.Text.Encoding.ASCII.GetString(foto, 0, 4) == "RIFF"
            && System.Text.Encoding.ASCII.GetString(foto, 8, 4) == "WEBP") return "image/webp";
        return null;
    }
}
