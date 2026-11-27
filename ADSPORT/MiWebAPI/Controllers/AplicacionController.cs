using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text.RegularExpressions;

namespace ADSPORT.Controllers;

[ApiController,Route("api/Aplicacion"),AllowAnonymous]
public sealed class AplicacionController(IWebHostEnvironment entorno) : ControllerBase
{
    [HttpGet("precarga")]
    [ResponseCache(NoStore=true,Location=ResponseCacheLocation.None)]
    public IActionResult Precarga()
    {
        string raiz=Path.GetFullPath(entorno.WebRootPath);
        var paginas=new SortedSet<string>(StringComparer.Ordinal);
        var recursos=new SortedSet<string>(StringComparer.Ordinal);
        long version=0;
        var opciones=new EnumerationOptions { RecurseSubdirectories=true,AttributesToSkip=FileAttributes.ReparsePoint };
        var etiquetas=new Regex("<(?:script|link)\\b[^>]*?(?:src|href)\\s*=\\s*[\"']([^\"']+)[\"']",RegexOptions.IgnoreCase,TimeSpan.FromSeconds(1));
        foreach (var archivo in Directory.EnumerateFiles(raiz,"*.html",opciones))
        {
            string pagina="/"+Path.GetRelativePath(raiz,archivo).Replace('\\','/');
            paginas.Add(pagina); version=Math.Max(version,System.IO.File.GetLastWriteTimeUtc(archivo).Ticks);
            var origen=new Uri("https://adsport.local"+pagina);
            foreach (Match etiqueta in etiquetas.Matches(System.IO.File.ReadAllText(archivo)))
            {
                if (!Uri.TryCreate(origen,etiqueta.Groups[1].Value,out var ruta) || ruta.Host!="adsport.local" || !string.IsNullOrEmpty(ruta.UserInfo)) continue;
                string extension=Path.GetExtension(ruta.AbsolutePath).ToLowerInvariant();
                if (extension is not (".css" or ".js")) continue;
                string local=Path.GetFullPath(Path.Combine(raiz,ruta.AbsolutePath.TrimStart('/').Replace('/',Path.DirectorySeparatorChar)));
                if (!local.StartsWith(raiz+Path.DirectorySeparatorChar,StringComparison.OrdinalIgnoreCase) || !System.IO.File.Exists(local)) continue;
                recursos.Add(ruta.PathAndQuery); version=Math.Max(version,System.IO.File.GetLastWriteTimeUtc(local).Ticks);
            }
        }
        return Ok(new { version=version.ToString(System.Globalization.CultureInfo.InvariantCulture),paginas,recursos });
    }
}
