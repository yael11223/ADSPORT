param(
    [Parameter(Mandatory=$true)][ValidateSet('enroll', 'credentials', 'technical_error_on', 'technical_error_off')][string]$Operation,
    [long]$ClassId = 0,
    [long]$UserId = 0,
    [long]$OtherUserId = 0
)
$ErrorActionPreference = 'Stop'
$builder = New-Object System.Data.SqlClient.SqlConnectionStringBuilder($env:ADSPORT_TEST_CONNECTION)
if ($builder.InitialCatalog -notmatch '^ADSPORT_CodexTest_[a-f0-9]{32}$' -or
    $builder.InitialCatalog -ne $env:ADSPORT_TEST_DATABASE) {
    throw 'La utilidad solo admite la base temporal creada por el runner.'
}
$connection = New-Object System.Data.SqlClient.SqlConnection($builder.ConnectionString)
try {
    $connection.Open()
    $command = $connection.CreateCommand()
    $null = $command.Parameters.Add('@class', [System.Data.SqlDbType]::BigInt)
    $command.Parameters['@class'].Value = $ClassId
    $null = $command.Parameters.Add('@user', [System.Data.SqlDbType]::BigInt)
    $command.Parameters['@user'].Value = $UserId
    $null = $command.Parameters.Add('@other', [System.Data.SqlDbType]::BigInt)
    $command.Parameters['@other'].Value = $OtherUserId
    if ($Operation -eq 'enroll') {
        $command.CommandText = @'
INSERT dbo.RESERVA (ID_USUARIO, ID_CLASE, FECHA_RESERVA, ESTATUS_RESERVA, FECHA_UTIMA_MODIFICACION)
VALUES (@user, @class, GETDATE(), 'CONFIRMADA', GETDATE()),
       (@user, @class, GETDATE(), 'CONFIRMADA', GETDATE()),
       (@other, @class, GETDATE(), 'PAGADA', GETDATE());
SELECT COUNT(DISTINCT ID_USUARIO) FROM dbo.RESERVA WHERE ID_CLASE = @class;
'@
    } elseif ($Operation -eq 'technical_error_on') {
        $command.CommandText = @'
EXEC(N'CREATE TRIGGER dbo.CodexTest_FalloApi ON dbo.CLASE AFTER INSERT AS BEGIN RAISERROR(''Fallo tecnico privado de prueba API.'',16,1); END;');
SELECT 1;
'@
    } elseif ($Operation -eq 'technical_error_off') {
        $command.CommandText = @'
IF OBJECT_ID('dbo.CodexTest_FalloApi','TR') IS NOT NULL DROP TRIGGER dbo.CodexTest_FalloApi;
SELECT 0;
'@
    } else {
        $command.CommandText = @'
SELECT COUNT(*) FROM dbo.USUARIO u
JOIN dbo.[PASSWORD] p ON p.ID_USUARIO = u.ID_USUARIO AND p.ID_PASSWORD = u.ID_PASSWORD
WHERE u.ID_USUARIO = @user AND LEN(p.[PASSWORD]) = 60 AND LEFT(p.[PASSWORD],4) IN ('$2a$','$2b$','$2y$');
'@
    }
    Write-Output $command.ExecuteScalar()
} finally { $connection.Dispose() }
