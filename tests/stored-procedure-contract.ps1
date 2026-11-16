# Solo admite una base aleatoria creada por run-trainer-integration.ps1.
# No lee ni modifica registros de ADSPORT. Los errores se prueban con OUTPUT, sin excepciones escapadas.
$ErrorActionPreference = 'Stop'
$builder = New-Object System.Data.SqlClient.SqlConnectionStringBuilder($env:ADSPORT_TEST_CONNECTION)
if ($builder.InitialCatalog -notmatch '^ADSPORT_CodexTest_[a-f0-9]{32}$' -or $builder.InitialCatalog -ne $env:ADSPORT_TEST_DATABASE) {
    throw 'Las pruebas de procedimientos requieren la base temporal del runner.'
}
$checks = [System.Collections.Generic.List[string]]::new()
$failure = $null
$connection = New-Object System.Data.SqlClient.SqlConnection($builder.ConnectionString)
$reportPath = Join-Path $PSScriptRoot 'artifacts\sql-contract-report.json'
$procedures = @('DEPORTE_LISTAR','ENTRENADOR_CLASES_CONSULTAR','ENTRENADOR_CLASE_GUARDAR',
    'ENTRENADOR_CLASE_DISPONIBILIDAD','CLASE_FOTO_PUBLICA','ENTRENADOR_CUENTA_OBTENER',
    'ENTRENADOR_FOTO_OBTENER','ENTRENADOR_PASSWORD_OBTENER','ENTRENADOR_PASSWORD_CAMBIAR','USUARIO_AGREGA',
    'DEPORTE_LISTA','DEPORTE_OBTENER','DEPORTE_GUARDAR','DEPORTE_DESACTIVAR','DEPORTE_IMAGEN_OBTENER','DEPORTE_IMAGEN_GUARDAR')

function Assert-Contract([string]$Name, [bool]$Condition) {
    if (-not $Condition) { throw $Name }
    $checks.Add($Name)
    Write-Host ('PASS SQL ' + $Name)
}

function Query-Scalar([string]$Sql) {
    $command = $connection.CreateCommand()
    try { $command.CommandText = $Sql; return $command.ExecuteScalar() }
    finally { $command.Dispose() }
}

function Fingerprint {
    return Query-Scalar @'
SELECT CONCAT(
 (SELECT COUNT_BIG(*) FROM dbo.DEPORTE),':',(SELECT CHECKSUM_AGG(BINARY_CHECKSUM(*)) FROM dbo.DEPORTE),'|',
 (SELECT COUNT_BIG(*) FROM dbo.USUARIO),':',(SELECT CHECKSUM_AGG(BINARY_CHECKSUM(*)) FROM dbo.USUARIO),'|',
 (SELECT COUNT_BIG(*) FROM dbo.[PASSWORD]),':',(SELECT CHECKSUM_AGG(BINARY_CHECKSUM(*)) FROM dbo.[PASSWORD]),'|',
 (SELECT COUNT_BIG(*) FROM dbo.CLASE),':',(SELECT CHECKSUM_AGG(BINARY_CHECKSUM(*)) FROM dbo.CLASE),'|',
 (SELECT COUNT_BIG(*) FROM dbo.HORARIO),':',(SELECT CHECKSUM_AGG(BINARY_CHECKSUM(*)) FROM dbo.HORARIO),'|',
 (SELECT COUNT_BIG(*) FROM dbo.RESERVA),':',(SELECT CHECKSUM_AGG(BINARY_CHECKSUM(*)) FROM dbo.RESERVA));
'@
}

function Invoke-Procedure([string]$Name, [hashtable]$Values = @{}) {
    if ($Name -notin $procedures) { throw 'Procedimiento fuera del alcance de pruebas.' }
    $command = $connection.CreateCommand()
    try {
        $command.CommandType = [System.Data.CommandType]::StoredProcedure
        $command.CommandText = 'dbo.' + $Name
        [System.Data.SqlClient.SqlCommandBuilder]::DeriveParameters($command)
        foreach ($parameter in $command.Parameters) {
            if ($parameter.Direction -eq [System.Data.ParameterDirection]::ReturnValue) { continue }
            $key = $parameter.ParameterName.TrimStart('@')
            if ($key -eq 'numeroError') { $parameter.Value = 987654 }
            elseif ($key -eq 'respuesta') { $parameter.Value = 'SENTINEL NO REEMPLAZADO' }
            elseif ($Values.ContainsKey($key) -and $null -ne $Values[$key]) { $parameter.Value = $Values[$key] }
            else { $parameter.Value = [DBNull]::Value }
        }
        $reader = $command.ExecuteReader()
        $rows = 0
        $first = $null
        try {
            do {
                while ($reader.Read()) {
                    if ($rows -eq 0 -and $reader.FieldCount -gt 0) { $first = $reader.GetValue(0) }
                    $rows++
                }
            } while ($reader.NextResult())
        } finally { $reader.Dispose() }
        # Los OUTPUT solo están disponibles después de cerrar el SqlDataReader.
        return [pscustomobject]@{ Code = [int]$command.Parameters['@numeroError'].Value
            Message = [string]$command.Parameters['@respuesta'].Value; Rows = $rows; First = $first }
    } finally { $command.Dispose() }
}

function Expect-Success([string]$Name, [hashtable]$Values = @{}, [string]$Label = $Name) {
    $result = Invoke-Procedure $Name $Values
    Assert-Contract ($Label + ': éxito OUTPUT 0 y respuesta') ($result.Code -eq 0 -and
        -not [string]::IsNullOrWhiteSpace($result.Message) -and $result.Message -ne 'SENTINEL NO REEMPLAZADO')
    return $result
}

function Expect-Error([string]$Name, [hashtable]$Values, [int]$Code, [string]$Label) {
    $before = Fingerprint
    $result = Invoke-Procedure $Name $Values
    Assert-Contract ($Label + ': error OUTPUT y respuesta') ($result.Code -eq $Code -and
        -not [string]::IsNullOrWhiteSpace($result.Message) -and $result.Message -ne 'SENTINEL NO REEMPLAZADO')
    Assert-Contract ($Label + ': no modifica datos') ((Fingerprint) -eq $before)
    return $result
}

try {
    $connection.Open()
    foreach ($name in $procedures) {
        $command = $connection.CreateCommand()
        try {
            $command.CommandType = [System.Data.CommandType]::StoredProcedure
            $command.CommandText = 'dbo.' + $name
            [System.Data.SqlClient.SqlCommandBuilder]::DeriveParameters($command)
            $number = $command.Parameters['@numeroError']
            $response = $command.Parameters['@respuesta']
            Assert-Contract ($name + ': metadata INT OUTPUT / VARCHAR(1000) OUTPUT') (
                $null -ne $number -and $number.SqlDbType -eq [System.Data.SqlDbType]::Int -and
                $number.Direction -in @([System.Data.ParameterDirection]::Output,[System.Data.ParameterDirection]::InputOutput) -and
                $null -ne $response -and $response.SqlDbType -eq [System.Data.SqlDbType]::VarChar -and $response.Size -eq 1000 -and
                $response.Direction -in @([System.Data.ParameterDirection]::Output,[System.Data.ParameterDirection]::InputOutput))
        } finally { $command.Dispose() }
    }

    $credentialCommand = $connection.CreateCommand()
    try {
        $credentialCommand.CommandType = [System.Data.CommandType]::StoredProcedure
        $credentialCommand.CommandText = 'dbo.USUARIO_AGREGA'
        [System.Data.SqlClient.SqlCommandBuilder]::DeriveParameters($credentialCommand)
        $initialHash = $credentialCommand.Parameters['@password_hash']
        Assert-Contract 'La integración conserva @password_hash VARCHAR(60) en el alta administrativa' (
            $null -ne $initialHash -and $initialHash.SqlDbType -eq [System.Data.SqlDbType]::VarChar -and $initialHash.Size -eq 60)
    } finally { $credentialCommand.Dispose() }

    # Cuentas independientes de las utilizadas por la prueba HTTP posterior.
    $trainerRole = [long](Query-Scalar "SELECT TOP(1) ID_ROL FROM dbo.ROL WHERE NOMBRE_ROL='ENTRENADOR'")
    $clientRole = [long](Query-Scalar "SELECT TOP(1) ID_ROL FROM dbo.ROL WHERE NOMBRE_ROL='USUARIO'")
    $sport = [long](Query-Scalar "SELECT TOP(1) ID_DEPORTE FROM dbo.DEPORTE WHERE NOMBRE_DEPORTE='Tenis'")
    $hash = '$2a$12$' + ('x' * 53)
    $newHash = '$2a$12$' + ('y' * 53)
    $employee = @{ id_rol=$trainerRole; nombre='Contrato SP'; apellido_paterno='Entrenador'; apellido_materno='Prueba'
        correo='sp-trainer@codex-test.invalid'; telefono='5512345678'; estatus='Activo'; codigo_qr='';
        foto=[byte[]](0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a); password_hash=$hash }
    $null = Expect-Success 'USUARIO_AGREGA' $employee
    $owner = [long](Query-Scalar "SELECT ID_USUARIO FROM dbo.USUARIO WHERE CORREO='sp-trainer@codex-test.invalid'")
    $otherEmployee = $employee.Clone(); $otherEmployee.correo='sp-other@codex-test.invalid'
    $null = Expect-Success 'USUARIO_AGREGA' $otherEmployee 'Alta de otro entrenador'
    $other = [long](Query-Scalar "SELECT ID_USUARIO FROM dbo.USUARIO WHERE CORREO='sp-other@codex-test.invalid'")
    $clientEmployee = $employee.Clone(); $clientEmployee.correo='sp-client@codex-test.invalid'; $clientEmployee.id_rol=$clientRole
    $null = Expect-Success 'USUARIO_AGREGA' $clientEmployee 'Alta de cliente aislado'
    $client = [long](Query-Scalar "SELECT ID_USUARIO FROM dbo.USUARIO WHERE CORREO='sp-client@codex-test.invalid'")

    $null = Expect-Success 'DEPORTE_LISTAR'
    $null = Expect-Success 'ENTRENADOR_CUENTA_OBTENER' @{id_usuario=$owner}
    $null = Expect-Success 'ENTRENADOR_FOTO_OBTENER' @{id_usuario=$owner}
    $password = Expect-Success 'ENTRENADOR_PASSWORD_OBTENER' @{id_usuario=$owner}
    Assert-Contract 'La lectura de credencial conserva el hash exacto para BCrypt del servidor' ($password.First -ceq $hash)
    $null = Expect-Success 'ENTRENADOR_PASSWORD_CAMBIAR' @{id_usuario=$owner; password_anterior=$hash; password_nuevo=$newHash}
    Assert-Contract 'Cambio de contraseña afecta solo a la cuenta solicitada' (
        (Query-Scalar "SELECT p.[PASSWORD] FROM dbo.USUARIO u JOIN dbo.[PASSWORD] p ON u.ID_PASSWORD=p.ID_PASSWORD WHERE u.ID_USUARIO=$owner") -ceq $newHash -and
        (Query-Scalar "SELECT p.[PASSWORD] FROM dbo.USUARIO u JOIN dbo.[PASSWORD] p ON u.ID_PASSWORD=p.ID_PASSWORD WHERE u.ID_USUARIO=$other") -ceq $hash)

    $class = @{IdEntrenador=$owner; IdClase=$null; IdDeporte=$sport; NombreClase='Contrato SP Tenis'; Descripcion='Clase de prueba del contrato SQL';
        Precio=[decimal]25; CupoMaximo=3; Disponible=$true; Ubicacion='Cancha SP';
        Horarios='[{"diaSemana":7,"horaInicio":"06:00","horaFin":"07:00"}]'}
    $saved = Expect-Success 'ENTRENADOR_CLASE_GUARDAR' $class
    $classId = [long]$saved.First
    Assert-Contract 'Guardar devuelve el identificador real de la clase' ($classId -gt 0)
    $null = Expect-Success 'ENTRENADOR_CLASES_CONSULTAR' @{IdEntrenador=$owner}
    $null = Expect-Success 'ENTRENADOR_CLASES_CONSULTAR' @{} 'Catálogo público'
    $null = Expect-Success 'CLASE_FOTO_PUBLICA' @{IdClase=$classId}
    $null = Expect-Success 'ENTRENADOR_CLASE_DISPONIBILIDAD' @{IdEntrenador=$owner; IdClase=$classId; Disponible=$false}
    $null = Expect-Success 'ENTRENADOR_CLASE_DISPONIBILIDAD' @{IdEntrenador=$owner; IdClase=$classId; Disponible=$true} 'Republicar clase'

    $invalid = $employee.Clone(); $invalid.correo='sp-invalid@codex-test.invalid'; $invalid.password_hash='invalid'
    $null = Expect-Error 'USUARIO_AGREGA' $invalid 400 'Alta rechaza hash inválido'
    $invalid = $employee.Clone(); $invalid.correo='sp-role-invalid@codex-test.invalid'; $invalid.id_rol=-1
    $null = Expect-Error 'USUARIO_AGREGA' $invalid 51001 'Alta rechaza rol inexistente'
    $null = Expect-Error 'USUARIO_AGREGA' $employee 51002 'Alta rechaza correo duplicado'
    $null = Expect-Error 'ENTRENADOR_CUENTA_OBTENER' @{id_usuario=0} 400 'Cuenta rechaza ID inválido'
    $null = Expect-Error 'ENTRENADOR_CUENTA_OBTENER' @{id_usuario=9223372036854775807} 404 'Cuenta inexistente'
    $null = Expect-Success 'ENTRENADOR_CUENTA_OBTENER' @{id_usuario=$client} 'Cuenta permite inspeccionar rol para política ASP.NET'
    $null = Expect-Error 'ENTRENADOR_FOTO_OBTENER' @{id_usuario=$client} 403 'Fotografía rechaza cliente'
    $null = Expect-Error 'ENTRENADOR_PASSWORD_OBTENER' @{id_usuario=$client} 403 'Credencial rechaza cliente'
    $null = Expect-Error 'ENTRENADOR_PASSWORD_CAMBIAR' @{id_usuario=$client; password_anterior=$hash; password_nuevo=$newHash} 403 'Cambio de contraseña rechaza cliente'
    $null = Expect-Error 'ENTRENADOR_PASSWORD_CAMBIAR' @{id_usuario=$owner; password_anterior=$hash; password_nuevo=$hash} 409 'Cambio rechaza hash anterior obsoleto'
    $null = Expect-Error 'ENTRENADOR_PASSWORD_CAMBIAR' @{id_usuario=$owner; password_anterior=$newHash; password_nuevo='incorrecto'} 400 'Cambio rechaza hash nuevo inválido'
    $null = Expect-Error 'ENTRENADOR_CLASES_CONSULTAR' @{IdEntrenador=$client} 51003 'Clases rechazan rol de cliente'
    $invalid = $class.Clone(); $invalid.Precio=-1
    $null = Expect-Error 'ENTRENADOR_CLASE_GUARDAR' $invalid 51000 'Guardar rechaza precio negativo'
    $invalid = $class.Clone(); $invalid.IdEntrenador=$client
    $null = Expect-Error 'ENTRENADOR_CLASE_GUARDAR' $invalid 51003 'Guardar rechaza cliente'
    $invalid = $class.Clone(); $invalid.IdClase=$classId; $invalid.IdEntrenador=$other
    $null = Expect-Error 'ENTRENADOR_CLASE_GUARDAR' $invalid 51004 'Guardar rechaza clase ajena'
    $null = Expect-Error 'ENTRENADOR_CLASE_DISPONIBILIDAD' @{IdEntrenador=$other; IdClase=$classId; Disponible=$false} 51004 'Disponibilidad rechaza clase ajena'
    $invalid = $class.Clone()
    $null = Expect-Error 'ENTRENADOR_CLASE_GUARDAR' $invalid 51009 'Guardar rechaza cruce con clase publicada'
    $null = Query-Scalar "INSERT dbo.RESERVA (ID_USUARIO,ID_CLASE,ESTATUS_RESERVA) VALUES ($client,$classId,'CONFIRMADA'),($other,$classId,'CONFIRMADA');"
    $invalid = $class.Clone(); $invalid.IdClase=$classId; $invalid.CupoMaximo=1
    $null = Expect-Error 'ENTRENADOR_CLASE_GUARDAR' $invalid 51009 'Guardar rechaza capacidad menor a inscritos'

    # Fallo técnico real durante la escritura: únicamente en esta base de pruebas.
    # El SP debe devolver ERROR_NUMBER/MESSAGE y deshacer CLASE/HORARIO, sin lanzar al cliente SQL.
    try {
        $null = Query-Scalar "CREATE TRIGGER dbo.CodexTest_FalloClase ON dbo.CLASE AFTER INSERT AS BEGIN RAISERROR('Fallo tecnico inducido de prueba aislada.',16,1); END;"
        $technical = $class.Clone(); $technical.Disponible=$false
        $technicalResult = Expect-Error 'ENTRENADOR_CLASE_GUARDAR' $technical 50000 'TRY CATCH devuelve fallo técnico y revierte transacción'
        Assert-Contract 'El error técnico contiene un mensaje útil' ($technicalResult.Message -like '*Fallo tecnico inducido*')
    } finally {
        $null = Query-Scalar "IF OBJECT_ID('dbo.CodexTest_FalloClase','TR') IS NOT NULL DROP TRIGGER dbo.CodexTest_FalloClase;"
    }
    # Mantiene las clases de contrato fuera del catálogo para la prueba HTTP posterior.
    $null = Expect-Success 'ENTRENADOR_CLASE_DISPONIBILIDAD' @{IdEntrenador=$owner; IdClase=$classId; Disponible=$false} 'Desactivar datos de contrato al terminar'

    $null = Expect-Success 'DEPORTE_LISTA' @{incluir_inactivos=$false}
    $sportValues = @{id_deporte=$null; nombre_deporte='Disciplina contrato integrado'; descripcion=('Detalle ' * 80); activo=$true}
    $sportCreated = Expect-Success 'DEPORTE_GUARDAR' $sportValues 'Alta de deporte con OUTPUT'
    $sportId = [long]$sportCreated.First
    Assert-Contract 'El alta de deporte devuelve ID existente en SQL' ($sportId -gt 0 -and
        [long](Query-Scalar "SELECT COUNT(*) FROM dbo.DEPORTE WHERE ID_DEPORTE=$sportId") -eq 1)
    $null = Expect-Success 'DEPORTE_OBTENER' @{id_deporte=$sportId; incluir_inactivos=$false}
    $sportValues.id_deporte=$sportId
    $sportValues.nombre_deporte='Disciplina contrato actualizada'
    $sportUpdated = Expect-Success 'DEPORTE_GUARDAR' $sportValues 'Edición de deporte con OUTPUT'
    Assert-Contract 'La edición conserva identificador y descripción extensa' ([long]$sportUpdated.First -eq $sportId -and
        [int](Query-Scalar "SELECT LEN(DESCRIPCION) FROM dbo.DEPORTE WHERE ID_DEPORTE=$sportId") -gt 100)
    $image = [Convert]::FromBase64String('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6BsAAAAASUVORK5CYII=')
    $imageValues = @{id_deporte=$sportId; imagen=$image; imagen_tipo='image/png'}
    $null = Expect-Success 'DEPORTE_IMAGEN_GUARDAR' $imageValues
    $imageRead = Expect-Success 'DEPORTE_IMAGEN_OBTENER' @{id_deporte=$sportId; incluir_inactivos=$false}
    Assert-Contract 'La imagen se conserva como bytes exactos en SQL' ([Convert]::ToBase64String([byte[]]$imageRead.First) -ceq [Convert]::ToBase64String($image))
    $null = Expect-Success 'DEPORTE_GUARDAR' $sportValues 'Edición posterior a carga de imagen'
    Assert-Contract 'Editar metadatos del deporte conserva la imagen almacenada' ([int](Query-Scalar "SELECT DATALENGTH(IMAGEN) FROM dbo.DEPORTE WHERE ID_DEPORTE=$sportId") -eq $image.Length)
    $null = Expect-Success 'DEPORTE_DESACTIVAR' @{id_deporte=$sportId}
    Assert-Contract 'Desactivar deporte conserva fila y fotografía' ([int](Query-Scalar "SELECT COUNT(*) FROM dbo.DEPORTE WHERE ID_DEPORTE=$sportId AND ACTIVO=0 AND DATALENGTH(IMAGEN)>0") -eq 1)
    $null = Expect-Success 'DEPORTE_OBTENER' @{id_deporte=$sportId; incluir_inactivos=$true} 'Consulta administrativa de deporte inactivo'
    $inactiveSport = Expect-Success 'DEPORTE_OBTENER' @{id_deporte=$sportId; incluir_inactivos=$false} 'Consulta pública de deporte inactivo sin filas'
    Assert-Contract 'El deporte inactivo no devuelve filas públicas' ($inactiveSport.Rows -eq 0)
    $inactiveImage = Expect-Success 'DEPORTE_IMAGEN_OBTENER' @{id_deporte=$sportId; incluir_inactivos=$false} 'Consulta pública de imagen inactiva sin filas'
    Assert-Contract 'La imagen del deporte inactivo no devuelve filas públicas' ($inactiveImage.Rows -eq 0)
    $null = Expect-Success 'DEPORTE_IMAGEN_OBTENER' @{id_deporte=$sportId; incluir_inactivos=$true} 'Imagen de deporte inactivo consultable por administración'
    $null = Expect-Success 'DEPORTE_GUARDAR' $sportValues 'Reactivar conserva ID de deporte'
    $duplicateSport = $sportValues.Clone(); $duplicateSport.id_deporte=$null
    $duplicateSport.nombre_deporte='  ' + $sportValues.nombre_deporte.ToUpperInvariant() + '  '
    $null = Expect-Error 'DEPORTE_GUARDAR' $duplicateSport 51009 'Guardar deporte rechaza nombre duplicado normalizado'
    $invalidSport = $sportValues.Clone(); $invalidSport.nombre_deporte=' '
    $null = Expect-Error 'DEPORTE_GUARDAR' $invalidSport 51000 'Guardar deporte rechaza nombre vacío'
    $invalidSport = $sportValues.Clone(); $invalidSport.id_deporte=9223372036854775807
    $null = Expect-Error 'DEPORTE_GUARDAR' $invalidSport 51004 'Edición rechaza deporte inexistente'
    $null = Expect-Error 'DEPORTE_DESACTIVAR' @{id_deporte=9223372036854775807} 51004 'Desactivación rechaza deporte inexistente'
    $invalidImage=$imageValues.Clone(); $invalidImage.imagen=[byte[]]::new(0)
    $null = Expect-Error 'DEPORTE_IMAGEN_GUARDAR' $invalidImage 51000 'Imagen SQL rechaza contenido vacío'
    $invalidImage=$imageValues.Clone(); $invalidImage.imagen_tipo='image/gif'
    $null = Expect-Error 'DEPORTE_IMAGEN_GUARDAR' $invalidImage 51000 'Imagen SQL rechaza tipo no permitido'
    $invalidImage=$imageValues.Clone(); $invalidImage.imagen=[byte[]]::new(5242881)
    $null = Expect-Error 'DEPORTE_IMAGEN_GUARDAR' $invalidImage 51000 'Imagen SQL rechaza tamaño excesivo'
} catch {
    $failure = $_.Exception.Message
    Write-Error -Message ('FAIL SQL ' + $failure) -ErrorAction Continue
} finally {
    $connection.Dispose()
    [pscustomobject]@{ passed=$checks.Count; procedures=$procedures; checks=@($checks); failure=$failure } |
        ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $reportPath -Encoding UTF8
}
if ($failure) { exit 1 }
exit 0
