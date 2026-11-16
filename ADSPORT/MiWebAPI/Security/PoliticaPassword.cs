using System.Text;

namespace ADSPORT.Security;

public static class PoliticaPassword
{
    // BCrypt utiliza como máximo 72 bytes; rechazar el exceso evita truncamientos silenciosos.
    public static string? Validar(string? password)
    {
        if (string.IsNullOrWhiteSpace(password) || password.Length < 8)
            return "La contraseña debe tener al menos 8 caracteres.";
        if (Encoding.UTF8.GetByteCount(password) > 72)
            return "La contraseña no debe superar 72 bytes UTF-8.";
        if (!password.Any(char.IsUpper) || !password.Any(char.IsLower)
            || !password.Any(char.IsDigit) || !password.Any(c => !char.IsLetterOrDigit(c)))
            return "Incluye mayúscula, minúscula, número y símbolo en la contraseña.";
        return null;
    }
}
