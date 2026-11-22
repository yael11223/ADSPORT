using System.ComponentModel.DataAnnotations;

namespace ADSPORT.Models;

public class SolicitarRecuperacionPassword
{
    [Required, EmailAddress, StringLength(100)]
    public string Correo { get; set; } = string.Empty;
}

public sealed class RestablecerPasswordSolicitud : SolicitarRecuperacionPassword
{
    [Required, RegularExpression(@"^[0-9]{6}$")]
    public string Codigo { get; set; } = string.Empty;

    [Required, StringLength(72, MinimumLength = 8)]
    public string NuevaPassword { get; set; } = string.Empty;

    [Required, Compare(nameof(NuevaPassword), ErrorMessage = "Las contraseñas no coinciden.")]
    public string ConfirmarPassword { get; set; } = string.Empty;
}
