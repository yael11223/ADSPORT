using System.Data;
using System.Data.SqlClient;

namespace ADSPORT.Data;

// Conserva el contrato SQL del proyecto sin mezclar los errores con las filas consultadas.
public sealed class SqlResultadoProcedimiento
{
    private readonly SqlParameter _numeroError;
    private readonly SqlParameter _respuesta;

    private SqlResultadoProcedimiento(SqlCommand comando)
    {
        _numeroError = comando.Parameters.Add("@numeroError", SqlDbType.Int);
        _numeroError.Direction = ParameterDirection.Output;
        _respuesta = comando.Parameters.Add("@respuesta", SqlDbType.VarChar, 1000);
        _respuesta.Direction = ParameterDirection.Output;
    }

    public static SqlResultadoProcedimiento Agregar(SqlCommand comando) => new(comando);

    // ADO.NET entrega los parámetros OUTPUT después de cerrar el lector de resultados.
    public void Comprobar()
    {
        if (_numeroError.Value is null or DBNull)
            throw new ProcedimientoException(-1, "El procedimiento no devolvió su resultado de operación.");

        int numeroError = Convert.ToInt32(_numeroError.Value);
        if (numeroError != 0)
            throw new ProcedimientoException(numeroError,
                _respuesta.Value is null or DBNull ? "No fue posible completar la operación." :
                Convert.ToString(_respuesta.Value) ?? "No fue posible completar la operación.");
    }
}

public sealed class ProcedimientoException : Exception
{
    public int NumeroError { get; }
    public string Respuesta { get; }

    public ProcedimientoException(int numeroError, string respuesta) : base(respuesta)
    {
        NumeroError = numeroError;
        Respuesta = respuesta;
    }
}
