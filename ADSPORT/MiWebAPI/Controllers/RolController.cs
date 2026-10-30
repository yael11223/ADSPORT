using ADSPORT.Data;
using ADSPORT.Models;
using Microsoft.AspNetCore.Mvc;

namespace ADSPORT.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class RolController : ControllerBase
    {
        private readonly RolData _rolData;

        public RolController(RolData rolData)
        {
            _rolData = rolData;
        }

        [HttpGet]
        public async Task<IActionResult> Get()
        {
            var lista = await _rolData.ObtenerRolesAsync();
            return Ok(lista);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> Get(int id)
        {
            var objeto = await _rolData.ObtenerRolPorIdAsync(id);
            if (objeto == null)
                return NotFound(new { isSuccess = false, respuesta = "Rol no encontrado" });

            return Ok(objeto);
        }

        [HttpPost]
        public async Task<IActionResult> Post([FromBody] Rol objeto)
        {
            var (esExito, mensaje) = await _rolData.RegistrarRolAsync(objeto);
            return Ok(new { isSuccess = esExito, respuesta = mensaje });
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Put(int id, [FromBody] Rol objeto)
        {
            objeto.IdRol = id; // Asegura que tome el ID enviado en la URL
            var (esExito, mensaje) = await _rolData.ActualizarRolAsync(objeto);
            return Ok(new { isSuccess = esExito, respuesta = mensaje });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var (esExito, mensaje) = await _rolData.EliminarRolAsync(id);
            return Ok(new { isSuccess = esExito, respuesta = mensaje });
        }
    }
}