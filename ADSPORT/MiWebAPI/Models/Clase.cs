namespace ADSPORT.Models
{
    public class Clase
    {
        public long IdClase { get; set; }
        public long IdDeporte { get; set; }
        public string NombreDeporte { get; set; } = string.Empty;
        public long IdEntrenador { get; set; }
        public string NombreEntrenador { get; set; } = string.Empty;
        public string? CorreoEntrenador { get; set; }
        public bool TieneFoto { get; set; }
        public string NombreClase { get; set; } = string.Empty;
        public decimal Precio { get; set; }
        public int CupoMaximo { get; set; }

        // Datos del horario asociado
        public long? IdHorario { get; set; }
        public DateTime? DiaSemana { get; set; }
        public string? HoraInicio { get; set; }
        public string? HoraFin { get; set; }
        public string? Cancha { get; set; }
    }
}   