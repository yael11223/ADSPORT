using System.ComponentModel.DataAnnotations;
using System.Globalization;

namespace ADSPORT.Models;

public sealed class HorarioClase
{
    [Range(1, 7)]
    public int DiaSemana { get; set; }

    [Required, RegularExpression(@"^([01]\d|2[0-3]):[0-5]\d$")]
    public string HoraInicio { get; set; } = string.Empty;

    [Required, RegularExpression(@"^([01]\d|2[0-3]):[0-5]\d$")]
    public string HoraFin { get; set; } = string.Empty;
}

public sealed class GuardarClaseSolicitud : IValidatableObject
{
    [Range(1, long.MaxValue)]
    public long IdDeporte { get; set; }

    [Required, StringLength(100)]
    public string NombreClase { get; set; } = string.Empty;

    [Required, StringLength(2000)]
    public string Descripcion { get; set; } = string.Empty;

    [Range(typeof(decimal), "0", "99999999.99")]
    public decimal Precio { get; set; }

    [Range(1, 10000)]
    public int CupoMaximo { get; set; }

    public bool Disponible { get; set; }

    [StringLength(100)]
    public string? Ubicacion { get; set; }

    [Required, MinLength(1), MaxLength(21)]
    public List<HorarioClase> Horarios { get; set; } = new();

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (string.IsNullOrWhiteSpace(NombreClase) || string.IsNullOrWhiteSpace(Descripcion))
            yield return new ValidationResult("Nombre y descripción son obligatorios.", new[] { nameof(NombreClase), nameof(Descripcion) });
        if (decimal.Round(Precio, 2) != Precio)
            yield return new ValidationResult("El precio admite hasta dos decimales.", new[] { nameof(Precio) });
        if (Horarios is null) yield break;

        var validos = new List<(int Dia, TimeOnly Inicio, TimeOnly Fin)>();
        foreach (var horario in Horarios)
        {
            if (horario is null || horario.DiaSemana < 1 || horario.DiaSemana > 7 ||
                !TimeOnly.TryParseExact(horario.HoraInicio, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var inicio) ||
                !TimeOnly.TryParseExact(horario.HoraFin, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var fin) || inicio >= fin)
            {
                yield return new ValidationResult("Cada horario debe tener un día válido y una hora final posterior a la inicial (HH:mm).", new[] { nameof(Horarios) });
                continue;
            }
            if (validos.Any(h => h.Dia == horario.DiaSemana && inicio < h.Fin && fin > h.Inicio))
                yield return new ValidationResult("Los horarios de una clase no pueden superponerse.", new[] { nameof(Horarios) });
            validos.Add((horario.DiaSemana, inicio, fin));
        }
    }
}

public sealed class DisponibilidadClaseSolicitud
{
    // Nullable prevents an empty JSON object from accidentally deactivating a class.
    [Required]
    public bool? Disponible { get; set; }
}

public sealed class ClaseDeportiva
{
    public long IdClase { get; set; }
    public long IdDeporte { get; set; }
    public string NombreDeporte { get; set; } = string.Empty;
    public bool DeporteActivo { get; set; }
    public string NombreClase { get; set; } = string.Empty;
    public string Descripcion { get; set; } = string.Empty;
    public decimal? Precio { get; set; }
    public int? CupoMaximo { get; set; }
    public bool Disponible { get; set; }
    public string? Ubicacion { get; set; }
    public int AlumnosInscritos { get; set; }
    public int? CuposDisponibles { get; set; }
    public string EntrenadorNombre { get; set; } = string.Empty;
    public string FotoUrl { get; set; } = "/Accet/perfil.png";
    public List<HorarioClase> Horarios { get; set; } = new();
}

public sealed record DeporteClase(long IdDeporte, string NombreDeporte);
