param([string]$ConnectionString, [switch]$KeepForUi, [switch]$Cleanup)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$project = Join-Path $root 'ADSPORT\MiWebAPI'
$artifacts = Join-Path $PSScriptRoot 'artifacts'
$null = New-Item -ItemType Directory -Path $artifacts -Force
if (-not $ConnectionString) {
    $configuration = Get-Content -LiteralPath (Join-Path $project 'appsettings.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $ConnectionString = $configuration.ConnectionStrings.CadenaSQL
}
$builder = New-Object System.Data.SqlClient.SqlConnectionStringBuilder($ConnectionString)
$builder.set_InitialCatalog('master')
$masterConnectionString = $builder.ConnectionString
$database = 'ADSPORT_CodexTest_' + [Guid]::NewGuid().ToString('N')
if ($database -notmatch '^ADSPORT_CodexTest_[a-f0-9]{32}$') { throw 'Nombre temporal inválido.' }
$created = $false
$server = $null
$keep = $false
$sessionPath = Join-Path $artifacts 'session.json'

function Invoke-Sql([string]$sql, [string]$connectionString) {
    $connection = New-Object System.Data.SqlClient.SqlConnection($connectionString)
    try {
        $connection.Open()
        $command = $connection.CreateCommand()
        $command.CommandText = $sql
        $command.CommandTimeout = 120
        return $command.ExecuteScalar()
    } finally { $connection.Dispose() }
}

function Install-Script([string]$path) {
    $sql = [IO.File]::ReadAllText($path).Replace('[ADSPORT]', ('[' + $database + ']'))
    foreach ($batch in [Regex]::Split($sql, '(?im)^\s*GO\s*(?:--[^\r\n]*)?$')) {
        if (-not [string]::IsNullOrWhiteSpace($batch)) { $null = Invoke-Sql $batch $env:ADSPORT_TEST_CONNECTION }
    }
}

if ($Cleanup) {
    if (-not (Test-Path -LiteralPath $sessionPath)) { throw 'No hay una sesión de pruebas pendiente.' }
    $session = Get-Content -LiteralPath $sessionPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($session.Database -notmatch '^ADSPORT_CodexTest_[a-f0-9]{32}$') { throw 'Base temporal inválida.' }
    $oldServer = Get-Process -Id $session.ServerPid -ErrorAction SilentlyContinue
    if ($oldServer -and $oldServer.ProcessName -eq 'dotnet' -and $oldServer.StartTime.ToUniversalTime().Ticks.ToString() -eq $session.ServerStartTicks) {
        Stop-Process -Id $oldServer.Id -Force
    }
    $name = $session.Database
    $null = Invoke-Sql ("IF DB_ID(N'$name') IS NOT NULL BEGIN ALTER DATABASE [$name] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [$name]; END;") $masterConnectionString
    Remove-Item -LiteralPath $sessionPath
    Write-Output 'Servidor y base temporal de pruebas eliminados.'
    exit 0
}

try {
    $null = Invoke-Sql ("CREATE DATABASE [$database];") $masterConnectionString
    $created = $true
    $builder.set_InitialCatalog($database)
    $env:ADSPORT_TEST_DATABASE = $database
    $env:ADSPORT_TEST_CONNECTION = $builder.ConnectionString
    Write-Output 'Se creó una base temporal aislada; ADSPORT no se modifica.'
    Install-Script (Join-Path $root 'BaceDeDatos.sql')
    $seed = @'
INSERT dbo.ROL (NOMBRE_ROL, FECHA_UTIMA_MODIFICACION) VALUES ('USUARIO', GETDATE());
DECLARE @rol BIGINT = SCOPE_IDENTITY();
INSERT dbo.DEPORTE (NOMBRE_DEPORTE, DESCRIPCION) VALUES ('Disciplina preservada', 'Registro anterior a migraciones');
DECLARE @deporte BIGINT = SCOPE_IDENTITY();
INSERT dbo.USUARIO (ID_ROL,NOMBRE,APELLIDO_PATERNO,CORREO,TELEFONO,ESTATUS,FECHA__ULTIMA_MODIFICACION,ID_PASSWORD)
VALUES (@rol,'Preservado','Original','preservado@codex-test.invalid','5555555555','Inactivo',GETDATE(),0);
DECLARE @usuario BIGINT = SCOPE_IDENTITY();
INSERT dbo.[PASSWORD] (ID_USUARIO,[PASSWORD]) VALUES (@usuario, '$2a$12$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
UPDATE dbo.USUARIO SET ID_PASSWORD = SCOPE_IDENTITY() WHERE ID_USUARIO = @usuario;
INSERT dbo.CLASE (ID_DEPORTE,ID_ENTRENADOR,NOMBRE_CLASE,PRECIO,CUPO_MAXIMO) VALUES (@deporte,@usuario,'Clase preservada',99,9);
DECLARE @clase BIGINT = SCOPE_IDENTITY();
INSERT dbo.HORARIO (ID_CLASE,DIA_SEMANA,HORA_INICIO,HORA_FIN,CANCHA) VALUES (@clase,'20260105','10:00','11:00','Cancha original');
INSERT dbo.RESERVA (ID_USUARIO,ID_CLASE,ESTATUS_RESERVA) VALUES (@usuario,@clase,'CONFIRMADA');
'@
    $null = Invoke-Sql $seed $env:ADSPORT_TEST_CONNECTION
    $scripts = @('001_entrenadores_clases.sql','002_entrenadores_cuenta.sql','003_empleados_credenciales.sql')
    for ($iteration = 0; $iteration -lt 2; $iteration++) {
        foreach ($script in $scripts) { Install-Script (Join-Path $root ('database\' + $script)) }
    }
    $preserved = Invoke-Sql @'
SELECT COUNT(*) FROM dbo.USUARIO u JOIN dbo.[PASSWORD] p ON p.ID_USUARIO=u.ID_USUARIO AND p.ID_PASSWORD=u.ID_PASSWORD
JOIN dbo.CLASE c ON c.ID_ENTRENADOR=u.ID_USUARIO JOIN dbo.HORARIO h ON h.ID_CLASE=c.ID_CLASE
JOIN dbo.RESERVA rv ON rv.ID_CLASE=c.ID_CLASE
WHERE u.NOMBRE='Preservado' AND u.CORREO='preservado@codex-test.invalid' AND c.NOMBRE_CLASE='Clase preservada'
AND c.PRECIO=99 AND c.CUPO_MAXIMO=9 AND h.CANCHA='Cancha original' AND h.DIA_SEMANA='20260105'
AND h.DIA_ISO=1 AND rv.ESTATUS_RESERVA='CONFIRMADA';
'@ $env:ADSPORT_TEST_CONNECTION
    if ($preserved -ne 1) { throw 'Las migraciones no conservaron los registros de prueba.' }
    Write-Output 'PASS Migraciones idempotentes y registros anteriores conservados.'
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'stored-procedure-contract.ps1')
    if ($LASTEXITCODE -ne 0) { throw 'Falló el contrato OUTPUT de los procedimientos. Revisa tests/artifacts/sql-contract-report.json.' }
    $env:DOTNET_CLI_HOME = Join-Path $root '.dotnet-home'
    $env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
    # Compilar fuera de bin/Debug evita reemplazar los ensamblados que usa la API del usuario.
    $isolatedBuild = Join-Path $artifacts ('build\' + $database)
    & dotnet build (Join-Path $project 'ADSPORT.csproj') --no-restore --output $isolatedBuild --verbosity minimal
    if ($LASTEXITCODE -ne 0) { throw 'Falló la compilación.' }

    $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback,0)
    $listener.Start()
    $env:ADSPORT_TEST_PORT = $listener.LocalEndpoint.Port.ToString()
    $listener.Stop()
    $env:ConnectionStrings__CadenaSQL = $env:ADSPORT_TEST_CONNECTION
    # HTTP únicamente en localhost y Development; producción conserva cookies Secure.
    $env:ASPNETCORE_URLS = 'http://localhost:' + $env:ADSPORT_TEST_PORT
    $env:ASPNETCORE_ENVIRONMENT = 'Development'
    $env:DataProtection__KeysDirectory = Join-Path $artifacts 'keys'
    $env:Logging__EventLog__LogLevel__Default = 'None'
    $dll = Join-Path $isolatedBuild 'ADSPORT.dll'
    $server = Start-Process -FilePath 'dotnet' -ArgumentList ('"' + $dll + '"') -WorkingDirectory $project -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $artifacts 'server.stdout.log') -RedirectStandardError (Join-Path $artifacts 'server.stderr.log')
    & python (Join-Path $PSScriptRoot 'trainer_integration.py')
    if ($LASTEXITCODE -ne 0) { throw 'Fallaron las pruebas HTTP. Revisa tests/artifacts/integration-report.json.' }
    $fingerprintSql = @'
SELECT CONCAT(
 (SELECT CHECKSUM_AGG(BINARY_CHECKSUM(*)) FROM dbo.CLASE), '|',
 (SELECT CHECKSUM_AGG(BINARY_CHECKSUM(*)) FROM dbo.HORARIO), '|',
 (SELECT CHECKSUM_AGG(BINARY_CHECKSUM(*)) FROM dbo.RESERVA), '|',
 (SELECT CHECKSUM_AGG(BINARY_CHECKSUM(*)) FROM dbo.USUARIO), '|',
 (SELECT CHECKSUM_AGG(BINARY_CHECKSUM(*)) FROM dbo.[PASSWORD]));
'@
    $beforeReplay = Invoke-Sql $fingerprintSql $env:ADSPORT_TEST_CONNECTION
    foreach ($script in $scripts) { Install-Script (Join-Path $root ('database\' + $script)) }
    if ((Invoke-Sql $fingerprintSql $env:ADSPORT_TEST_CONNECTION) -ne $beforeReplay) {
        throw 'La reaplicación de migraciones modificó clases, reservas o cuentas existentes.'
    }
    Write-Output 'PASS Reaplicación de migraciones conserva clases, reservas, usuarios y contraseñas creados por API.'
    if ($KeepForUi) {
        [pscustomobject]@{
            Database = $database
            ServerPid = $server.Id
            ServerStartTicks = $server.StartTime.ToUniversalTime().Ticks.ToString()
            Url = $env:ASPNETCORE_URLS
        } | ConvertTo-Json | Set-Content -LiteralPath $sessionPath -Encoding UTF8
        $keep = $true
        Write-Output ('Servidor temporal conservado para revisión: ' + $env:ASPNETCORE_URLS)
        Write-Output 'Ejecuta el mismo script con -Cleanup al terminar la revisión.'
    }
} finally {
    if (-not $keep -and $server -and -not $server.HasExited) { Stop-Process -Id $server.Id -Force }
    if (-not $keep -and $created -and $database -match '^ADSPORT_CodexTest_[a-f0-9]{32}$') {
        $null = Invoke-Sql ("ALTER DATABASE [$database] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [$database];") $masterConnectionString
        Write-Output 'Se eliminó únicamente la base temporal creada por estas pruebas.'
    }
    Remove-Item Env:ADSPORT_TEST_CONNECTION -ErrorAction SilentlyContinue
    Remove-Item Env:ConnectionStrings__CadenaSQL -ErrorAction SilentlyContinue
}
