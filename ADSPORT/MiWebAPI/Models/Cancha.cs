using System.ComponentModel.DataAnnotations;
using System.Globalization;

namespace ADSPORT.Models;

public sealed class Cancha
{
    public long IdCancha { get; set; }
    public long? IdDeporte { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string NombreDeporte { get; set; } = string.Empty;
    public string? Ubicacion { get; set; }
    public bool Activo { get; set; }
    public bool DeporteActivo { get; set; }
    public string? ImagenUrl { get; set; }
    public List<HorarioClase> Horarios { get; } = new();
}

public sealed class GuardarCanchaSolicitud : IValidatableObject
{
    [Range(1, long.MaxValue)]
    public long IdDeporte { get; set; }
    [Required, StringLength(100)]
    public string Nombre { get; set; } = string.Empty;
    [StringLength(100)]
    public string? Ubicacion { get; set; }
    public bool Activo { get; set; } = true;
    [Required, MinLength(1), MaxLength(21)]
    public List<HorarioClase> Horarios { get; set; } = new();

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (string.IsNullOrWhiteSpace(Nombre)) yield return new ValidationResult("El nombre de la cancha es obligatorio.", new[] { nameof(Nombre) });
        if (Horarios is null) yield break;
        var validos = new List<(int Dia, TimeOnly Inicio, TimeOnly Fin)>();
        foreach (var horario in Horarios)
        {
            if (horario is null || horario.DiaSemana is < 1 or > 7
                || !TimeOnly.TryParseExact(horario.HoraInicio, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var inicio)
                || !TimeOnly.TryParseExact(horario.HoraFin, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var fin) || inicio >= fin)
            {
                yield return new ValidationResult("Los horarios deben tener día válido y horas HH:mm, con inicio anterior al final.", new[] { nameof(Horarios) });
                continue;
            }
            if (validos.Any(x => x.Dia == horario.DiaSemana && inicio < x.Fin && fin > x.Inicio))
                yield return new ValidationResult("Los horarios de apertura no pueden cruzarse.", new[] { nameof(Horarios) });
            validos.Add((horario.DiaSemana, inicio, fin));
        }
    }
}

public sealed class OcupacionCancha
{
    public int DiaSemana { get; set; }
    public string HoraInicio { get; set; } = string.Empty;
    public string HoraFin { get; set; } = string.Empty;
    public long IdClase { get; set; }
    public string NombreClase { get; set; } = string.Empty;
    public long? IdCancha { get; set; }
}

public sealed record DisponibilidadCancha(List<HorarioClase> Disponibles, List<OcupacionCancha> Ocupados);

public sealed class EntradaCronograma
{
    public long IdClase { get; set; }
    public string NombreClase { get; set; } = string.Empty;
    public long? IdEntrenador { get; set; }
    public string EntrenadorNombre { get; set; } = string.Empty;
    public long IdDeporte { get; set; }
    public string NombreDeporte { get; set; } = string.Empty;
    public long? IdCancha { get; set; }
    public string? NombreCancha { get; set; }
    public string? Ubicacion { get; set; }
    public int DiaSemana { get; set; }
    public string HoraInicio { get; set; } = string.Empty;
    public string HoraFin { get; set; } = string.Empty;
    public bool Disponible { get; set; }
    public bool OcupaCancha { get; set; }
}
