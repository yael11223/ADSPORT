namespace ADSPORT.Services;

public static class PoliticasClase
{
    public const string Version = "2026-11-26.1";
    public const decimal TasaIva = 0.16m;
    public static readonly object[] Apartados = [
        new { titulo = "Clase y semana elegidas", texto = "La compra incluye únicamente las sesiones publicadas de la clase y de la semana seleccionadas, de lunes a domingo, en horario de Ciudad de México. Revisa fechas, horarios y cancha antes de pagar. Las sesiones ya transcurridas no se reponen automáticamente." },
        new { titulo = "Precio y confirmación", texto = "La tarifa base, el IVA del 16% y el total se muestran antes del pago. Es una compra por semana, sin renovación ni cargos automáticos. La inscripción y el QR se activan cuando Mercado Pago confirma la acreditación; una operación pendiente o rechazada no autoriza el acceso." },
        new { titulo = "Acceso personal y vigencia", texto = "El QR y el código de acceso son personales. Solo sirven para el alumno inscrito, la clase y la semana pagadas. No los compartas. El entrenador puede verificar tu identidad. El acceso caduca al terminar el domingo de esa semana y se revoca si la inscripción deja de estar confirmada o se reembolsa el pago." },
        new { titulo = "Llegada y asistencia", texto = "Presenta tu QR al entrenador de la clase. La asistencia se registra por sesión, desde 30 minutos antes del inicio y hasta la hora de término. Escanear dos veces no duplica la asistencia. El entrenador puede corregir la marca durante ese mismo periodo." },
        new { titulo = "Cambios y cancelaciones", texto = "Para solicitar una cancelación, aclaración o reembolso, contacta al club con tu código de pedido. El club revisará el caso y te comunicará la solución; los reembolsos que correspondan se tramitan por el medio de pago original. Estas políticas no limitan los derechos que te otorgue la legislación aplicable." },
        new { titulo = "Convivencia y datos", texto = "Llega con ropa adecuada, respeta al grupo y las indicaciones del entrenador, e informa cualquier condición que afecte tu participación. Usamos tu correo para enviarte la confirmación y el acceso; el entrenador asignado ve tu inscripción y asistencia. Conserva el QR de forma privada." }
    ];
}

public static class TiempoClub
{
    private static readonly TimeZoneInfo Zona = TimeZoneInfo.FindSystemTimeZoneById("Central Standard Time (Mexico)");
    public static DateTime Ahora => TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, Zona);
    public static DateOnly Hoy => DateOnly.FromDateTime(Ahora);
}
