using ADSPORT.Models;
using System.Globalization;

namespace ADSPORT.Services;

public static class DisponibilidadHorarios
{
    // Resta intervalos completos, incluidos cruces y ocupaciones contiguas.
    // Un final igual al siguiente inicio permite clases consecutivas.
    public static List<HorarioClase> Calcular(IEnumerable<HorarioClase> apertura, IEnumerable<OcupacionCancha> ocupados)
    {
        var resultado = new List<HorarioClase>();
        var reservas = ocupados.ToList();
        foreach (var horario in apertura.OrderBy(h => h.DiaSemana).ThenBy(h => h.HoraInicio))
        {
            var cursor = TimeOnly.ParseExact(horario.HoraInicio, "HH:mm", CultureInfo.InvariantCulture);
            var fin = TimeOnly.ParseExact(horario.HoraFin, "HH:mm", CultureInfo.InvariantCulture);
            var bloques = reservas.Where(r => r.DiaSemana == horario.DiaSemana)
                .Select(r => (Inicio: TimeOnly.ParseExact(r.HoraInicio, "HH:mm", CultureInfo.InvariantCulture),
                              Fin: TimeOnly.ParseExact(r.HoraFin, "HH:mm", CultureInfo.InvariantCulture)))
                .Where(r => r.Inicio < fin && r.Fin > cursor).OrderBy(r => r.Inicio);
            foreach (var bloque in bloques)
            {
                if (bloque.Inicio > cursor) Agregar(cursor, bloque.Inicio < fin ? bloque.Inicio : fin);
                if (bloque.Fin > cursor) cursor = bloque.Fin;
                if (cursor >= fin) break;
            }
            if (cursor < fin) Agregar(cursor, fin);

            void Agregar(TimeOnly inicio, TimeOnly final) => resultado.Add(new HorarioClase
            {
                DiaSemana = horario.DiaSemana, HoraInicio = inicio.ToString("HH:mm", CultureInfo.InvariantCulture),
                HoraFin = final.ToString("HH:mm", CultureInfo.InvariantCulture)
            });
        }
        return resultado;
    }
}
