using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using ADSPORT.Services;

namespace ADSPORT.Models;

public sealed class CrearPagoClase
{
    [Range(1, long.MaxValue)] public long IdClase { get; set; }
    [Required] public DateOnly? InicioSemana { get; set; }
    [Required, Range(typeof(decimal), "0.01", "99999999.99")]
    public decimal? PrecioEsperado { get; set; }
    [Required, Range(typeof(decimal), "0.01", "99999999.99")]
    public decimal? TotalEsperado { get; set; }
    public bool AceptaPoliticas { get; set; }
    [Required, StringLength(40)] public string VersionPoliticas { get; set; } = "";
}

public sealed record SemanaClase(long IdClase, string NombreClase, string EntrenadorNombre,
    decimal Precio, int CupoMaximo, int CuposDisponibles, DateOnly InicioSemana, DateOnly FinSemana,
    bool PuedePagar, List<HorarioClase> Horarios)
{
    public decimal Subtotal => Precio;
    public decimal TasaIva => PoliticasClase.TasaIva;
    public decimal Iva => decimal.Round(Subtotal * TasaIva, 2, MidpointRounding.AwayFromZero);
    public decimal Total => Subtotal + Iva;
}

public sealed class PagoClase
{
    public Guid IdCobro { get; set; }
    public long? IdClase { get; set; }
    public long? IdPago { get; set; }
    public string NombreClase { get; set; } = "";
    public string EntrenadorNombre { get; set; } = "";
    public decimal Importe { get; set; }
    public decimal Subtotal { get; set; }
    public decimal Iva { get; set; }
    public decimal TasaIva { get; set; }
    public string? VersionPoliticas { get; set; }
    public DateTime? PoliticasAceptadasUtc { get; set; }
    public string CodigoPedido => "ADS-" + IdCobro.ToString("N").ToUpperInvariant();
    public string CorreoConfirmacion { get; set; } = "NO_PROGRAMADO";
    [JsonIgnore] public string? TokenAcceso { get; set; }
    public string EstadoAcceso => Estado != "APROBADO" || EstadoReserva != "CONFIRMADA" || !ClaseDisponible || TokenAcceso is null
        ? "NO_DISPONIBLE" : FinSemana < TiempoClub.Hoy ? "VENCIDO" : InicioSemana > TiempoClub.Hoy ? "PROXIMAMENTE" : "VIGENTE";
    public string? CodigoAcceso => EstadoAcceso is "VIGENTE" or "PROXIMAMENTE" ? TokenAcceso : null;
    public string Moneda => "MXN";
    public bool ModoPrueba { get; set; }
    public bool RetornoLocal => MercadoPagoOpciones.EsRetornoLocal(UrlRetorno, ModoPrueba);
    public string Estado { get; set; } = "";
    public string EstadoReserva { get; set; } = "";
    public string? OrdenId { get; set; }
    public string? UrlCheckout { get; set; }
    public DateOnly InicioSemana { get; set; }
    public DateOnly FinSemana { get; set; }
    public DateTime CreadoUtc { get; set; }
    public bool InscripcionVigente { get; set; }
    public bool ClaseDisponible { get; set; }
    public List<HorarioClase> Horarios { get; set; } = new();
    public List<SesionAccesoClase> SesionesAcceso { get; set; } = new();
    public int SesionesUtilizadas => SesionesAcceso.Count(s => s.Presente);
    public string EstadoUsoAcceso => SesionesUtilizadas == 0 ? "SIN_UTILIZAR"
        : SesionesUtilizadas == SesionesAcceso.Count ? "UTILIZADO" : "PARCIALMENTE_UTILIZADO";
    public bool PuedeContinuar => Estado == "PENDIENTE" && !string.IsNullOrEmpty(UrlCheckout);
    [JsonIgnore] public string Correo { get; set; } = "";
    [JsonIgnore] public string UrlRetorno { get; set; } = "";
    [JsonIgnore] public int VigenciaSegundos { get; set; }
}

public sealed record SesionAccesoClase(DateOnly Fecha, string HoraInicio, string HoraFin, string? Cancha,
    bool Presente, DateTime? RegistradoUtc)
{
    public string EstadoAcceso => Presente ? "UTILIZADO" : "SIN_UTILIZAR";
}
