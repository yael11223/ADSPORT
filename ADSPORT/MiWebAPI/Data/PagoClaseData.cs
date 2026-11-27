using ADSPORT.Models;
using System.Data;
using System.Data.SqlClient;
using System.Text.Json;

namespace ADSPORT.Data;

public sealed class PagoClaseData(IConfiguration configuration)
{
    private readonly string _cadena = configuration.GetConnectionString("CadenaSQL") ?? "";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public async Task<List<SemanaClase>> Cotizar(long idClase, bool prueba)
    {
        using var db = new SqlConnection(_cadena);
        using var cmd = new SqlCommand("PAGO_SEMANAL_COTIZAR", db) { CommandType = CommandType.StoredProcedure };
        cmd.Parameters.Add("@IdClase", SqlDbType.BigInt).Value = idClase;
        cmd.Parameters.Add("@ModoPrueba", SqlDbType.Bit).Value = prueba;
        var resultado = SqlResultadoProcedimiento.Agregar(cmd);
        await db.OpenAsync();
        using var r = await cmd.ExecuteReaderAsync();
        var semanas = new List<SemanaClase>();
        while (await r.ReadAsync()) semanas.Add(new SemanaClase(idClase, (string)r["NOMBRE_CLASE"],
            (string)r["ENTRENADOR_NOMBRE"], (decimal)r["PRECIO"], (int)r["CUPO_MAXIMO"], (int)r["CUPOS_DISPONIBLES"],
            DateOnly.FromDateTime((DateTime)r["SEMANA_INICIO"]), DateOnly.FromDateTime((DateTime)r["SEMANA_FIN"]),
            (bool)r["PUEDE_PAGAR"], JsonSerializer.Deserialize<List<HorarioClase>>((string)r["HORARIOS"], Json) ?? new()));
        await r.CloseAsync(); resultado.Comprobar();
        return semanas;
    }

    public async Task<PagoClase> Preparar(long idUsuario, CrearPagoClase solicitud, bool prueba, string retorno)
    {
        using var db = new SqlConnection(_cadena);
        using var cmd = new SqlCommand("PAGO_SEMANAL_PREPARAR", db) { CommandType = CommandType.StoredProcedure };
        cmd.Parameters.Add("@IdUsuario", SqlDbType.BigInt).Value = idUsuario;
        cmd.Parameters.Add("@IdClase", SqlDbType.BigInt).Value = solicitud.IdClase;
        cmd.Parameters.Add("@Inicio", SqlDbType.Date).Value = solicitud.InicioSemana!.Value.ToDateTime(TimeOnly.MinValue);
        var precio = cmd.Parameters.Add("@PrecioEsperado", SqlDbType.Decimal); precio.Precision = 10; precio.Scale = 2;
        precio.Value = solicitud.PrecioEsperado!.Value;
        var total = cmd.Parameters.Add("@TotalEsperado", SqlDbType.Decimal); total.Precision = 10; total.Scale = 2;
        total.Value = solicitud.TotalEsperado!.Value;
        cmd.Parameters.Add("@AceptaPoliticas", SqlDbType.Bit).Value = solicitud.AceptaPoliticas;
        cmd.Parameters.Add("@VersionPoliticas", SqlDbType.VarChar, 40).Value = solicitud.VersionPoliticas;
        cmd.Parameters.Add("@ModoPrueba", SqlDbType.Bit).Value = prueba;
        cmd.Parameters.Add("@UrlRetorno", SqlDbType.NVarChar, 600).Value = retorno;
        var pagos = await Leer(db, cmd);
        return pagos.Single();
    }

    public async Task<List<PagoClase>> Consultar(long? usuario, Guid? cobro, bool prueba)
    {
        using var db = new SqlConnection(_cadena);
        using var cmd = new SqlCommand("PAGO_SEMANAL_CONSULTAR", db) { CommandType = CommandType.StoredProcedure };
        cmd.Parameters.Add("@IdUsuario", SqlDbType.BigInt).Value = (object?)usuario ?? DBNull.Value;
        cmd.Parameters.Add("@IdCobro", SqlDbType.UniqueIdentifier).Value = (object?)cobro ?? DBNull.Value;
        cmd.Parameters.Add("@ModoPrueba", SqlDbType.Bit).Value = prueba;
        return await Leer(db, cmd);
    }

    private static async Task<List<PagoClase>> Leer(SqlConnection db, SqlCommand cmd)
    {
        var resultado = SqlResultadoProcedimiento.Agregar(cmd);
        await db.OpenAsync();
        using var r = await cmd.ExecuteReaderAsync();
        var pagos = new List<PagoClase>();
        while (await r.ReadAsync()) pagos.Add(new PagoClase {
            IdCobro = (Guid)r["ID_COBRO"], IdClase = r["ID_CLASE"] as long?, IdPago = r["ID_PAGO"] as long?,
            NombreClase = (string)r["CLASE_NOMBRE"], EntrenadorNombre = (string)r["ENTRENADOR_NOMBRE"],
            Importe = (decimal)r["IMPORTE"], ModoPrueba = (bool)r["MODO_PRUEBA"], Estado = (string)r["ESTADO"],
            Subtotal = (decimal)r["SUBTOTAL"], Iva = (decimal)r["IVA"], TasaIva = (decimal)r["TASA_IVA"],
            VersionPoliticas = r["POLITICAS_VERSION"] as string, PoliticasAceptadasUtc = r["POLITICAS_ACEPTADAS_UTC"] as DateTime?,
            TokenAcceso = r["CODIGO_ACCESO"] as string, CorreoConfirmacion = (string)r["CORREO_CONFIRMACION"],
            EstadoReserva = (string)r["ESTATUS_RESERVA"], OrdenId = r["ORDEN_ID"] as string, UrlCheckout = r["URL_CHECKOUT"] as string,
            InicioSemana = DateOnly.FromDateTime((DateTime)r["SEMANA_INICIO"]), FinSemana = DateOnly.FromDateTime((DateTime)r["SEMANA_FIN"]),
            CreadoUtc = DateTime.SpecifyKind((DateTime)r["CREADO_UTC"], DateTimeKind.Utc), InscripcionVigente = (bool)r["INSCRIPCION_VIGENTE"],
            ClaseDisponible = (bool)r["CLASE_DISPONIBLE"],
            Horarios = JsonSerializer.Deserialize<List<HorarioClase>>((string)r["HORARIOS"], Json) ?? new(),
            Correo = (string)r["CORREO"], UrlRetorno = (string)r["URL_RETORNO"], VigenciaSegundos = (int)r["VIGENCIA_SEGUNDOS"]
        });
        await r.CloseAsync(); resultado.Comprobar();
        await CargarAsistencias(db,pagos);
        return pagos;
    }

    private static async Task CargarAsistencias(SqlConnection db,List<PagoClase> pagos)
    {
        if(pagos.Count==0) return;
        var marcas=new Dictionary<(Guid Cobro,DateOnly Fecha,string Hora),(bool Presente,DateTime Registrado)>();
        using var cmd=new SqlCommand("""
            SELECT a.ID_COBRO,a.FECHA,CONVERT(varchar(5),a.HORA_INICIO,108),a.PRESENTE,a.ACTUALIZADO_UTC
            FROM dbo.CLASE_ASISTENCIA a JOIN OPENJSON(@Cobros) c ON a.ID_COBRO=CONVERT(uniqueidentifier,c.value)
            """,db);
        cmd.Parameters.Add("@Cobros",SqlDbType.NVarChar,-1).Value=JsonSerializer.Serialize(pagos.Select(p=>p.IdCobro));
        using var r=await cmd.ExecuteReaderAsync();
        while(await r.ReadAsync()) marcas[(r.GetGuid(0),DateOnly.FromDateTime(r.GetDateTime(1)),r.GetString(2))]=
            (r.GetBoolean(3),DateTime.SpecifyKind(r.GetDateTime(4),DateTimeKind.Utc));
        foreach(var pago in pagos)
            pago.SesionesAcceso=pago.Horarios.Select(h=>{
                var fecha=pago.InicioSemana.AddDays(h.DiaSemana-1);
                var existe=marcas.TryGetValue((pago.IdCobro,fecha,h.HoraInicio),out var marca);
                return new SesionAccesoClase(fecha,h.HoraInicio,h.HoraFin,h.NombreCancha,
                    existe && marca.Presente,existe ? marca.Registrado : null);
            }).OrderBy(s=>s.Fecha).ThenBy(s=>s.HoraInicio).ToList();
    }

    public async Task Sincronizar(Guid cobro, string orden, string estado, string estadoMp, string detalleMp,
        decimal pagado, DateTime fechaMp, string? url)
    {
        using var db = new SqlConnection(_cadena);
        using var cmd = new SqlCommand("PAGO_SEMANAL_SINCRONIZAR", db) { CommandType = CommandType.StoredProcedure };
        cmd.Parameters.Add("@IdCobro", SqlDbType.UniqueIdentifier).Value = cobro;
        cmd.Parameters.Add("@OrdenId", SqlDbType.VarChar, 64).Value = orden;
        cmd.Parameters.Add("@Estado", SqlDbType.VarChar, 32).Value = estado;
        cmd.Parameters.Add("@EstadoMP", SqlDbType.VarChar, 32).Value = estadoMp;
        cmd.Parameters.Add("@DetalleMP", SqlDbType.VarChar, 100).Value = detalleMp;
        var importe = cmd.Parameters.Add("@TotalPagado", SqlDbType.Decimal); importe.Precision = 10; importe.Scale = 2; importe.Value = pagado;
        var fecha = cmd.Parameters.Add("@FechaMP", SqlDbType.DateTime2); fecha.Scale = 7; fecha.Value = fechaMp;
        cmd.Parameters.Add("@UrlCheckout", SqlDbType.VarChar, 2048).Value = (object?)url ?? DBNull.Value;
        var resultado = SqlResultadoProcedimiento.Agregar(cmd);
        await db.OpenAsync(); await cmd.ExecuteNonQueryAsync(); resultado.Comprobar();
    }

    public async Task<List<(Guid Cobro, string Orden)>> Pendientes(bool prueba)
    {
        using var db = new SqlConnection(_cadena);
        using var cmd = new SqlCommand("PAGO_SEMANAL_PENDIENTES", db) { CommandType = CommandType.StoredProcedure };
        cmd.Parameters.Add("@ModoPrueba", SqlDbType.Bit).Value = prueba;
        await db.OpenAsync(); using var r = await cmd.ExecuteReaderAsync();
        var lista = new List<(Guid, string)>();
        while (await r.ReadAsync()) lista.Add(((Guid)r[0], (string)r[1]));
        return lista;
    }
}
