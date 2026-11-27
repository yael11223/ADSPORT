using ADSPORT.Models;
using MimeKit;
using System.Globalization;
using System.Net;

namespace ADSPORT.Services;

public partial class CorreoService
{
    public async Task EnviarConfirmacionClase(PagoClase pago, CancellationToken ct)
    {
        if (pago.CodigoAcceso is null) throw new InvalidOperationException("El acceso no está vigente para enviar la confirmación.");
        var cultura = CultureInfo.GetCultureInfo("es-MX");
        string Moneda(decimal valor) => valor.ToString("C2", cultura) + " MXN";
        string periodo = $"{pago.InicioSemana:dd/MM/yyyy} al {pago.FinSemana:dd/MM/yyyy}";
        var sesiones = pago.Horarios.Select(h => pago.InicioSemana.AddDays(h.DiaSemana - 1).ToString("dddd dd/MM/yyyy", cultura)
            + $" · {h.HoraInicio}–{h.HoraFin} · {h.NombreCancha ?? "Cancha por confirmar"}").ToArray();
        string asunto = "Inscripción confirmada y acceso semanal | ADSPORT";
        var mensaje = CrearMensaje(pago.Correo, asunto);
        mensaje.MessageId = pago.IdCobro.ToString("N") + "@confirmaciones.adsport";
        var qr = QrAccesoClase.Generar(pago.CodigoAcceso);
        var cuerpo = new BodyBuilder();
        var imagen = cuerpo.LinkedResources.Add("acceso.png", qr, new ContentType("image", "png"));
        imagen.ContentId = "acceso-" + pago.IdCobro.ToString("N");
        cuerpo.Attachments.Add("acceso-semanal.png", qr, new ContentType("image", "png"));
        string E(string valor) => WebUtility.HtmlEncode(valor);
        cuerpo.TextBody = "¡Pago confirmado! Ya estás inscrito en " + pago.NombreClase
            + "\nPedido: " + pago.CodigoPedido + "\nSemana: " + periodo + "\nEntrenador: " + pago.EntrenadorNombre
            + "\nSubtotal: " + Moneda(pago.Subtotal) + "\nIVA: " + Moneda(pago.Iva) + "\nTotal pagado: " + Moneda(pago.Importe)
            + "\n\nCódigo de acceso: " + pago.CodigoAcceso + "\nEl QR se adjunta a este correo. Preséntalo a tu entrenador en cada sesión."
            + "\n\n" + string.Join("\n", sesiones)
            + "\n\nVálido solo para esta clase y semana, en horario de Ciudad de México. Caduca al terminar el domingo "
            + pago.FinSemana.ToString("dd/MM/yyyy") + ". El registro abre 30 minutos antes de cada sesión y cierra al terminarla."
            + "\nAcceso personal: no compartas el QR. Un reembolso o la revocación de la inscripción desactiva el acceso."
            + "\nPolíticas aceptadas: " + pago.VersionPoliticas + ". Conserva tu código de pedido para aclaraciones con el club.";
        cuerpo.HtmlBody = "<!doctype html><html lang='es'><body style='margin:0;padding:24px;background:#f3f3f3;font-family:Arial,sans-serif;color:#171717'>"
            + "<div style='max-width:600px;margin:auto;background:white;padding:28px;border-top:5px solid #ff6a00;border-radius:12px'>"
            + "<h1 style='color:#ff6a00'>ADSPORT</h1>"
            + "<h2>¡Pago confirmado!</h2><p>Ya estás inscrito en <strong>" + E(pago.NombreClase) + "</strong>.</p>"
            + "<p>Pedido: <strong>" + E(pago.CodigoPedido) + "</strong><br>Semana: " + E(periodo) + "<br>Entrenador: " + E(pago.EntrenadorNombre) + "</p>"
            + "<p>Subtotal: " + E(Moneda(pago.Subtotal)) + "<br>IVA: " + E(Moneda(pago.Iva)) + "<br><strong>Total pagado: " + E(Moneda(pago.Importe)) + "</strong></p>"
            + "<img src='cid:" + imagen.ContentId + "' width='260' height='260' alt='QR de acceso a tu clase y semana' style='display:block;margin:20px auto'>"
            + "<p style='overflow-wrap:anywhere'><strong>Código de acceso:</strong><br>" + E(pago.CodigoAcceso) + "</p>"
            + "<h3>Tus sesiones</h3><ul>" + string.Join("", sesiones.Select(s => "<li>" + E(s) + "</li>")) + "</ul>"
            + "<p>Preséntalo a tu entrenador en cada sesión. Es personal y solo sirve para esta clase y semana, en horario de Ciudad de México. "
            + "Caduca al terminar el domingo " + pago.FinSemana.ToString("dd/MM/yyyy") + ". El registro abre 30 minutos antes de cada sesión y cierra al terminarla.</p>"
            + "<p>No compartas el QR. Un reembolso o la revocación de la inscripción desactiva el acceso.</p>"
            + "<p style='color:#666;font-size:12px'>Políticas aceptadas: " + E(pago.VersionPoliticas ?? "Compra anterior") + ". Conserva tu pedido para aclaraciones con el club.</p></div></body></html>";
        mensaje.Body = cuerpo.ToMessageBody();
        await EnviarMensaje(mensaje, ct);
    }
}
