using QRCoder;

namespace ADSPORT.Services;

public static class QrAccesoClase
{
    public const string Prefijo = "ADSPORT:ACCESO:";
    public static byte[] Generar(string codigo)
    {
        using var generador = new QRCodeGenerator();
        using var datos = generador.CreateQrCode(Prefijo + codigo, QRCodeGenerator.ECCLevel.Q);
        using var png = new PngByteQRCode(datos);
        return png.GetGraphic(8);
    }
}
