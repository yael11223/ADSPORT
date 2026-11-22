using System.ComponentModel.DataAnnotations;

namespace ADSPORT.Models;

public class Usuario
{
    public long IdUsuario { get; set; }
    [Range(1, long.MaxValue)]
    public long IdRol { get; set; }
    public string? NombreRol { get; set; }
    [Required, StringLength(100)]
    public string Nombre { get; set; } = string.Empty;
    [Required, StringLength(100)]
    public string? ApellidoPaterno { get; set; }
    [StringLength(100)]
    public string? ApellidoMaterno { get; set; }
    [Required, EmailAddress, StringLength(100)]
    public string? Correo { get; set; }
    [StringLength(100)]
    public string? Telefono { get; set; }
    [Required, RegularExpression("(?i)^(activo|inactivo)$")]
    public string Estatus { get; set; } = "ACTIVO";
    public string? CodigoQr { get; set; }
    public string? FechaUltimaModificacion { get; set; }
    public byte[]? Foto { get; set; }
    public bool TieneFoto { get; set; }
}
