using System.ComponentModel.DataAnnotations;

namespace ADSPORT.Models;

// Solo se recibe durante el alta administrativa; nunca se devuelve en consultas.
public class AltaEmpleadoRequest : Usuario
{
    [Required]
    public string PasswordInicial { get; set; } = string.Empty;
}
