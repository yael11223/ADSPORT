using System.ComponentModel.DataAnnotations;

namespace ADSPORT.Models;

public sealed class MarcarAsistenciaClase
{
    [Required] public DateOnly? Fecha { get; set; }
    [Required, RegularExpression(@"^([01]\d|2[0-3]):[0-5]\d$")] public string HoraInicio { get; set; } = "";
    [Required] public bool? Presente { get; set; }
}
public sealed class EscanearAccesoClase
{
    [Required, StringLength(100)] public string CodigoAcceso { get; set; } = "";
    [Required] public DateOnly? Fecha { get; set; }
    [Required, RegularExpression(@"^([01]\d|2[0-3]):[0-5]\d$")] public string HoraInicio { get; set; } = "";
}
public sealed record AlumnoAsistencia(Guid IdCobro, long IdAlumno, string Nombre, bool AccesoActivo,
    bool Presente, DateTime? RegistradoUtc, string? Metodo)
{
    public string EstadoAcceso => Presente ? "UTILIZADO" : AccesoActivo ? "DISPONIBLE" : "REVOCADO";
}
public sealed record SesionAsistencia(DateOnly Fecha, string HoraInicio, string HoraFin, string? Cancha,
    bool PuedeRegistrar, List<AlumnoAsistencia> Alumnos);
public sealed record ClaseAsistencia(long IdClase, string NombreClase, DateOnly InicioSemana, bool ModoPrueba,
    List<SesionAsistencia> Sesiones);
public sealed record ResultadoAsistencia(Guid IdCobro, string Alumno, bool Presente, bool YaEstabaPresente, string Mensaje)
{
    public string EstadoAcceso => Presente ? "UTILIZADO" : "DISPONIBLE";
    public string EstadoAsistencia => Presente ? "PRESENTE" : "PENDIENTE";
}
