namespace ADSPORT.Models
{
    public class Usuario
    {
        public int IdUsuario { get; set;}
        public int IdRol {  get; set;}
        public string? Nombre { get; set;}
        public string? ApellidoPaterno { get; set;}
        public string? ApellidoMaterno { get; set;}
        public string? Correo { get; set;}
        public long Telefono { get; set;}
        public string? Estatus { get; set;}
        public string? CodigoQr {  get; set;}
        public string? FechaUltimaModificacion { get; set;}
        


    }
}
