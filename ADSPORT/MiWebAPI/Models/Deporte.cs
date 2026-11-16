using System.ComponentModel.DataAnnotations;

namespace ADSPORT.Models;

public sealed class Deporte
{
    public long IdDeporte { get; set; }
    public string NombreDeporte { get; set; } = string.Empty;
    public string? Descripcion { get; set; }
    public bool Activo { get; set; }
    public string? ImagenUrl { get; set; }
    public DateTime? FechaUltimaModificacion { get; set; }
}

public sealed class GuardarDeporteSolicitud
{
    [Required, StringLength(50)]
    public string NombreDeporte { get; set; } = string.Empty;

    [StringLength(2000)]
    public string? Descripcion { get; set; }

    [Required]
    public bool? Activo { get; set; } = true;
}
