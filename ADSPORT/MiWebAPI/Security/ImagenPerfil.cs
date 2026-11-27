namespace ADSPORT.Security;

public static class ImagenPerfil
{
    public const int MaximoBytes = 5 * 1024 * 1024;
    public static string? Tipo(byte[] datos) => datos.Length >= 3 && datos[0] == 255 && datos[1] == 216 && datos[2] == 255 ? "image/jpeg"
        : datos.Length >= 8 && datos.AsSpan(0,8).SequenceEqual(new byte[] {137,80,78,71,13,10,26,10}) ? "image/png"
        : datos.Length >= 12 && datos.AsSpan(0,4).SequenceEqual("RIFF"u8) && datos.AsSpan(8,4).SequenceEqual("WEBP"u8) ? "image/webp" : null;

    public static async Task<byte[]?> Leer(IFormFile? archivo)
    {
        if (archivo is null) return null;
        if (archivo.Length <= 0 || archivo.Length > MaximoBytes)
            throw new ADSPORT.Data.ProcedimientoException(51000,"Cada imagen debe tener contenido y pesar como máximo 5 MB.");
        using var memoria = new MemoryStream();
        await archivo.CopyToAsync(memoria);
        var datos = memoria.ToArray();
        if (datos.Length > MaximoBytes || Tipo(datos) is null)
            throw new ADSPORT.Data.ProcedimientoException(51000,"Selecciona una imagen JPG, PNG o WebP válida.");
        return datos;
    }
}
