using ADSPORT.Data;
using ADSPORT.Models;
using Microsoft.AspNetCore.Mvc;

namespace ADSPORT.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ClaseController : ControllerBase
    {
        private readonly ClaseData _claseData;

        public ClaseController(ClaseData claseData)
        {
            _claseData = claseData;
        }

        // GET: api/Clase/PorDeporte/1
        [HttpGet("PorDeporte/{idDeporte:long}")]
        public async Task<IActionResult> ListaPorDeporte(long idDeporte)
        {
            var lista = await _claseData.ListaPorDeporte(idDeporte);
            return Ok(lista);
        }

        // GET: api/Clase/PorEntrenador/1
        [HttpGet("PorEntrenador/{idEntrenador:long}")]
        public async Task<IActionResult> ListaPorEntrenador(long idEntrenador)
        {
            var lista = await _claseData.ListaPorEntrenador(idEntrenador);
            return Ok(lista);
        }

        // POST: api/Clase
        [HttpPost]
        public async Task<IActionResult> Crear([FromBody] Clase objeto)
        {
            if (objeto == null || string.IsNullOrWhiteSpace(objeto.NombreClase))
                return BadRequest(new { numeroError = -1, respuesta = "El nombre de la clase es obligatorio." });

            var resultado = await _claseData.Crear(objeto);

            if (resultado.NumeroError != 0)
                return BadRequest(resultado);

            return Ok(resultado);
        }

        // DELETE: api/Clase/5
        [HttpDelete("{idClase:long}")]
        public async Task<IActionResult> Eliminar(long idClase)
        {
            var resultado = await _claseData.Eliminar(idClase);

            if (resultado.NumeroError != 0)
                return BadRequest(resultado);

            return Ok(resultado);
        }
    }
}