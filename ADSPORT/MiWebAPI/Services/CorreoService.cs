
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using MimeKit.Utils;
using System.Net;

namespace ADSPORT.Services
{
    public class CorreoService
    {
        private readonly IConfiguration _configuration;
        private readonly IWebHostEnvironment _environment;

        // ========================================
        // CONSTRUCTOR
        // ========================================

        public CorreoService(
            IConfiguration configuration,
            IWebHostEnvironment environment)
        {
            _configuration = configuration;
            _environment = environment;
        }

        // ========================================
        // ENVIAR CÓDIGO DE VERIFICACIÓN
        // ========================================

        public async Task EnviarCodigo(
            string destinatario,
            string codigo)
        {
            var mensaje = CrearMensaje(destinatario, "Verifica tu cuenta | ADSPORT");

            // ========================================
            // 3. CREAR CUERPO HTML Y TEXTO
            // ========================================

            var cuerpo = new BodyBuilder();

            // Buscar banner dentro de wwwroot/images.
            string carpetaWeb =
                _environment.WebRootPath
                ?? Path.Combine(
                    _environment.ContentRootPath,
                    "wwwroot"
                );

            string rutaImagen = Path.Combine(
                carpetaWeb,
                "img",
                "home",
                "escena1"
            );

            string imagenHtml = "";

            // Insertar imagen solo si el archivo existe.
            if (File.Exists(rutaImagen))
            {
                var imagen =
                    cuerpo.LinkedResources.Add(rutaImagen);

                imagen.ContentId =
                    MimeUtils.GenerateMessageId();

                imagenHtml =
                    "<img src='cid:" +
                    imagen.ContentId +
                    "' alt='ADSPORT - Entrena y supera tus límites' " +
                    "width='600' " +
                    "style='display:block;width:100%;max-width:600px;" +
                    "height:auto;border:0;' />";
            }

            // ========================================
            // 4. PLANTILLA HTML PROFESIONAL
            // ========================================

            string html = @"
<!DOCTYPE html>
<html lang='es'>
<head>
    <meta charset='UTF-8'>
    <meta name='viewport'
          content='width=device-width, initial-scale=1.0'>
    <title>Verificación ADSPORT</title>
</head>

<body style='margin:0;padding:0;background-color:#eeeeee;
             font-family:Arial,Helvetica,sans-serif;'>

    <table role='presentation'
           width='100%'
           cellpadding='0'
           cellspacing='0'
           style='background-color:#eeeeee;'>

        <tr>
            <td align='center'
                style='padding:30px 12px;'>

                <table role='presentation'
                       width='600'
                       cellpadding='0'
                       cellspacing='0'
                       style='width:100%;max-width:600px;
                              background-color:#ffffff;'>

                    <!-- HEADER -->

                    <tr>
                        <td align='center'
                            style='background-color:#111111;
                                   padding:35px 20px 20px;'>

                            <div style='font-size:36px;
                                        font-weight:900;
                                        letter-spacing:-1px;
                                        color:#ffffff;'>

                                AD<span style='color:#ff6500;'>
                                SPORT</span>

                            </div>

                            <p style='margin:12px 0 0;
                                      font-size:11px;
                                      letter-spacing:3px;
                                      color:#bbbbbb;'>

                                TU ESFUERZO. TU HISTORIA.

                            </p>

                        </td>
                    </tr>

                    <!-- BANNER OPCIONAL -->

                    <tr>
                        <td style='background-color:#111111;
                                   padding:0;'>

                            __BANNER__

                        </td>
                    </tr>

                    <!-- BIENVENIDA -->

                    <tr>
                        <td align='center'
                            style='padding:38px 30px 12px;'>

                            <h1 style='margin:0 0 16px;
                                       font-size:27px;
                                       color:#111111;'>

                                ¡Bienvenido a ADSPORT!

                            </h1>

                            <p style='margin:0;
                                      font-size:15px;
                                      line-height:1.8;
                                      color:#555555;'>

                                Estás a un paso de comenzar
                                tu experiencia con nosotros.

                                <br>

                                Verifica tu correo electrónico
                                utilizando el siguiente código.

                            </p>

                        </td>
                    </tr>

                    <!-- CÓDIGO DE VERIFICACIÓN -->

                    <tr>
                        <td style='padding:25px 30px;'>

                            <table role='presentation'
                                   width='100%'
                                   cellpadding='0'
                                   cellspacing='0'
                                   style='background-color:#fff2e9;
                                          border:1px solid #ffd2b5;
                                          border-radius:12px;'>

                                <tr>
                                    <td align='center'
                                        style='padding:30px 15px;'>

                                        <p style='margin:0 0 14px;
                                                  font-size:11px;
                                                  font-weight:bold;
                                                  letter-spacing:2px;
                                                  color:#95502c;'>

                                            CÓDIGO DE VERIFICACIÓN

                                        </p>

                                        <div style='font-size:38px;
                                                    font-weight:900;
                                                    letter-spacing:7px;
                                                    color:#ff6500;'>

                                            __CODIGO__

                                        </div>

                                        <p style='margin:15px 0 0;
                                                  font-size:12px;
                                                  color:#666666;'>

                                            Válido durante 10 minutos

                                        </p>

                                    </td>
                                </tr>

                            </table>

                        </td>
                    </tr>

                    <!-- SEGURIDAD -->

                    <tr>
                        <td align='center'
                            style='padding:5px 35px 40px;'>

                            <p style='font-size:13px;
                                      line-height:1.8;
                                      color:#777777;
                                      margin:0;'>

                                Nunca compartas este código.
                                Si no solicitaste esta
                                verificación, puedes ignorar
                                este mensaje.

                            </p>

                        </td>
                    </tr>

                    <!-- FOOTER -->

                    <tr>
                        <td align='center'
                            style='background-color:#111111;
                                   padding:28px 20px;'>

                            <p style='margin:0 0 9px;
                                      color:#bbbbbb;
                                      font-size:12px;'>

                                © ADSPORT. Todos los derechos reservados.

                            </p>

                            <p style='margin:0;
                                      color:#ff6500;
                                      font-size:11px;
                                      font-weight:bold;
                                      letter-spacing:2px;'>

                                SUPERA · ENTRENA · CONQUISTA

                            </p>

                        </td>
                    </tr>

                </table>

            </td>
        </tr>

    </table>

</body>
</html>";

            // Sustituir el código y el banner.
            cuerpo.HtmlBody = html
                .Replace(
                    "__CODIGO__",
                    WebUtility.HtmlEncode(codigo)
                )
                .Replace(
                    "__BANNER__",
                    imagenHtml
                );

            // Versión de texto para clientes
            // de correo que no admiten HTML.
            cuerpo.TextBody =
                "¡Bienvenido a ADSPORT!\n\n" +
                "Tu código de verificación es: " +
                codigo + "\n\n" +
                "Este código tiene una validez de " +
                "10 minutos.\n\n" +
                "Si no lo solicitaste, ignora este mensaje.\n\n" +
                "Equipo ADSPORT.";

            mensaje.Body = cuerpo.ToMessageBody();

            await EnviarMensaje(mensaje);
        }

        public async Task EnviarCodigoRecuperacion(string destinatario, string codigo, CancellationToken cancellationToken = default)
        {
            var mensaje = CrearMensaje(destinatario, "Recupera tu contraseña | ADSPORT");
            var cuerpo = new BodyBuilder
            {
                TextBody = "Tu código para recuperar la contraseña de ADSPORT es: " + codigo
                    + "\n\nVence en 10 minutos y solo puede utilizarse una vez."
                    + "\nSi no solicitaste este cambio, ignora el mensaje. Tu contraseña sigue igual.",
                HtmlBody = "<!DOCTYPE html><html lang='es'><body style='margin:0;background:#080808;color:#fff;font-family:Arial,sans-serif;padding:32px'>"
                    + "<div style='max-width:520px;margin:auto;padding:32px;background:#171717;border-radius:16px;border-top:4px solid #ff6900'>"
                    + "<h1 style='color:#ff6900'>ADSPORT</h1><h2>Recupera tu contraseña</h2>"
                    + "<p>Introduce este código en la pantalla de recuperación:</p>"
                    + "<p style='font-size:36px;letter-spacing:8px;color:#ff6900;font-weight:bold'>"
                    + WebUtility.HtmlEncode(codigo) + "</p>"
                    + "<p>Vence en 10 minutos y solo puede utilizarse una vez. Nunca compartas este código.</p>"
                    + "<p style='color:#bbb'>Si no solicitaste este cambio, ignora el mensaje. Tu contraseña sigue igual.</p></div></body></html>"
            };
            mensaje.Body = cuerpo.ToMessageBody();
            await EnviarMensaje(mensaje, cancellationToken);
        }

        public async Task NotificarPasswordRestablecida(string destinatario, CancellationToken cancellationToken = default)
        {
            var mensaje = CrearMensaje(destinatario, "Tu contraseña se actualizó | ADSPORT");
            mensaje.Body = new TextPart("plain")
            {
                Text = "La contraseña de tu cuenta de ADSPORT se actualizó y las sesiones anteriores se cerraron.\n\n"
                    + "Si no hiciste este cambio, recupera tu contraseña y contacta a la administración del club."
            };
            await EnviarMensaje(mensaje, cancellationToken);
        }

        private MimeMessage CrearMensaje(string destinatario, string asunto)
        {
            var mensaje = new MimeMessage();
            mensaje.From.Add(new MailboxAddress(_configuration["Smtp:NombreRemitente"] ?? "ADSPORT",
                _configuration["Smtp:CorreoRemitente"] ?? throw new InvalidOperationException("Falta el correo remitente.")));
            mensaje.To.Add(MailboxAddress.Parse(destinatario));
            mensaje.Subject = asunto;
            return mensaje;
        }

        private async Task EnviarMensaje(MimeMessage mensaje, CancellationToken cancellationToken = default)
        {
            var servidor = _configuration["Smtp:Servidor"] ?? throw new InvalidOperationException("Falta el servidor SMTP.");
            var puerto = _configuration.GetValue<int>("Smtp:Puerto");
            // Solo permite SMTP sin TLS hacia loopback en Development y con activación explícita.
            var pruebasLocales = _environment.IsDevelopment() && _configuration.GetValue<bool>("Smtp:PermitirSinTlsLocal")
                && (servidor.Equals("localhost", StringComparison.OrdinalIgnoreCase)
                    || IPAddress.TryParse(servidor, out var ip) && IPAddress.IsLoopback(ip));
            var seguridad = pruebasLocales ? SecureSocketOptions.None
                : puerto == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls;
            using var smtp = new SmtpClient { Timeout = 10000 };
            await smtp.ConnectAsync(servidor, puerto, seguridad, cancellationToken);
            if (!pruebasLocales)
            {
                var usuario = _configuration["Smtp:Usuario"] ?? throw new InvalidOperationException("Falta el usuario SMTP.");
                var password = _configuration["Smtp:Password"];
                if (string.IsNullOrWhiteSpace(password)) throw new InvalidOperationException("Falta la contraseña SMTP.");
                await smtp.AuthenticateAsync(usuario, password, cancellationToken);
            }
            await smtp.SendAsync(mensaje, cancellationToken);
            await smtp.DisconnectAsync(true, cancellationToken);
        }
    }
}
