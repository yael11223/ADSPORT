namespace ADSPORT.Models
{
    public class Deporte
    {
        public int IdDeporte { get; set; }
        public string NombreDeporte { get; set; } = string.Empty;
        public string? Descripcion { get; set; }
        public string? FechaUltimaModificacion { get; set; }
        public string? ImagenUrl { get; set; }
    }
}