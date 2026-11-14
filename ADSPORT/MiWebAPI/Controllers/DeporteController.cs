using ADSPORT.Data;
using ADSPORT.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using MiWebAPI.Models;

namespace ADSPORT.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class DeporteController : ControllerBase
    {
        private readonly DeporteData _deporteData;
        private readonly IWebHostEnvironment _env;

        public DeporteController(DeporteData deporteData, IWebHostEnvironment env)
        {
            _deporteData = deporteData;
            _env = env;
        }

        private string ObtenerRutaCarpetaImagenes()
        {
            string webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
            string carpeta = Path.Combine(webRoot, "img", "deportes");
            if (!Directory.Exists(carpeta))
            {
                Directory.CreateDirectory(carpeta);
            }
            return carpeta;
        }

        private string? BuscarImagenDeporte(int idDeporte)
        {
            string carpeta = ObtenerRutaCarpetaImagenes();
            string[] archivos = Directory.GetFiles(carpeta, $"deporte_{idDeporte}.*");
            if (archivos.Length == 0) return null;

            string nombreArchivo = Path.GetFileName(archivos[0]);
            long version = System.IO.File.GetLastWriteTimeUtc(archivos[0]).Ticks;
            return $"/img/deportes/{nombreArchivo}?v={version}";
        }

        private void BorrarImagenesAnteriores(int idDeporte)
        {
            string carpeta = ObtenerRutaCarpetaImagenes();
            foreach (string archivo in Directory.GetFiles(carpeta, $"deporte_{idDeporte}.*"))
            {
                System.IO.File.Delete(archivo);
            }
        }

        // 1. LISTAR DEPORTES (GET: api/Deporte)
        [HttpGet]
        public async Task<IActionResult> Lista()
        {
            List<Deporte> lista = await _deporteData.Lista();
            foreach (var item in lista)
            {
                item.ImagenUrl = BuscarImagenDeporte(item.IdDeporte);
            }
            return StatusCode(StatusCodes.Status200OK, lista);
        }

        // 2. OBTENER DEPORTE POR ID (GET: api/Deporte/5)
        [HttpGet("{id}")]
        public async Task<IActionResult> Obtener(int id)
        {
            Deporte? objeto = await _deporteData.Obtener(id);

            if (objeto == null)
            {
                return NotFound(new
                {
                    numeroError = 1,
                    respuesta = "Deporte no encontrado"
                });
            }

            objeto.ImagenUrl = BuscarImagenDeporte(objeto.IdDeporte);
            return StatusCode(StatusCodes.Status200OK, objeto);
        }

        // 3. CREAR DEPORTE (POST: api/Deporte)
        [HttpPost]
        public async Task<IActionResult> Crear([FromBody] Deporte objeto)
        {
            RespuestaOperacion resultado = await _deporteData.Crear(objeto);
            return StatusCode(StatusCodes.Status200OK, resultado);
        }

        // 4. EDITAR DEPORTE (PUT: api/Deporte/5)
        [HttpPut("{id}")]
        public async Task<IActionResult> Editar(int id, [FromBody] Deporte objeto)
        {
            objeto.IdDeporte = id;
            RespuestaOperacion resultado = await _deporteData.Editar(objeto);
            return StatusCode(StatusCodes.Status200OK, resultado);
        }

        // 5. SUBIR / ACTUALIZAR IMAGEN DE DEPORTE (POST: api/Deporte/5/imagen)
        [HttpPost("{id}/imagen")]
        public async Task<IActionResult> SubirImagen(int id, IFormFile archivo)
        {
            if (archivo == null || archivo.Length == 0)
            {
                return BadRequest(new
                {
                    numeroError = 1,
                    respuesta = "No se recibió ninguna imagen válida."
                });
            }

            string extension = Path.GetExtension(archivo.FileName).ToLowerInvariant();
            string[] permitidas = { ".jpg", ".jpeg", ".png", ".webp" };
            if (!permitidas.Contains(extension))
            {
                return BadRequest(new
                {
                    numeroError = 1,
                    respuesta = "Formato no permitido. Usa JPG, PNG o WEBP."
                });
            }

            BorrarImagenesAnteriores(id);

            string carpeta = ObtenerRutaCarpetaImagenes();
            string nombreFinal = $"deporte_{id}{extension}";
            string rutaCompleta = Path.Combine(carpeta, nombreFinal);

            using (var stream = new FileStream(rutaCompleta, FileMode.Create))
            {
                await archivo.CopyToAsync(stream);
            }

            return StatusCode(StatusCodes.Status200OK, new
            {
                numeroError = 0,
                respuesta = "Imagen guardada correctamente.",
                imagenUrl = BuscarImagenDeporte(id)
            });
        }

        // 6. ELIMINAR DEPORTE (DELETE: api/Deporte/5)
        [HttpDelete("{id}")]
        public async Task<IActionResult> Eliminar(int id)
        {
            RespuestaOperacion resultado = await _deporteData.Eliminar(id);
            if (resultado.NumeroError == 0)
            {
                BorrarImagenesAnteriores(id);
            }
            return StatusCode(StatusCodes.Status200OK, resultado);
        }
    }
}