using ADSPORT.Models;
using ADSPORT.Services;
using System.Data;
using System.Data.SqlClient;
using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace ADSPORT.Data;

public sealed class AsistenciaClaseData(IConfiguration config)
{
    private readonly string cadena = config.GetConnectionString("CadenaSQL") ?? "";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private static SqlCommand Comando(SqlConnection db, SqlTransaction? tx, string sql, params (string, object)[] valores)
    {
        var cmd = new SqlCommand(sql, db, tx);
        foreach (var (nombre, valor) in valores) cmd.Parameters.AddWithValue(nombre, valor);
        return cmd;
    }
    public async Task<ClaseAsistencia> Consultar(long entrenador, long clase, DateOnly inicio, bool prueba)
    {
        if ((int)inicio.DayOfWeek != 1) throw new ProcedimientoException(51000, "Selecciona el lunes de la semana a consultar.");
        using var db = new SqlConnection(cadena); await db.OpenAsync();
        return await Leer(db, null, entrenador, clase, inicio, prueba);
    }
    private static async Task<ClaseAsistencia> Leer(SqlConnection db, SqlTransaction? tx, long entrenador, long clase, DateOnly inicio, bool prueba)
    {
        string nombre, horarios;
        bool disponible;
        using (var cmd = Comando(db, tx, """
            SELECT c.NOMBRE_CLASE,cp.HORARIOS FROM dbo.CLASE c
            LEFT JOIN dbo.CLASE_PAGABLE cp ON cp.ID_CLASE=c.ID_CLASE
            WHERE c.ID_CLASE=@clase AND c.ID_ENTRENADOR=@entrenador
            """, ("@clase", clase), ("@entrenador", entrenador)))
        using (var r = await cmd.ExecuteReaderAsync())
        {
            if (!await r.ReadAsync()) throw new ProcedimientoException(51004, "La clase no existe o no está asignada a tu cuenta.");
            nombre = (string)r[0]; disponible = r[1] is string; horarios = r[1] as string ?? "[]";
        }
        var inscripciones = new List<(Guid Cobro, long Alumno, string Nombre, bool Activa)>();
        using (var cmd = Comando(db, tx, """
            SELECT p.ID_COBRO,u.ID_USUARIO,CONCAT(u.NOMBRE,' ',u.APELLIDO_PATERNO,' ',u.APELLIDO_MATERNO),
                CONVERT(bit,CASE WHEN p.ESTADO='APROBADO' AND rv.ESTATUS_RESERVA='CONFIRMADA'
                    AND p.HORARIOS=@horarios AND p.CODIGO_ACCESO IS NOT NULL
                    AND UPPER(LTRIM(RTRIM(u.ESTATUS)))='ACTIVO' THEN 1 ELSE 0 END)
            FROM dbo.PAGO_MERCADOPAGO p JOIN dbo.RESERVA rv ON rv.ID_RESERVA=p.ID_RESERVA
            JOIN dbo.USUARIO u ON u.ID_USUARIO=rv.ID_USUARIO
            WHERE rv.ID_CLASE=@clase AND rv.SEMANA_INICIO=@inicio AND p.MODO_PRUEBA=@prueba
                AND (p.ESTADO='APROBADO' OR EXISTS(SELECT 1 FROM dbo.CLASE_ASISTENCIA a WHERE a.ID_COBRO=p.ID_COBRO))
            ORDER BY u.NOMBRE,u.APELLIDO_PATERNO
            """, ("@clase", clase), ("@inicio", inicio.ToDateTime(TimeOnly.MinValue)), ("@prueba", prueba), ("@horarios", horarios)))
        using (var r = await cmd.ExecuteReaderAsync())
            while (await r.ReadAsync()) inscripciones.Add((r.GetGuid(0), r.GetInt64(1), r.GetString(2).Trim(), r.GetBoolean(3) && disponible));
        var marcas = new Dictionary<(Guid, DateOnly, string), (bool Presente, DateTime Fecha, string Metodo)>();
        using (var cmd = Comando(db, tx, """
            SELECT a.ID_COBRO,a.FECHA,CONVERT(varchar(5),a.HORA_INICIO,108),a.PRESENTE,a.ACTUALIZADO_UTC,a.METODO
            FROM dbo.CLASE_ASISTENCIA a JOIN dbo.PAGO_MERCADOPAGO p ON p.ID_COBRO=a.ID_COBRO
            JOIN dbo.RESERVA rv ON rv.ID_RESERVA=p.ID_RESERVA
            WHERE rv.ID_CLASE=@clase AND rv.SEMANA_INICIO=@inicio AND p.MODO_PRUEBA=@prueba
            """, ("@clase", clase), ("@inicio", inicio.ToDateTime(TimeOnly.MinValue)), ("@prueba", prueba)))
        using (var r = await cmd.ExecuteReaderAsync())
            while (await r.ReadAsync()) marcas[(r.GetGuid(0), DateOnly.FromDateTime(r.GetDateTime(1)), r.GetString(2))] =
                (r.GetBoolean(3), DateTime.SpecifyKind(r.GetDateTime(4), DateTimeKind.Utc), r.GetString(5));
        var ahora = TiempoClub.Ahora;
        var sesiones = (JsonSerializer.Deserialize<List<HorarioClase>>(horarios, Json) ?? []).Select(h => {
            var fecha = inicio.AddDays(h.DiaSemana - 1);
            var desde = fecha.ToDateTime(TimeOnly.ParseExact(h.HoraInicio, "HH:mm", CultureInfo.InvariantCulture));
            var hasta = fecha.ToDateTime(TimeOnly.ParseExact(h.HoraFin, "HH:mm", CultureInfo.InvariantCulture));
            return new SesionAsistencia(fecha, h.HoraInicio, h.HoraFin, h.NombreCancha,
                disponible && DateOnly.FromDateTime(ahora) >= inicio && DateOnly.FromDateTime(ahora) <= inicio.AddDays(6)
                    && ahora >= desde.AddMinutes(-30) && ahora <= hasta,
                inscripciones.Select(i => {
                    var existe = marcas.TryGetValue((i.Cobro, fecha, h.HoraInicio), out var marca);
                    return new AlumnoAsistencia(i.Cobro, i.Alumno, i.Nombre, i.Activa,
                        existe && marca.Presente, existe ? marca.Fecha : null, existe ? marca.Metodo : null);
                }).ToList());
        }).OrderBy(s => s.Fecha).ThenBy(s => s.HoraInicio).ToList();
        return new ClaseAsistencia(clase, nombre, inicio, prueba, sesiones);
    }
    public async Task<ResultadoAsistencia> Registrar(long entrenador, long clase, DateOnly fecha, string hora,
        bool prueba, Guid? cobro, string? codigo, bool presente)
    {
        if (codigo is not null)
        {
            codigo = codigo.Trim();
            if (codigo.StartsWith(QrAccesoClase.Prefijo, StringComparison.Ordinal)) codigo = codigo[QrAccesoClase.Prefijo.Length..];
            codigo = codigo.ToUpperInvariant();
            if (!Regex.IsMatch(codigo, "^[A-F0-9]{48}$", RegexOptions.CultureInvariant))
                throw new ProcedimientoException(51000, "El QR o código de acceso no es válido.");
            presente = true;
        }
        using var db = new SqlConnection(cadena); await db.OpenAsync();
        using var tx = db.BeginTransaction();
        try
        {
            using (var cmd = Comando(db, tx, """
                DECLARE @resultado int;
                EXEC @resultado=sys.sp_getapplock @Resource=N'ADSPORT_AGENDA',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
                IF @resultado<0 THROW 51009,'La agenda se está actualizando. Intenta nuevamente.',1;
                """)) await cmd.ExecuteNonQueryAsync();
            var inicio = fecha.AddDays(-(((int)fecha.DayOfWeek + 6) % 7));
            var vista = await Leer(db, tx, entrenador, clase, inicio, prueba);
            var sesion = vista.Sesiones.SingleOrDefault(s => s.Fecha == fecha && s.HoraInicio == hora);
            if (sesion?.PuedeRegistrar != true)
                throw new ProcedimientoException(51009, "La sesión no está abierta: registra la asistencia desde 30 minutos antes del inicio y hasta su término.");
            if (codigo is not null)
            {
                using var cmd = Comando(db, tx, "SELECT ID_COBRO FROM dbo.PAGO_MERCADOPAGO WHERE CODIGO_ACCESO=@codigo AND MODO_PRUEBA=@prueba",
                    ("@codigo", codigo), ("@prueba", prueba));
                cobro = await cmd.ExecuteScalarAsync() as Guid?;
            }
            var alumno = sesion.Alumnos.SingleOrDefault(a => a.IdCobro == cobro && a.AccesoActivo);
            if (alumno is null) throw new ProcedimientoException(51009, "El acceso no corresponde a una inscripción confirmada para esta clase, semana y entorno, o ya fue revocado.");
            bool repetido = presente && alumno.Presente;
            if (!repetido)
            {
                using var cmd = Comando(db, tx, """
                    IF EXISTS(SELECT 1 FROM dbo.CLASE_ASISTENCIA WHERE ID_COBRO=@cobro AND FECHA=@fecha AND HORA_INICIO=@hora)
                        UPDATE dbo.CLASE_ASISTENCIA SET PRESENTE=@presente,ID_ENTRENADOR=@entrenador,METODO=@metodo,ACTUALIZADO_UTC=SYSUTCDATETIME()
                        WHERE ID_COBRO=@cobro AND FECHA=@fecha AND HORA_INICIO=@hora;
                    ELSE INSERT dbo.CLASE_ASISTENCIA(ID_COBRO,FECHA,HORA_INICIO,HORA_FIN,PRESENTE,ID_ENTRENADOR,METODO)
                        VALUES(@cobro,@fecha,@hora,@fin,@presente,@entrenador,@metodo);
                    """, ("@cobro", alumno.IdCobro), ("@fecha", fecha.ToDateTime(TimeOnly.MinValue)),
                    ("@hora", TimeSpan.Parse(hora, CultureInfo.InvariantCulture)), ("@fin", TimeSpan.Parse(sesion.HoraFin, CultureInfo.InvariantCulture)),
                    ("@presente", presente), ("@entrenador", entrenador), ("@metodo", codigo is null ? "MANUAL" : "QR"));
                await cmd.ExecuteNonQueryAsync();
            }
            tx.Commit();
            return new ResultadoAsistencia(alumno.IdCobro, alumno.Nombre, presente, repetido,
                repetido ? "Acceso ya utilizado. " + alumno.Nombre + " tiene su asistencia registrada en esta sesión; no se registró otra entrada."
                    : alumno.Nombre + (presente ? ": asistencia registrada. Acceso utilizado para esta sesión."
                        : ": asistencia corregida. El acceso queda disponible para esta sesión."));
        }
        catch { tx.Rollback(); throw; }
    }
}
