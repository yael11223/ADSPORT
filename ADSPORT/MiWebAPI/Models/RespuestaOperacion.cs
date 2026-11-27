namespace MiWebAPI.Models
{
    public class RespuestaOperacion
    {
        public int NumeroError { get; set; }
        public string Respuesta { get; set; } = string.Empty;
        public bool IsSuccess => NumeroError is 0 or 200 or 201;
        [System.Text.Json.Serialization.JsonIgnore]
        public long? IdCodigoVerificado { get; set; }
        public long? IdUsuario { get; set; }
        public string? CodigoQr { get; set; }
    }
}
