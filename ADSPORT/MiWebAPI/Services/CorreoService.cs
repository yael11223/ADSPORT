
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
            // ========================================
            // 1. CONFIGURACIÓN SMTP
            // ========================================

            string servidor =
                _configuration["Smtp:Servidor"]
                ?? throw new Exception(
                    "Falta el servidor SMTP."
                );

            int puerto = int.Parse(
                _configuration["Smtp:Puerto"]
                ?? throw new Exception(
                    "Falta el puerto SMTP."
                )
            );

            string remitente =
                _configuration["Smtp:CorreoRemitente"]
                ?? throw new Exception(
                    "Falta el correo remitente."
                );

            string usuario =
                _configuration["Smtp:Usuario"]
                ?? throw new Exception(
                    "Falta el usuario SMTP."
                );

            string password =
                _configuration["Smtp:Password"]
                ?? throw new Exception(
                    "Falta la contraseña SMTP."
                );

            if (string.IsNullOrWhiteSpace(password))
            {
                throw new Exception(
                    "La contraseña SMTP está vacía."
                );
            }

            string nombreRemitente =
                _configuration["Smtp:NombreRemitente"]
                ?? "ADSPORT";

            // ========================================
            // 2. CREAR CORREO
            // ========================================

            var mensaje = new MimeMessage();

            mensaje.From.Add(
                new MailboxAddress(
                    nombreRemitente,
                    remitente
                )
            );

            mensaje.To.Add(
                MailboxAddress.Parse(destinatario)
            );

            mensaje.Subject =
                "Verifica tu cuenta | ADSPORT";

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

            // ========================================
            // 5. CONEXIÓN SMTP DE HOSTINGER
            // ========================================

            SecureSocketOptions seguridad =
                puerto == 465
                    ? SecureSocketOptions.SslOnConnect
                    : SecureSocketOptions.StartTls;

            using var smtp = new SmtpClient();

            await smtp.ConnectAsync(
                servidor,
                puerto,
                seguridad
            );

            await smtp.AuthenticateAsync(
                usuario,
                password
            );

            await smtp.SendAsync(mensaje);

            await smtp.DisconnectAsync(true);
        }
    }
}
