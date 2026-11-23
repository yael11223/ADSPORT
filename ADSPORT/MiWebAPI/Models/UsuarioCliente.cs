
using System.ComponentModel.DataAnnotations;

namespace ADSPORT.Models
{
    public class UsuarioCliente
    {
        [Required]
        public string Nombre { get; set; } = string.Empty;

        [Required]
        public string ApellidoPaterno { get; set; } = string.Empty;

        public string? ApellidoMaterno { get; set; }

        [Required]
        [EmailAddress]
        public string Correo { get; set; } = string.Empty;

        public string? Telefono { get; set; }

        [Required]
        public string Password { get; set; } = string.Empty;
    }
}
