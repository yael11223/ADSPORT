using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;


namespace ADSPORT.Services
{
    public class CorreoService
    {
        private readonly IConfiguration _configuration;

        // ========================================
        // CONSTRUCTOR
        // ========================================

        public CorreoService(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        // ========================================
        // ENVIAR CÓDIGO DE VERIFICACIÓN
        // ========================================

        public async Task EnviarCodigo(string destinatario, string codigo)
        {
            // Obtener configuración SMTP
            string servidor = _configuration["Smtp:Servidor"]
                ?? throw new Exception("No se configuró el servidor SMTP.");

            int puerto = int.Parse(
                _configuration["Smtp:Puerto"]
                ?? throw new Exception("No se configuró el puerto SMTP.")
            );

            string remitente = _configuration["Smtp:CorreoRemitente"]
                ?? throw new Exception("No se configuró el correo remitente.");

            string usuario = _configuration["Smtp:Usuario"]
                ?? throw new Exception("No se configuró el usuario SMTP.");

            string password = _configuration["Smtp:Password"]
                ?? throw new Exception("No se configuró la contraseña SMTP.");

            string nombreRemitente =
                _configuration["Smtp:NombreRemitente"] ?? "ADSPORT";

            // ========================================
            // CREAR MENSAJE
            // ========================================

            var mensaje = new MimeMessage();

            mensaje.From.Add(
                new MailboxAddress(nombreRemitente, remitente)
            );

            mensaje.To.Add(
                MailboxAddress.Parse(destinatario)
            );

            mensaje.Subject = "Código de verificación - ADSPORT";

            mensaje.Body = new TextPart("plain")
            {
                Text =
                    "¡Bienvenido a ADSPORT!\n\n" +
                    "Hemos recibido una solicitud para verificar tu correo.\n\n" +
                    "Tu código de verificación es:\n\n" +
                    codigo + "\n\n" +
                    "Este código tiene una validez de 10 minutos.\n\n" +
                    "Si no solicitaste este código, ignora este mensaje.\n\n" +
                    "Equipo ADSPORT."
            };

            // ========================================
            // CONECTAR CON GMAIL
            // ========================================

            using (var smtp = new SmtpClient())
            {
                await smtp.ConnectAsync(
                    servidor,
                    puerto,
                    SecureSocketOptions.StartTls
                );

                // Autenticación de Gmail
                await smtp.AuthenticateAsync(
                    usuario,
                    password
                );

                // Enviar correo
                await smtp.SendAsync(mensaje);

                // Cerrar conexión
                await smtp.DisconnectAsync(true);
            }
        }
    }
}
