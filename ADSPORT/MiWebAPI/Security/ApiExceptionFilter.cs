using ADSPORT.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using System.Data.SqlClient;

namespace ADSPORT.Security;

public sealed class ApiExceptionFilter(ILogger<ApiExceptionFilter> logger) : IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        if (context.Exception is ADSPORT.Services.PagoProveedorException proveedor)
        {
            context.Result = new ObjectResult(new { isSuccess = false, numeroError = 503, respuesta = proveedor.Message }) { StatusCode = 503 };
            context.ExceptionHandled = true;
            return;
        }
        var numero = context.Exception is ProcedimientoException procedimiento ? procedimiento.NumeroError : 500;
        var status = numero switch { 400 or 51000 or 51001 => 400, 403 or 51003 => 403,
            404 or 51004 => 404, 409 or 51002 or 51009 => 409, _ => context.Exception is SqlException ? 503 : 500 };
        var mensaje = status < 500 ? context.Exception.Message :
            "No fue posible completar la operación. Comprueba la conexión y la actualización de la base de datos.";
        if (status >= 500) logger.LogError(context.Exception, "Error al atender {Ruta}", context.HttpContext.Request.Path);
        context.Result = new ObjectResult(new { isSuccess = false, numeroError = numero, respuesta = mensaje }) { StatusCode = status };
        context.ExceptionHandled = true;
    }
}
