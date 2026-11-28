-- Alinea únicamente los dos procedimientos del registro con la API actual.
-- No elimina tablas ni cuentas. Ejecutable varias veces sobre la base existente.
-- CODIGO_VERIFICACION debe incluir ID_USUARIO, PROPOSITO y FECHA_EXPIRACION.

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[CODIGO_VERIFICACION_VALIDAR]
    @CORREO VARCHAR(150),
    @CODIGO_HASH VARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @ID_CODIGO BIGINT;
    DECLARE @HASH_GUARDADO VARCHAR(255);
    DECLARE @FECHA_EXPIRACION DATETIME;
    DECLARE @INTENTOS INT;
    DECLARE @FECHA_ACTUAL DATETIME = GETUTCDATE();

    -- Validar correo electrónico
    IF @CORREO IS NULL
       OR LTRIM(RTRIM(@CORREO)) = ''
       OR @CORREO NOT LIKE '%_@_%._%'
    BEGIN
        SELECT
            400 AS CODIGO_RESPUESTA,
            'El correo electrónico no es válido.' AS MENSAJE;
        RETURN;
    END;

    -- Validar hash recibido
    IF @CODIGO_HASH IS NULL
       OR LTRIM(RTRIM(@CODIGO_HASH)) = ''
    BEGIN
        SELECT
            422 AS CODIGO_RESPUESTA,
            'El hash del código es obligatorio.' AS MENSAJE;
        RETURN;
    END;

    BEGIN TRY

        BEGIN TRANSACTION;

        -- Obtener el último código activo del correo
        SELECT TOP 1
            @ID_CODIGO = ID_CODIGO,
            @HASH_GUARDADO = CODIGO_HASH,
            @FECHA_EXPIRACION = FECHA_EXPIRACION,
            @INTENTOS = INTENTOS
        FROM dbo.CODIGO_VERIFICACION WITH (UPDLOCK, HOLDLOCK)
        WHERE CORREO = @CORREO
          AND PROPOSITO = 'REGISTRO'
          AND UTILIZADO = 0
        ORDER BY FECHA_CREACION DESC, ID_CODIGO DESC;

        -- Comprobar existencia
        IF @ID_CODIGO IS NULL
        BEGIN
            COMMIT TRANSACTION;

            SELECT
                404 AS CODIGO_RESPUESTA,
                'No existe un código de verificación activo.' AS MENSAJE;
            RETURN;
        END;

        -- Comprobar expiración
        IF @FECHA_EXPIRACION <= @FECHA_ACTUAL
        BEGIN
            UPDATE dbo.CODIGO_VERIFICACION
            SET
                UTILIZADO = 1,
                FECHA_UTIMA_MODIFICACION = @FECHA_ACTUAL
            WHERE ID_CODIGO = @ID_CODIGO;

            COMMIT TRANSACTION;

            SELECT
                410 AS CODIGO_RESPUESTA,
                'El código de verificación ha expirado.' AS MENSAJE;
            RETURN;
        END;

        -- Comprobar límite de intentos
        IF @INTENTOS >= 5
        BEGIN
            UPDATE dbo.CODIGO_VERIFICACION
            SET
                UTILIZADO = 1,
                FECHA_UTIMA_MODIFICACION = @FECHA_ACTUAL
            WHERE ID_CODIGO = @ID_CODIGO;

            COMMIT TRANSACTION;

            SELECT
                429 AS CODIGO_RESPUESTA,
                'Se ha superado el límite de intentos.' AS MENSAJE;
            RETURN;
        END;

        -- Comprobar si el código es incorrecto
        IF @HASH_GUARDADO <> @CODIGO_HASH
        BEGIN
            SET @INTENTOS = @INTENTOS + 1;

            UPDATE dbo.CODIGO_VERIFICACION
            SET
                INTENTOS = @INTENTOS,
                UTILIZADO = CASE
                    WHEN @INTENTOS >= 5 THEN 1
                    ELSE 0
                END,
                FECHA_UTIMA_MODIFICACION = @FECHA_ACTUAL
            WHERE ID_CODIGO = @ID_CODIGO;

            COMMIT TRANSACTION;

            IF @INTENTOS >= 5
            BEGIN
                SELECT
                    429 AS CODIGO_RESPUESTA,
                    'Se ha superado el límite de intentos.' AS MENSAJE;
            END
            ELSE
            BEGIN
                SELECT
                    401 AS CODIGO_RESPUESTA,
                    'El código de verificación es incorrecto.' AS MENSAJE;
            END;

            RETURN;
        END;

        -- Código correcto: marcar como verificado
        UPDATE dbo.CODIGO_VERIFICACION
        SET
            UTILIZADO = 1,
            VERIFICADO = 1,
            FECHA_UTIMA_MODIFICACION = @FECHA_ACTUAL
        WHERE ID_CODIGO = @ID_CODIGO;

        COMMIT TRANSACTION;

        SELECT
            200 AS CODIGO_RESPUESTA,
            'Correo electrónico verificado correctamente.' AS MENSAJE,
            @ID_CODIGO AS ID_CODIGO;

    END TRY

    BEGIN CATCH

        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        SELECT
            500 AS CODIGO_RESPUESTA,
            'Ocurrió un error interno al validar el código.' AS MENSAJE;

    END CATCH;
END;
GO

SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE OR ALTER PROCEDURE [dbo].[NUEVO_USUARIO_AGREGA]
    @NOMBRE VARCHAR(100),
    @APELLIDO_PATERNO VARCHAR(100),
    @CORREO VARCHAR(100),
    @PASSWORD_HASH VARCHAR(60),
    @ID_CODIGO_VERIFICADO BIGINT,
    @APELLIDO_MATERNO VARCHAR(100) = NULL,
    @TELEFONO VARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @ID_USUARIO BIGINT;
    DECLARE @ID_PASSWORD BIGINT;
    DECLARE @ID_ROL BIGINT;
    DECLARE @FECHA_ACTUAL DATETIME = GETUTCDATE();

    -- Validar datos obligatorios
    IF NULLIF(LTRIM(RTRIM(@NOMBRE)), '') IS NULL
       OR NULLIF(LTRIM(RTRIM(@APELLIDO_PATERNO)), '') IS NULL
       OR NULLIF(LTRIM(RTRIM(@CORREO)), '') IS NULL
    BEGIN
        SELECT
            400 AS CODIGO_RESPUESTA,
            'Faltan datos obligatorios.' AS MENSAJE,
            CAST(NULL AS BIGINT) AS ID_USUARIO;
        RETURN;
    END;

    -- Validar formato básico del correo
    IF @CORREO NOT LIKE '%_@_%._%'
    BEGIN
        SELECT
            400 AS CODIGO_RESPUESTA,
            'El correo electrónico no es válido.' AS MENSAJE,
            CAST(NULL AS BIGINT) AS ID_USUARIO;
        RETURN;
    END;

    -- Validar hash bcrypt
    IF @PASSWORD_HASH IS NULL
       OR LEN(@PASSWORD_HASH) <> 60
       OR LEFT(@PASSWORD_HASH, 4) NOT IN ('$2a$', '$2b$', '$2y$')
    BEGIN
        SELECT
            422 AS CODIGO_RESPUESTA,
            'El hash de la contraseña no tiene un formato válido.' AS MENSAJE,
            CAST(NULL AS BIGINT) AS ID_USUARIO;
        RETURN;
    END;

    BEGIN TRY

        BEGIN TRANSACTION;

        -- Buscar automáticamente el ID del rol USUARIO
        SELECT TOP 1
            @ID_ROL = ID_ROL
        FROM dbo.ROL
        WHERE UPPER(LTRIM(RTRIM(NOMBRE_ROL))) IN ('USUARIO','SIN ASIGNAR')
        ORDER BY CASE WHEN UPPER(LTRIM(RTRIM(NOMBRE_ROL)))='USUARIO' THEN 0 ELSE 1 END,ID_ROL;

        -- Validar que exista el rol USUARIO
        IF @ID_ROL IS NULL
        BEGIN
            ROLLBACK TRANSACTION;

            SELECT
                404 AS CODIGO_RESPUESTA,
                'No se encontró un rol básico para registrar la cuenta.' AS MENSAJE,
                CAST(NULL AS BIGINT) AS ID_USUARIO;
            RETURN;
        END;

        -- Verificar que el correo no esté registrado
        IF EXISTS (
            SELECT 1
            FROM dbo.USUARIO WITH (UPDLOCK, HOLDLOCK)
            WHERE CORREO = @CORREO
        )
        BEGIN
            ROLLBACK TRANSACTION;

            SELECT
                409 AS CODIGO_RESPUESTA,
                'El correo electrónico ya está registrado.' AS MENSAJE,
                CAST(NULL AS BIGINT) AS ID_USUARIO;
            RETURN;
        END;

        -- La cookie protegida de la API identifica exactamente esta verificación.
        -- Mantener el bloqueo hasta crear el usuario evita consumirla dos veces.
        IF NOT EXISTS (
            SELECT 1
            FROM dbo.CODIGO_VERIFICACION WITH (UPDLOCK, HOLDLOCK)
            WHERE ID_CODIGO = @ID_CODIGO_VERIFICADO
              AND CORREO = @CORREO
              AND PROPOSITO = 'REGISTRO'
              AND VERIFICADO = 1
              AND UTILIZADO = 1
              AND ID_USUARIO IS NULL
              AND FECHA_EXPIRACION > @FECHA_ACTUAL
        )
        BEGIN
            ROLLBACK TRANSACTION;

            SELECT
                403 AS CODIGO_RESPUESTA,
                'El correo electrónico no tiene una verificación válida.' AS MENSAJE,
                CAST(NULL AS BIGINT) AS ID_USUARIO;
            RETURN;
        END;

        -- Registrar usuario con el ID del rol USUARIO
        INSERT INTO dbo.USUARIO
        (
            ID_ROL,
            NOMBRE,
            APELLIDO_PATERNO,
            APELLIDO_MATERNO,
            CORREO,
            TELEFONO,
            ESTATUS,
            CODIGO_QR,
            FECHA__ULTIMA_MODIFICACION,
            ID_PASSWORD
        )
        VALUES
        (
            @ID_ROL,
            @NOMBRE,
            @APELLIDO_PATERNO,
            @APELLIDO_MATERNO,
            @CORREO,
            @TELEFONO,
            'ACTIVO',
            'ADS:' + REPLACE(CONVERT(varchar(36), NEWID()), '-', ''),
            @FECHA_ACTUAL,
            NULL
        );

        SET @ID_USUARIO = CAST(SCOPE_IDENTITY() AS BIGINT);

        -- Registrar hash de contraseña
        INSERT INTO dbo.[PASSWORD]
        (
            ID_USUARIO,
            [PASSWORD]
        )
        VALUES
        (
            @ID_USUARIO,
            @PASSWORD_HASH
        );

        SET @ID_PASSWORD = CAST(SCOPE_IDENTITY() AS BIGINT);

        -- Relacionar usuario con su contraseña
        UPDATE dbo.USUARIO
        SET
            ID_PASSWORD = @ID_PASSWORD,
            FECHA__ULTIMA_MODIFICACION = @FECHA_ACTUAL
        WHERE ID_USUARIO = @ID_USUARIO;

        -- Vincular la autorización consumida a la cuenta dentro de la misma transacción.
        UPDATE dbo.CODIGO_VERIFICACION
        SET ID_USUARIO = @ID_USUARIO,
            FECHA_UTIMA_MODIFICACION = @FECHA_ACTUAL
        WHERE ID_CODIGO = @ID_CODIGO_VERIFICADO;

        COMMIT TRANSACTION;

        -- Respuesta exitosa
        SELECT
            201 AS CODIGO_RESPUESTA,
            'Usuario registrado correctamente.' AS MENSAJE,
            @ID_USUARIO AS ID_USUARIO;

    END TRY

    BEGIN CATCH

        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        SELECT
            500 AS CODIGO_RESPUESTA,
            'Ocurrió un error interno al registrar el usuario.' AS MENSAJE,
            CAST(NULL AS BIGINT) AS ID_USUARIO;

    END CATCH;
END;
GO
