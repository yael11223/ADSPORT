using System.Security.Cryptography;
using System.Text;

namespace ADSPORT.Security;

public static class FirmaMercadoPago
{
    // Manifest documentado por Mercado Pago; data.id conserva exactamente su capitalización.
    public static bool Validar(string? firma, string? requestId, string? dataId, string secreto)
    {
        if (string.IsNullOrWhiteSpace(firma) || firma.Length > 1024 || string.IsNullOrWhiteSpace(requestId)
            || requestId.Length > 200 || string.IsNullOrWhiteSpace(dataId) || string.IsNullOrWhiteSpace(secreto)) return false;
        var partes = firma.Split(',').Select(p => p.Trim().Split('=', 2)).ToArray();
        var marcas = partes.Where(p => p.Length == 2 && p[0] == "ts").Select(p => p[1]).ToArray();
        if (marcas.Length != 1 || !long.TryParse(marcas[0], out var ts) || ts <= 0) return false;
        string manifest = $"id:{dataId.Trim()};request-id:{requestId.Trim()};ts:{marcas[0]};";
        byte[] esperado = HMACSHA256.HashData(Encoding.UTF8.GetBytes(secreto), Encoding.UTF8.GetBytes(manifest));
        foreach (var parte in partes.Where(p => p.Length == 2 && p[0] == "v1" && p[1].Length == 64))
        {
            try { if (CryptographicOperations.FixedTimeEquals(esperado, Convert.FromHexString(parte[1]))) return true; }
            catch (FormatException) { }
        }
        // Los reenvíos son seguros mediante el estado canónico de la API y la idempotencia SQL.
        return false;
    }
}
