
using System.ComponentModel.DataAnnotations;

namespace ADSPORT.Models
{
    public class UsuarioCliente
    {
        [Required, StringLength(100)]
        public string Nombre { get; set; } = string.Empty;

        [Required, StringLength(100)]
        public string ApellidoPaterno { get; set; } = string.Empty;

        [StringLength(100)]
        public string? ApellidoMaterno { get; set; }

        [Required]
        [EmailAddress, StringLength(100)]
        public string Correo { get; set; } = string.Empty;

        [StringLength(20)]
        public string? Telefono { get; set; }

        [Required]
        public string Password { get; set; } = string.Empty;
    }
}
