/* ADSPORT - Limpieza manual de datos (migraciones 005 a 013).

   Antes de ejecutarlo: selecciona la base de ADSPORT en SQL Server Management
   Studio, guarda un respaldo y detén la aplicación para evitar nuevas operaciones.

   CONSERVA: USUARIO completo (incluidos QR, foto y fondo), ROL y PASSWORD.
   Conserva también la última recuperación consumida de cada usuario: es la
   marca que impide reutilizar sesiones anteriores al cambio de contraseña.

   ELIMINA: clases, horarios, deportes, canchas e imágenes de instalaciones,
   reservas, pagos, accesos, asistencias, correos de confirmación pendientes
   y los demás códigos de verificación. Incluye pagos de prueba y reales.

   Solo limpia SQL; no cancela ni reembolsa operaciones en Mercado Pago.
   No elimina estructuras ni reinicia identificadores.
   Este archivo es una herramienta manual: NO ejecutarlo como migración.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF @@TRANCOUNT <> 0
    THROW 51000, 'Ejecuta este script sin otra transacción abierta.', 1;
IF OBJECT_ID('dbo.USUARIO', 'U') IS NULL OR OBJECT_ID('dbo.ROL', 'U') IS NULL
   OR OBJECT_ID('dbo.PASSWORD', 'U') IS NULL OR OBJECT_ID('dbo.CLASE_ASISTENCIA', 'U') IS NULL
    THROW 51000, 'Selecciona la base de ADSPORT con las migraciones 005 a 013 instaladas.', 1;

BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE @Bloqueo int;
    EXEC @Bloqueo = sys.sp_getapplock
        @Resource = N'ADSPORT_AGENDA', @LockMode = 'Exclusive',
        @LockOwner = 'Transaction', @LockTimeout = 10000;
    IF @Bloqueo < 0
        THROW 51009, 'La aplicación está utilizando la agenda. Detén ADSPORT e intenta nuevamente.', 1;

    -- Primero se borran los registros que dependen de otros; las FK siguen activas.
    DELETE FROM dbo.CLASE_ASISTENCIA;
    DELETE FROM dbo.PAGO_CONFIRMACION_CORREO;
    DELETE FROM dbo.PAGO_MERCADOPAGO;
    DELETE FROM dbo.PAGO;
    DELETE FROM dbo.REGISTRO_ACCESO;
    DELETE FROM dbo.RESERVA;
    DELETE FROM dbo.HORARIO;
    DELETE FROM dbo.CANCHA_APERTURA;
    DELETE FROM dbo.CLASE;
    DELETE FROM dbo.CANCHA;
    DELETE FROM dbo.DEPORTE;

    -- Una sola marca de seguridad por cuenta; los códigos activos sí se eliminan.
    DECLARE @MarcasSeguridad TABLE (ID_CODIGO bigint PRIMARY KEY);
    INSERT INTO @MarcasSeguridad (ID_CODIGO)
    SELECT ID_CODIGO FROM (
        SELECT cv.ID_CODIGO,
            ROW_NUMBER() OVER (PARTITION BY cv.ID_USUARIO
                ORDER BY cv.FECHA_UTIMA_MODIFICACION DESC, cv.ID_CODIGO DESC) AS Posicion
        FROM dbo.CODIGO_VERIFICACION cv WITH (TABLOCKX, HOLDLOCK)
        JOIN dbo.USUARIO u ON u.ID_USUARIO = cv.ID_USUARIO
        WHERE cv.PROPOSITO = 'RECUPERACION' AND cv.VERIFICADO = 1 AND cv.UTILIZADO = 1
    ) AS Recuperaciones WHERE Posicion = 1;

    DELETE cv FROM dbo.CODIGO_VERIFICACION cv
    WHERE NOT EXISTS (SELECT 1 FROM @MarcasSeguridad m WHERE m.ID_CODIGO = cv.ID_CODIGO);

    COMMIT TRANSACTION;

    SELECT DB_NAME() AS BaseDeDatos, 'Limpieza completada' AS Resultado,
        (SELECT COUNT_BIG(*) FROM dbo.USUARIO) AS UsuariosConservados,
        (SELECT COUNT_BIG(*) FROM dbo.ROL) AS RolesConservados,
        (SELECT COUNT_BIG(*) FROM dbo.[PASSWORD]) AS ContrasenasConservadas,
        (SELECT COUNT_BIG(*) FROM dbo.CODIGO_VERIFICACION) AS MarcasDeSeguridadConservadas;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
