namespace ADSPORT.Models
{
    public class Rol
    {
        public int IdRol { get; set; }
        [System.ComponentModel.DataAnnotations.Required, System.ComponentModel.DataAnnotations.StringLength(100)]
        public string NombreRol { get; set; } = string.Empty;
    }
}
