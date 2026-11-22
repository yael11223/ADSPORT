using System.Security.Cryptography;
using System.Text;

namespace ADSPORT.Security;

public static class CodigoVerificacionSeguro
{
    public static string CrearHash(IConfiguration configuration, string correo, string codigo, bool recuperacion = false)
    {
        var clave = Convert.FromBase64String(configuration["Verificacion:ClaveHmac"]
            ?? throw new InvalidOperationException("Falta configurar la clave HMAC de verificación."));
        if (clave.Length < 32)
            throw new InvalidOperationException("La clave HMAC debe tener al menos 32 bytes.");
        var contenido = (recuperacion ? "recuperacion:" : "") + correo.Trim().ToLowerInvariant() + ":" + codigo;
        return Convert.ToHexString(HMACSHA256.HashData(clave, Encoding.UTF8.GetBytes(contenido)));
    }
}
