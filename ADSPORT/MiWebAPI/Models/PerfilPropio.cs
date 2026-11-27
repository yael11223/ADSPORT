using System.ComponentModel.DataAnnotations;

namespace ADSPORT.Models;

public sealed class GuardarPerfilPropio
{
    [Required, StringLength(100)] public string Nombre { get; set; } = "";
    [StringLength(100)] public string? ApellidoPaterno { get; set; }
    [StringLength(100)] public string? ApellidoMaterno { get; set; }
    [StringLength(100)] public string? Telefono { get; set; }
    public IFormFile? Foto { get; set; }
    public IFormFile? Fondo { get; set; }
    public bool QuitarFoto { get; set; }
    public bool QuitarFondo { get; set; }
}

public sealed class PerfilPropio
{
    public long IdUsuario { get; set; }
    public string Nombre { get; set; } = "";
    public string? ApellidoPaterno { get; set; }
    public string? ApellidoMaterno { get; set; }
    public string NombreCompleto => string.Join(" ", new[] { Nombre, ApellidoPaterno, ApellidoMaterno }.Where(s => !string.IsNullOrWhiteSpace(s)));
    public string? Correo { get; set; }
    public string? Telefono { get; set; }
    public string? NombreRol { get; set; }
    public string Estatus { get; set; } = "";
    public bool TieneFoto { get; set; }
    public bool TieneFondo { get; set; }
    public DateTime? ModificadoUtc { get; set; }
    public string? FotoUrl => TieneFoto ? "/api/Perfil/foto?v=" + ModificadoUtc?.Ticks : null;
    public string? FondoUrl => TieneFondo ? "/api/Perfil/fondo?v=" + ModificadoUtc?.Ticks : null;
}
