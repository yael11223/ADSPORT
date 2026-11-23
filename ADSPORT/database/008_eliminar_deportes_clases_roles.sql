-- Ejecutar después de 005, 006 y 007. Instala el borrado definitivo de deportes,
-- clases y roles; conservar reservas y pagos exige desvincular sus referencias.
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
ALTER TABLE dbo.CANCHA ALTER COLUMN ID_DEPORTE bigint NULL;
GO
CREATE OR ALTER PROCEDURE dbo.DEPORTE_BORRAR
    @id_deporte bigint,@numeroError int=0 OUTPUT,@respuesta varchar(1000)=NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    SET @numeroError=0; SET @respuesta='Deporte eliminado definitivamente.';
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @Lock int;
        EXEC @Lock=sys.sp_getapplock @Resource=N'ADSPORT_AGENDA',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
        IF @Lock<0 THROW 51009,'La agenda se está actualizando. Intenta nuevamente.',1;
        IF NOT EXISTS(SELECT 1 FROM dbo.DEPORTE WITH(UPDLOCK,HOLDLOCK) WHERE ID_DEPORTE=@id_deporte)
            THROW 51004,'El deporte no existe.',1;
        UPDATE c SET DISPONIBLE=0,
            ID_DEPORTE=CASE WHEN c.ID_DEPORTE=@id_deporte THEN NULL ELSE c.ID_DEPORTE END,
            FECHA_ULTIMA_MODIFICACION=GETUTCDATE()
        FROM dbo.CLASE c
        WHERE c.ID_DEPORTE=@id_deporte OR EXISTS(SELECT 1 FROM dbo.HORARIO h
            JOIN dbo.CANCHA ca ON ca.ID_CANCHA=h.ID_CANCHA
            WHERE h.ID_CLASE=c.ID_CLASE AND h.ACTIVO=1 AND ca.ID_DEPORTE=@id_deporte);
        UPDATE dbo.CANCHA SET ID_DEPORTE=NULL,ACTIVO=0,FECHA_MODIFICACION=SYSUTCDATETIME() WHERE ID_DEPORTE=@id_deporte;
        DELETE dbo.DEPORTE WHERE ID_DEPORTE=@id_deporte;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF XACT_STATE()<>0 ROLLBACK;
        SET @numeroError=ERROR_NUMBER(); SET @respuesta=ERROR_MESSAGE();
    END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.CLASE_BORRAR
    @IdClase bigint,@IdEntrenador bigint=NULL,@Administracion bit=0,
    @numeroError int=0 OUTPUT,@respuesta varchar(1000)=NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    SET @numeroError=0; SET @respuesta='Clase eliminada definitivamente.';
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @Lock int;
        EXEC @Lock=sys.sp_getapplock @Resource=N'ADSPORT_AGENDA',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
        IF @Lock<0 THROW 51009,'La agenda se está actualizando. Intenta nuevamente.',1;
        IF @Administracion=0
        BEGIN
            IF NOT EXISTS(SELECT 1 FROM dbo.USUARIO u JOIN dbo.ROL r ON r.ID_ROL=u.ID_ROL
                WHERE u.ID_USUARIO=@IdEntrenador AND UPPER(LTRIM(RTRIM(r.NOMBRE_ROL)))='ENTRENADOR'
                AND UPPER(LTRIM(RTRIM(u.ESTATUS)))='ACTIVO')
                THROW 51003,'Se requiere un entrenador activo.',1;
            IF NOT EXISTS(SELECT 1 FROM dbo.CLASE WITH(UPDLOCK,HOLDLOCK)
                WHERE ID_CLASE=@IdClase AND ID_ENTRENADOR=@IdEntrenador)
                THROW 51004,'La clase no pertenece a tu cuenta.',1;
        END;
        IF NOT EXISTS(SELECT 1 FROM dbo.CLASE WITH(UPDLOCK,HOLDLOCK) WHERE ID_CLASE=@IdClase)
            THROW 51004,'La clase no existe.',1;
        UPDATE dbo.RESERVA SET ID_CLASE=NULL,FECHA_UTIMA_MODIFICACION=GETUTCDATE() WHERE ID_CLASE=@IdClase;
        UPDATE dbo.REGISTRO_ACCESO SET ID_PASE=NULL,FECHA_ULTIMA_MODIFICACION=GETUTCDATE() WHERE ID_PASE=@IdClase;
        DELETE dbo.HORARIO WHERE ID_CLASE=@IdClase;
        DELETE dbo.CLASE WHERE ID_CLASE=@IdClase;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF XACT_STATE()<>0 ROLLBACK;
        SET @numeroError=ERROR_NUMBER(); SET @respuesta=ERROR_MESSAGE();
    END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.ROL_BORRAR
    @IdRol bigint,@numeroError int=0 OUTPUT,@respuesta varchar(1000)=NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    SET @numeroError=0; SET @respuesta='Rol eliminado definitivamente.';
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @Lock int,@Nombre varchar(100),@Reemplazo bigint,@NombreReemplazo varchar(100);
        EXEC @Lock=sys.sp_getapplock @Resource=N'ADSPORT_AGENDA',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
        IF @Lock<0 THROW 51009,'La agenda se está actualizando. Intenta nuevamente.',1;
        IF NOT EXISTS(SELECT 1 FROM dbo.ROL WITH(UPDLOCK,HOLDLOCK) WHERE ID_ROL=@IdRol)
            THROW 51004,'El rol no existe.',1;
        SELECT @Nombre=UPPER(LTRIM(RTRIM(NOMBRE_ROL))) FROM dbo.ROL WHERE ID_ROL=@IdRol;
        IF EXISTS(SELECT 1 FROM dbo.USUARIO WHERE ID_ROL=@IdRol) OR @Nombre='USUARIO'
        BEGIN
            SET @NombreReemplazo=CASE WHEN @Nombre='USUARIO' THEN 'SIN ASIGNAR' ELSE 'USUARIO' END;
            SELECT TOP(1) @Reemplazo=ID_ROL FROM dbo.ROL WITH(UPDLOCK,HOLDLOCK)
                WHERE UPPER(LTRIM(RTRIM(NOMBRE_ROL)))=@NombreReemplazo AND ID_ROL<>@IdRol ORDER BY ID_ROL;
            IF @Reemplazo IS NULL
            BEGIN
                INSERT dbo.ROL(NOMBRE_ROL,FECHA_UTIMA_MODIFICACION) VALUES(@NombreReemplazo,GETUTCDATE());
                SET @Reemplazo=CONVERT(bigint,SCOPE_IDENTITY());
            END;
            UPDATE c SET DISPONIBLE=0,FECHA_ULTIMA_MODIFICACION=GETUTCDATE()
            FROM dbo.CLASE c JOIN dbo.USUARIO u ON u.ID_USUARIO=c.ID_ENTRENADOR WHERE u.ID_ROL=@IdRol;
            UPDATE dbo.USUARIO SET ID_ROL=@Reemplazo,FECHA__ULTIMA_MODIFICACION=GETUTCDATE() WHERE ID_ROL=@IdRol;
        END;
        DELETE dbo.ROL WHERE ID_ROL=@IdRol;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF XACT_STATE()<>0 ROLLBACK;
        SET @numeroError=ERROR_NUMBER(); SET @respuesta=ERROR_MESSAGE();
    END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.CANCHA_LISTAR @IncluirInactivas bit=0
AS
BEGIN
    SET NOCOUNT ON;
    SELECT ca.ID_CANCHA,ca.ID_DEPORTE,ca.NOMBRE,ca.UBICACION,ca.ACTIVO,COALESCE(d.NOMBRE_DEPORTE,'Sin deporte asignado') AS NOMBRE_DEPORTE,CONVERT(bit,ISNULL(d.ACTIVO,0)) AS DEPORTE_ACTIVO,
        CONVERT(bit,CASE WHEN DATALENGTH(ca.IMAGEN)>0 THEN 1 ELSE 0 END) AS TIENE_IMAGEN,ca.FECHA_MODIFICACION
    FROM dbo.CANCHA ca LEFT JOIN dbo.DEPORTE d ON d.ID_DEPORTE=ca.ID_DEPORTE
    WHERE @IncluirInactivas=1 OR ca.ACTIVO=1 AND d.ACTIVO=1 ORDER BY ca.NOMBRE;
    SELECT a.ID_CANCHA,a.DIA_ISO,a.HORA_INICIO,a.HORA_FIN FROM dbo.CANCHA_APERTURA a
    JOIN dbo.CANCHA ca ON ca.ID_CANCHA=a.ID_CANCHA LEFT JOIN dbo.DEPORTE d ON d.ID_DEPORTE=ca.ID_DEPORTE
    WHERE @IncluirInactivas=1 OR ca.ACTIVO=1 AND d.ACTIVO=1 ORDER BY a.ID_CANCHA,a.DIA_ISO,a.HORA_INICIO;
END;
GO
CREATE OR ALTER PROCEDURE dbo.CANCHA_IMAGEN_OBTENER
    @IdCancha bigint,@IncluirInactivas bit=0,@numeroError int=0 OUTPUT,@respuesta varchar(1000)=NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET @numeroError=0; SET @respuesta='Imagen consultada.';
    BEGIN TRY
        SELECT ca.IMAGEN,ca.IMAGEN_TIPO FROM dbo.CANCHA ca LEFT JOIN dbo.DEPORTE d ON d.ID_DEPORTE=ca.ID_DEPORTE
        WHERE ca.ID_CANCHA=@IdCancha AND DATALENGTH(ca.IMAGEN)>0 AND (@IncluirInactivas=1 OR ca.ACTIVO=1 AND d.ACTIVO=1);
        IF @@ROWCOUNT=0 THROW 51004,'La instalación o su fotografía no están disponibles.',1;
    END TRY
    BEGIN CATCH
        SET @numeroError=ERROR_NUMBER(); SET @respuesta=ERROR_MESSAGE();
    END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.ENTRENADOR_CLASES_CONSULTAR
    @IdEntrenador bigint=NULL,@Deporte nvarchar(50)=NULL,@numeroError int=0 OUTPUT,
    @respuesta varchar(1000)=NULL OUTPUT,@IdDeporte bigint=NULL,@Administracion bit=0
AS
BEGIN
    SET NOCOUNT ON;
    SET @numeroError=0; SET @respuesta='Clases consultadas.';
    BEGIN TRY
        IF @IdEntrenador IS NOT NULL AND @Administracion=0 AND NOT EXISTS(SELECT 1 FROM dbo.USUARIO u JOIN dbo.ROL r ON r.ID_ROL=u.ID_ROL
            WHERE u.ID_USUARIO=@IdEntrenador AND UPPER(LTRIM(RTRIM(r.NOMBRE_ROL)))='ENTRENADOR' AND UPPER(LTRIM(RTRIM(u.ESTATUS)))='ACTIVO')
            THROW 51003,'Se requiere un entrenador activo.',1;
        SELECT c.ID_CLASE,c.ID_DEPORTE,COALESCE(d.NOMBRE_DEPORTE,'Sin deporte asignado') AS NOMBRE_DEPORTE,CONVERT(bit,ISNULL(d.ACTIVO,0)) AS DEPORTE_ACTIVO,
            c.NOMBRE_CLASE,c.DESCRIPCION,c.PRECIO,c.CUPO_MAXIMO,c.DISPONIBLE,c.UBICACION,
            COALESCE(NULLIF(LTRIM(RTRIM(CONCAT(u.NOMBRE,' ',u.APELLIDO_PATERNO,' ',u.APELLIDO_MATERNO))),''),'Profesor eliminado') AS ENTRENADOR_NOMBRE,
            CONVERT(bit,CASE WHEN DATALENGTH(u.FOTO)>0 THEN 1 ELSE 0 END) AS TIENE_FOTO,
            (SELECT COUNT(DISTINCT rv.ID_USUARIO) FROM dbo.RESERVA rv WHERE rv.ID_CLASE=c.ID_CLASE
             AND UPPER(LTRIM(RTRIM(rv.ESTATUS_RESERVA))) IN ('ACTIVA','ACTIVO','CONFIRMADA','CONFIRMADO','PAGADA','PAGADO','PENDIENTE')) AS ALUMNOS_INSCRITOS,
            cancha.ID_CANCHA,cancha.NOMBRE_CANCHA
        INTO #Clases
        FROM dbo.CLASE c LEFT JOIN dbo.USUARIO u ON u.ID_USUARIO=c.ID_ENTRENADOR LEFT JOIN dbo.ROL r ON r.ID_ROL=u.ID_ROL
        LEFT JOIN dbo.DEPORTE d ON d.ID_DEPORTE=c.ID_DEPORTE
        OUTER APPLY(SELECT TOP(1) h.ID_CANCHA,ca.NOMBRE AS NOMBRE_CANCHA FROM dbo.HORARIO h LEFT JOIN dbo.CANCHA ca ON ca.ID_CANCHA=h.ID_CANCHA
                    WHERE h.ID_CLASE=c.ID_CLASE AND h.ACTIVO=1 ORDER BY h.ID_HORARIO) cancha
        WHERE (@IdEntrenador IS NULL OR c.ID_ENTRENADOR=@IdEntrenador)
          AND (@Administracion=1 OR @IdEntrenador IS NOT NULL OR c.DISPONIBLE=1 AND d.ACTIVO=1
               AND UPPER(LTRIM(RTRIM(r.NOMBRE_ROL)))='ENTRENADOR' AND UPPER(LTRIM(RTRIM(u.ESTATUS)))='ACTIVO'
               AND c.PRECIO>=0 AND c.CUPO_MAXIMO>0 AND EXISTS(SELECT 1 FROM dbo.HORARIO h WHERE h.ID_CLASE=c.ID_CLASE
                   AND h.ACTIVO=1 AND h.DIA_ISO BETWEEN 1 AND 7 AND h.HORA_INICIO<h.HORA_FIN))
          AND (@IdDeporte IS NULL OR c.ID_DEPORTE=@IdDeporte) AND (@IdDeporte IS NOT NULL OR @Deporte IS NULL OR d.NOMBRE_DEPORTE=@Deporte);
        SELECT * FROM #Clases ORDER BY NOMBRE_DEPORTE,NOMBRE_CLASE,ID_CLASE;
        SELECT h.ID_CLASE,h.DIA_ISO,h.HORA_INICIO,h.HORA_FIN,h.ID_CANCHA,ca.NOMBRE AS NOMBRE_CANCHA
        FROM dbo.HORARIO h JOIN #Clases c ON c.ID_CLASE=h.ID_CLASE LEFT JOIN dbo.CANCHA ca ON ca.ID_CANCHA=h.ID_CANCHA
        WHERE h.ACTIVO=1 AND h.DIA_ISO BETWEEN 1 AND 7 AND h.HORA_INICIO<h.HORA_FIN ORDER BY h.ID_CLASE,h.DIA_ISO,h.HORA_INICIO;
    END TRY
    BEGIN CATCH
        SET @numeroError=ERROR_NUMBER(); SET @respuesta=ERROR_MESSAGE();
    END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.ADMIN_CRONOGRAMA
    @IdEntrenador bigint=NULL,@IdCancha bigint=NULL,@IdDeporte bigint=NULL,@IncluirNoDisponibles bit=0
AS
BEGIN
    SET NOCOUNT ON;
    SELECT c.ID_CLASE,c.NOMBRE_CLASE,c.ID_ENTRENADOR,
        COALESCE(NULLIF(LTRIM(RTRIM(CONCAT(u.NOMBRE,' ',u.APELLIDO_PATERNO,' ',u.APELLIDO_MATERNO))),''),'Profesor eliminado') AS ENTRENADOR_NOMBRE,
        c.ID_DEPORTE,COALESCE(d.NOMBRE_DEPORTE,'Sin deporte asignado') AS NOMBRE_DEPORTE,h.ID_CANCHA,ca.NOMBRE AS NOMBRE_CANCHA,COALESCE(ca.UBICACION,c.UBICACION) AS UBICACION,
        h.DIA_ISO,h.HORA_INICIO,h.HORA_FIN,c.DISPONIBLE,
        CONVERT(bit,CASE WHEN c.DISPONIBLE=1 AND ca.ACTIVO=1 THEN 1 ELSE 0 END) AS OCUPA_CANCHA
    FROM dbo.HORARIO h JOIN dbo.CLASE c ON c.ID_CLASE=h.ID_CLASE LEFT JOIN dbo.USUARIO u ON u.ID_USUARIO=c.ID_ENTRENADOR
    LEFT JOIN dbo.DEPORTE d ON d.ID_DEPORTE=c.ID_DEPORTE LEFT JOIN dbo.CANCHA ca ON ca.ID_CANCHA=h.ID_CANCHA
    WHERE h.ACTIVO=1 AND h.DIA_ISO BETWEEN 1 AND 7 AND h.HORA_INICIO<h.HORA_FIN
      AND (@IdEntrenador IS NULL OR c.ID_ENTRENADOR=@IdEntrenador) AND (@IdCancha IS NULL OR h.ID_CANCHA=@IdCancha)
      AND (@IdDeporte IS NULL OR c.ID_DEPORTE=@IdDeporte) AND (@IncluirNoDisponibles=1 OR c.DISPONIBLE=1)
    ORDER BY h.DIA_ISO,h.HORA_INICIO,ca.NOMBRE,c.NOMBRE_CLASE;
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
                WHERE CORREO = @CORREO
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

