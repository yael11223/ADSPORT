using System.ComponentModel.DataAnnotations;

namespace ADSPORT.Models;

// Modelo interno: nunca incluye la contraseña ni su hash en las respuestas.
public sealed class EntrenadorCuenta
{
    public long IdUsuario { get; init; }
    public string NombreCompleto { get; init; } = string.Empty;
    public string Correo { get; init; } = string.Empty;
    public string Telefono { get; init; } = string.Empty;
    public string Estatus { get; init; } = string.Empty;
    public string NombreRol { get; init; } = string.Empty;
    public bool TieneFoto { get; init; }

    public bool EsEntrenadorActivo =>
        NombreRol.Trim().Equals("ENTRENADOR", StringComparison.OrdinalIgnoreCase)
        && Estatus.Trim().Equals("ACTIVO", StringComparison.OrdinalIgnoreCase);
}

public sealed class LoginEntrenadorRequest
{
    [Required, EmailAddress, StringLength(100)]
    public string Correo { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;
}

public sealed class CambiarPasswordEntrenadorRequest
{
    [Required]
    public string PasswordActual { get; set; } = string.Empty;

    [Required]
    public string PasswordNueva { get; set; } = string.Empty;

    [Required]
    public string ConfirmarPassword { get; set; } = string.Empty;
}
