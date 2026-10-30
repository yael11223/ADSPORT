using ADSPORT.Data;
using ADSPORT.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using MiWebAPI.Models;

namespace ADSPORT.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UsuarioController : ControllerBase
    {
        private readonly UsuarioData _usuarioData;

        public UsuarioController(UsuarioData usuarioData)
        {
            _usuarioData = usuarioData;
        }

        [HttpGet]
        public async Task<IActionResult> Lista()
        {
            List<Usuario> Lista = await _usuarioData.Lista();
            return StatusCode(StatusCodes.Status200OK, Lista);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> Obtener(int id)
        {
            Usuario? objeto = await _usuarioData.Obtener(id);
            if (objeto == null)
                return NotFound(new { numeroError = 1, respuesta = "Usuario no encontrado" });

            return StatusCode(StatusCodes.Status200OK, objeto);
        }

        [HttpPost]
        public async Task<IActionResult> Crear([FromBody] Usuario objeto)
        {
            RespuestaOperacion resultado = await _usuarioData.Crear(objeto);
            return StatusCode(StatusCodes.Status200OK, resultado);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Editar(int id, [FromBody] Usuario objeto)
        {
            objeto.IdUsuario = id;
            RespuestaOperacion resultado = await _usuarioData.Editar(objeto);
            return StatusCode(StatusCodes.Status200OK, resultado);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Eliminar(int id)
        {
            RespuestaOperacion resultado = await _usuarioData.Eliminar(id);
            return StatusCode(StatusCodes.Status200OK, resultado);
        }
    }
}