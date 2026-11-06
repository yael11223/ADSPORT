namespace ADSPORT.Models
{
    public class Verificacion
    {
        public int IdCodigo { get; set; }
        public int IdUsuario { get; set; }
        public string? CodigoHash { get; set; }
        public DateTime  FechaCreacion { get; set; }
        public DateTime FechaExpiracion { get; set; }
        public bool Utilizado { get; set; }
        public  int Intentos { get; set; }
        public DateTime  FechaUtimaModificacio { get; set; }
        public string? Correo { get; set; }
        public bool Verificado { get; set; }


    }
}
