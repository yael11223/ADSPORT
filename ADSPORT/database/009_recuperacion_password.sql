-- Ejecutar después de 005, 006, 007 y 008.
-- Reutiliza CODIGO_VERIFICACION; no borra cuentas ni cambia contraseñas al instalar.
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
IF COL_LENGTH('dbo.CODIGO_VERIFICACION','PROPOSITO') IS NULL
    ALTER TABLE dbo.CODIGO_VERIFICACION ADD PROPOSITO varchar(20) NOT NULL
        CONSTRAINT DF_CODIGO_VERIFICACION_PROPOSITO DEFAULT('REGISTRO') WITH VALUES;
GO
IF NOT EXISTS(SELECT 1 FROM sys.check_constraints WHERE name='CK_CODIGO_VERIFICACION_PROPOSITO' AND parent_object_id=OBJECT_ID('dbo.CODIGO_VERIFICACION'))
    ALTER TABLE dbo.CODIGO_VERIFICACION ADD CONSTRAINT CK_CODIGO_VERIFICACION_PROPOSITO
        CHECK(PROPOSITO IN ('REGISTRO','RECUPERACION'));
GO
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_CODIGO_VERIFICACION_CORREO_PROPOSITO' AND object_id=OBJECT_ID('dbo.CODIGO_VERIFICACION'))
    CREATE INDEX IX_CODIGO_VERIFICACION_CORREO_PROPOSITO ON dbo.CODIGO_VERIFICACION(CORREO,PROPOSITO,FECHA_CREACION DESC,ID_CODIGO DESC);
IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE name='IX_CODIGO_VERIFICACION_SESIONES' AND object_id=OBJECT_ID('dbo.CODIGO_VERIFICACION'))
    CREATE INDEX IX_CODIGO_VERIFICACION_SESIONES ON dbo.CODIGO_VERIFICACION(ID_USUARIO,PROPOSITO,VERIFICADO,FECHA_UTIMA_MODIFICACION);
GO
CREATE OR ALTER PROCEDURE dbo.RECUPERACION_PASSWORD_SOLICITAR
    @Correo varchar(100),@CodigoHash varchar(64),@IdCodigo bigint=NULL OUTPUT,
    @numeroError int=0 OUTPUT,@respuesta varchar(1000)=NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    SET @IdCodigo=NULL; SET @numeroError=0; SET @respuesta='Solicitud recibida.';
    SET @Correo=LOWER(LTRIM(RTRIM(@Correo)));
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @Lock int,@Recurso nvarchar(255)=N'ADSPORT_RECUPERACION:'+@Correo,@IdUsuario bigint,@Ahora datetime=GETUTCDATE();
        EXEC @Lock=sys.sp_getapplock @Resource=@Recurso,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
        IF @Lock<0 THROW 51009,'Intenta nuevamente más tarde.',1;
        SET @Ahora=GETUTCDATE();
        SELECT @IdUsuario=u.ID_USUARIO FROM dbo.USUARIO u WITH(UPDLOCK,HOLDLOCK)
        JOIN dbo.[PASSWORD] p ON p.ID_PASSWORD=u.ID_PASSWORD AND p.ID_USUARIO=u.ID_USUARIO
        WHERE u.CORREO=@Correo AND UPPER(LTRIM(RTRIM(u.ESTATUS)))='ACTIVO';
        -- Misma respuesta para correos inexistentes, inactivos y solicitudes repetidas.
        IF @IdUsuario IS NULL OR EXISTS(SELECT 1 FROM dbo.CODIGO_VERIFICACION
            WHERE CORREO=@Correo AND PROPOSITO='RECUPERACION' AND FECHA_CREACION>DATEADD(second,-60,@Ahora))
        BEGIN
            COMMIT; RETURN;
        END;
        UPDATE dbo.CODIGO_VERIFICACION SET UTILIZADO=1,FECHA_UTIMA_MODIFICACION=@Ahora
            WHERE CORREO=@Correo AND PROPOSITO='RECUPERACION' AND UTILIZADO=0;
        INSERT dbo.CODIGO_VERIFICACION(ID_USUARIO,CORREO,CODIGO_HASH,FECHA_CREACION,FECHA_EXPIRACION,
            UTILIZADO,INTENTOS,FECHA_UTIMA_MODIFICACION,VERIFICADO,PROPOSITO)
        VALUES(@IdUsuario,@Correo,@CodigoHash,@Ahora,DATEADD(minute,10,@Ahora),0,0,@Ahora,0,'RECUPERACION');
        SET @IdCodigo=CONVERT(bigint,SCOPE_IDENTITY());
        COMMIT;
    END TRY
    BEGIN CATCH
        IF XACT_STATE()<>0 ROLLBACK;
        SET @numeroError=ERROR_NUMBER(); SET @respuesta=ERROR_MESSAGE(); SET @IdCodigo=NULL;
    END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.RECUPERACION_PASSWORD_RESTABLECER
    @Correo varchar(100),@CodigoHash varchar(64),@PasswordHash varchar(60),
    @numeroError int=0 OUTPUT,@respuesta varchar(1000)=NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    SET @numeroError=0; SET @respuesta='Contraseña actualizada.';
    SET @Correo=LOWER(LTRIM(RTRIM(@Correo)));
    BEGIN TRY
        IF LEN(ISNULL(@CodigoHash,''))<>64
            THROW 51000,'El código no es válido o ya venció. Solicita uno nuevo.',1;
        IF LEN(ISNULL(@PasswordHash,''))<>60 OR LEFT(@PasswordHash,4) NOT IN ('$2a$','$2b$','$2y$')
            THROW 51000,'La contraseña no es válida.',1;
        BEGIN TRANSACTION;
        DECLARE @Lock int,@Recurso nvarchar(255)=N'ADSPORT_RECUPERACION:'+@Correo,@IdUsuario bigint,@IdPassword bigint,
            @IdCodigo bigint,@HashGuardado varchar(255),@Expiracion datetime,@Utilizado bit,@Intentos int,@Ahora datetime=GETUTCDATE();
        EXEC @Lock=sys.sp_getapplock @Resource=@Recurso,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
        IF @Lock<0 THROW 51009,'Intenta nuevamente más tarde.',1;
        SET @Ahora=GETUTCDATE();
        SELECT @IdUsuario=u.ID_USUARIO,@IdPassword=u.ID_PASSWORD FROM dbo.USUARIO u WITH(UPDLOCK,HOLDLOCK)
            WHERE u.CORREO=@Correo AND UPPER(LTRIM(RTRIM(u.ESTATUS)))='ACTIVO';
        SELECT TOP(1) @IdCodigo=ID_CODIGO,@HashGuardado=CODIGO_HASH,@Expiracion=FECHA_EXPIRACION,
            @Utilizado=UTILIZADO,@Intentos=INTENTOS
        FROM dbo.CODIGO_VERIFICACION WITH(UPDLOCK,HOLDLOCK)
        WHERE CORREO=@Correo AND ID_USUARIO=@IdUsuario AND PROPOSITO='RECUPERACION'
        ORDER BY FECHA_CREACION DESC,ID_CODIGO DESC;
        IF @IdCodigo IS NULL OR @Utilizado=1 OR @Expiracion<=@Ahora OR @Intentos>=5
        BEGIN
            IF @IdCodigo IS NOT NULL AND (@Expiracion<=@Ahora OR @Intentos>=5) AND @Utilizado=0
                UPDATE dbo.CODIGO_VERIFICACION SET UTILIZADO=1,FECHA_UTIMA_MODIFICACION=@Ahora WHERE ID_CODIGO=@IdCodigo;
            COMMIT;
            SET @numeroError=51000; SET @respuesta='El código no es válido o ya venció. Solicita uno nuevo.'; RETURN;
        END;
        IF @HashGuardado COLLATE Latin1_General_100_BIN2<>@CodigoHash COLLATE Latin1_General_100_BIN2
        BEGIN
            UPDATE dbo.CODIGO_VERIFICACION SET INTENTOS=INTENTOS+1,
                UTILIZADO=CASE WHEN INTENTOS+1>=5 THEN 1 ELSE 0 END,FECHA_UTIMA_MODIFICACION=@Ahora WHERE ID_CODIGO=@IdCodigo;
            COMMIT;
            SET @numeroError=51000; SET @respuesta='El código no es válido o ya venció. Solicita uno nuevo.'; RETURN;
        END;
        SET @Ahora=GETUTCDATE();
        UPDATE dbo.[PASSWORD] SET [PASSWORD]=@PasswordHash WHERE ID_PASSWORD=@IdPassword AND ID_USUARIO=@IdUsuario;
        IF @@ROWCOUNT<>1 THROW 51009,'No fue posible actualizar la cuenta. Solicita un nuevo código.',1;
        UPDATE dbo.USUARIO SET FECHA__ULTIMA_MODIFICACION=@Ahora WHERE ID_USUARIO=@IdUsuario;
        UPDATE dbo.CODIGO_VERIFICACION SET UTILIZADO=1,VERIFICADO=1,FECHA_UTIMA_MODIFICACION=@Ahora WHERE ID_CODIGO=@IdCodigo;
        UPDATE dbo.CODIGO_VERIFICACION SET UTILIZADO=1,FECHA_UTIMA_MODIFICACION=@Ahora
            WHERE ID_USUARIO=@IdUsuario AND PROPOSITO='RECUPERACION' AND UTILIZADO=0;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF XACT_STATE()<>0 ROLLBACK;
        SET @numeroError=ERROR_NUMBER(); SET @respuesta=ERROR_MESSAGE();
    END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.RECUPERACION_PASSWORD_INVALIDAR_ENVIO @IdCodigo bigint
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.CODIGO_VERIFICACION SET UTILIZADO=1,FECHA_UTIMA_MODIFICACION=GETUTCDATE()
        WHERE ID_CODIGO=@IdCodigo AND PROPOSITO='RECUPERACION' AND VERIFICADO=0 AND UTILIZADO=0;
END;
GO
CREATE OR ALTER PROCEDURE dbo.RECUPERACION_PASSWORD_SESION_REVOCADA @IdUsuario bigint,@InicioSesion datetime2(7)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT CONVERT(bit,CASE WHEN EXISTS(SELECT 1 FROM dbo.CODIGO_VERIFICACION
        WHERE ID_USUARIO=@IdUsuario AND PROPOSITO='RECUPERACION' AND VERIFICADO=1 AND UTILIZADO=1
            AND FECHA_UTIMA_MODIFICACION>@InicioSesion) THEN 1 ELSE 0 END);
END;
GO
-- Mantener la verificación del registro separada de los códigos de recuperación.
CREATE OR ALTER PROCEDURE [dbo].[CODIGO_VERIFICACION_AGREGAR]
    @CORREO VARCHAR(150),
    @CODIGO_HASH VARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @ID_CODIGO BIGINT;
    DECLARE @FECHA_ACTUAL DATETIME = GETUTCDATE();

    -- Validar correo electrónico
    IF @CORREO IS NULL
       OR LTRIM(RTRIM(@CORREO)) = ''
       OR @CORREO NOT LIKE '%_@_%._%'
    BEGIN
        SELECT
            400 AS CODIGO_RESPUESTA,
            'El correo electrónico no es válido.' AS MENSAJE,
            CAST(NULL AS BIGINT) AS ID_CODIGO;
        RETURN;
    END;

    -- Validar hash del código
    IF @CODIGO_HASH IS NULL
       OR LTRIM(RTRIM(@CODIGO_HASH)) = ''
    BEGIN
        SELECT
            401 AS CODIGO_RESPUESTA,
            'El hash del código de verificación es obligatorio.' AS MENSAJE,
            CAST(NULL AS BIGINT) AS ID_CODIGO;
        RETURN;
    END;

    BEGIN TRY

        BEGIN TRANSACTION;

        /*
        NOTA:
        Ajustar el nombre de la tabla y del campo CORREO
        si en tu base de datos tienen otro nombre.
        */

        -- Verificar si el correo ya está registrado
        IF EXISTS (
            SELECT 1
            FROM USUARIO
            WHERE CORREO = @CORREO
        )
        BEGIN
            ROLLBACK TRANSACTION;

            SELECT
                409 AS CODIGO_RESPUESTA,
                'El correo electrónico ya se encuentra registrado.' AS MENSAJE,
                CAST(NULL AS BIGINT) AS ID_CODIGO;
            RETURN;
        END;

        -- Invalidar códigos anteriores del mismo correo
        UPDATE CODIGO_VERIFICACION
        SET
            UTILIZADO = 1,
            FECHA_UTIMA_MODIFICACION = @FECHA_ACTUAL
        WHERE CORREO = @CORREO
          AND PROPOSITO = 'REGISTRO'
          AND UTILIZADO = 0;

        -- Registrar nuevo código de verificación
        INSERT INTO CODIGO_VERIFICACION
        (
            CORREO,
            CODIGO_HASH,
            FECHA_CREACION,
            FECHA_EXPIRACION,
            UTILIZADO,
            INTENTOS,
            FECHA_UTIMA_MODIFICACION
        )
        VALUES
        (
            @CORREO,
            @CODIGO_HASH,
            @FECHA_ACTUAL,
            DATEADD(MINUTE, 10, @FECHA_ACTUAL),
            0,
            0,
            @FECHA_ACTUAL
        );

        -- Obtener el identificador generado
        SET @ID_CODIGO = CAST(SCOPE_IDENTITY() AS BIGINT);

        COMMIT TRANSACTION;

        -- Respuesta exitosa
        SELECT
            200 AS CODIGO_RESPUESTA,
            'Código de verificación registrado correctamente.' AS MENSAJE,
            @ID_CODIGO AS ID_CODIGO;

    END TRY

    BEGIN CATCH

        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;

        SELECT
            500 AS CODIGO_RESPUESTA,
            'Ocurrió un error interno al registrar el código de verificación.' AS MENSAJE,
            CAST(NULL AS BIGINT) AS ID_CODIGO;

    END CATCH;
END;

GO
CREATE OR ALTER PROCEDURE [dbo].[CODIGO_VERIFICACION_REENVIAR]
    @CORREO VARCHAR(150)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @FECHA_ULTIMA_SOLICITUD DATETIME;
    DECLARE @FECHA_ACTUAL DATETIME = GETUTCDATE();
    DECLARE @SEGUNDOS_RESTANTES INT;

    -- Validar correo electrónico
    IF @CORREO IS NULL
       OR LTRIM(RTRIM(@CORREO)) = ''
       OR @CORREO NOT LIKE '%_@_%._%'
    BEGIN
        SELECT
            400 AS CODIGO_RESPUESTA,
            'El correo electrónico no es válido.' AS MENSAJE,
            0 AS SEGUNDOS_RESTANTES;
        RETURN;
    END;

    BEGIN TRY

        -- Comprobar si el correo ya está registrado
        IF EXISTS (
            SELECT 1
            FROM dbo.USUARIO
            WHERE CORREO = @CORREO
        )
        BEGIN
            SELECT
                409 AS CODIGO_RESPUESTA,
                'El correo electrónico ya está registrado.' AS MENSAJE,
                0 AS SEGUNDOS_RESTANTES;
            RETURN;
        END;

        -- Obtener la fecha de la última solicitud
        SELECT
            @FECHA_ULTIMA_SOLICITUD = MAX(FECHA_CREACION)
        FROM dbo.CODIGO_VERIFICACION
        WHERE CORREO = @CORREO AND PROPOSITO = 'REGISTRO';

        -- Si nunca ha solicitado un código
        IF @FECHA_ULTIMA_SOLICITUD IS NULL
        BEGIN
            SELECT
                200 AS CODIGO_RESPUESTA,
                'Puedes solicitar un código de verificación.' AS MENSAJE,
                0 AS SEGUNDOS_RESTANTES;
            RETURN;
        END;

        -- Calcular el tiempo restante
        SET @SEGUNDOS_RESTANTES =
            60 - DATEDIFF(
                SECOND,
                @FECHA_ULTIMA_SOLICITUD,
                @FECHA_ACTUAL
            );

        -- Comprobar si debe esperar
        IF @SEGUNDOS_RESTANTES > 0
        BEGIN
            SELECT
                429 AS CODIGO_RESPUESTA,
                'Debes esperar antes de solicitar otro código.' AS MENSAJE,
                @SEGUNDOS_RESTANTES AS SEGUNDOS_RESTANTES;
            RETURN;
        END;

        -- Permitir solicitar un nuevo código
        SELECT
            200 AS CODIGO_RESPUESTA,
            'Puedes solicitar un nuevo código de verificación.' AS MENSAJE,
            0 AS SEGUNDOS_RESTANTES;

    END TRY

    BEGIN CATCH

        SELECT
            500 AS CODIGO_RESPUESTA,
            'Ocurrió un error interno al comprobar el reenvío.' AS MENSAJE,
            0 AS SEGUNDOS_RESTANTES;

    END CATCH;
END;

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
            'Correo electrónico verificado correctamente.' AS MENSAJE;

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
CREATE OR ALTER PROCEDURE [dbo].[USUARIO_CORREO_VERIFICADO]
    @CORREO VARCHAR(150)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @ID_CODIGO BIGINT;
    DECLARE @VERIFICADO BIT;

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

    BEGIN TRY

        -- Obtener la última solicitud de verificación
        SELECT TOP 1
            @ID_CODIGO = ID_CODIGO,
            @VERIFICADO = VERIFICADO
        FROM dbo.CODIGO_VERIFICACION
        WHERE CORREO = @CORREO AND PROPOSITO = 'REGISTRO'
        ORDER BY FECHA_CREACION DESC, ID_CODIGO DESC;

        -- Comprobar si existe una solicitud
        IF @ID_CODIGO IS NULL
        BEGIN
            SELECT
                404 AS CODIGO_RESPUESTA,
                'No existe una solicitud de verificación para este correo.' AS MENSAJE;
            RETURN;
        END;

        -- Comprobar si el correo fue verificado
        IF @VERIFICADO = 0
        BEGIN
            SELECT
                403 AS CODIGO_RESPUESTA,
                'El correo electrónico todavía no ha sido verificado.' AS MENSAJE;
            RETURN;
        END;

        -- Correo verificado correctamente
        SELECT
            200 AS CODIGO_RESPUESTA,
            'El correo electrónico está verificado.' AS MENSAJE;

    END TRY

    BEGIN CATCH

        SELECT
            500 AS CODIGO_RESPUESTA,
            'Ocurrió un error interno al consultar la verificación.' AS MENSAJE;

    END CATCH;
END;

GO
CREATE OR ALTER PROCEDURE [dbo].[NUEVO_USUARIO_AGREGA]
    @NOMBRE VARCHAR(100),
    @APELLIDO_PATERNO VARCHAR(100),
    @CORREO VARCHAR(100),
    @PASSWORD_HASH VARCHAR(60),
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

        /*
          Comprobar la última verificación del correo.

          PENDIENTE DE SEGURIDAD:
          Antes de utilizar este procedimiento en producción,
          se debe exigir una autorización temporal vinculada
          a quien verificó el correo.
        */

        IF NOT EXISTS (
            SELECT 1
            FROM dbo.CODIGO_VERIFICACION
            WHERE ID_CODIGO = (
                SELECT MAX(ID_CODIGO)
                FROM dbo.CODIGO_VERIFICACION
                WHERE CORREO = @CORREO AND PROPOSITO = 'REGISTRO'
            )
            AND VERIFICADO = 1
            AND UTILIZADO = 1
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
