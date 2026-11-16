-- Ejecutar después de 001 y 002 sobre la base existente ADSPORT.
-- Conserva usuarios y contraseñas actuales. No crea credenciales de demostración.
USE [ADSPORT];
GO
IF NOT EXISTS (SELECT 1 FROM dbo.ROL WHERE UPPER(LTRIM(RTRIM(NOMBRE_ROL))) = 'ENTRENADOR')
    INSERT dbo.ROL (NOMBRE_ROL, FECHA_UTIMA_MODIFICACION) VALUES ('ENTRENADOR', GETUTCDATE());
GO
CREATE OR ALTER PROCEDURE dbo.USUARIO_AGREGA
    @id_rol BIGINT,
    @nombre VARCHAR(100),
    @apellido_paterno VARCHAR(100),
    @apellido_materno VARCHAR(100),
    @correo VARCHAR(100),
    @telefono VARCHAR(100),
    @estatus VARCHAR(50),
    @codigo_qr VARCHAR(10),
    @foto VARBINARY(MAX) = NULL,
    @password_hash VARCHAR(60) = NULL,
    @numeroError INT OUTPUT,
    @respuesta VARCHAR(1000) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    SET @numeroError = 0;
    SET @respuesta = '';
    BEGIN TRY
        IF @password_hash IS NULL OR LEN(@password_hash) <> 60
           OR LEFT(@password_hash, 4) NOT IN ('$2a$', '$2b$', '$2y$')
        BEGIN
            SET @numeroError = 400;
            SET @respuesta = 'Debes proporcionar una contraseña inicial válida desde el alta administrativa.';
            RETURN;
        END;
        IF NULLIF(LTRIM(RTRIM(@nombre)), '') IS NULL OR NULLIF(LTRIM(RTRIM(@correo)), '') IS NULL
           OR @correo NOT LIKE '%_@_%._%'
        BEGIN
            SET @numeroError = 400;
            SET @respuesta = 'Nombre y correo válidos son obligatorios.';
            RETURN;
        END;
        BEGIN TRANSACTION;
        IF NOT EXISTS (SELECT 1 FROM dbo.ROL WHERE ID_ROL = @id_rol)
            THROW 51001, 'El rol seleccionado no existe.', 1;
        IF EXISTS (SELECT 1 FROM dbo.USUARIO WITH (UPDLOCK, HOLDLOCK)
                   WHERE LOWER(LTRIM(RTRIM(CORREO))) = LOWER(LTRIM(RTRIM(@correo))))
            THROW 51002, 'El correo ya está registrado.', 1;

        -- ID_PASSWORD es NOT NULL en el esquema original y aún no existe el ID del usuario.
        -- El valor provisional solo existe dentro de esta transacción y se reemplaza antes del COMMIT.
        INSERT dbo.USUARIO (ID_ROL, NOMBRE, APELLIDO_PATERNO, APELLIDO_MATERNO, CORREO,
            TELEFONO, ESTATUS, CODIGO_QR, FOTO, FECHA__ULTIMA_MODIFICACION, ID_PASSWORD)
        VALUES (@id_rol, @nombre, @apellido_paterno, @apellido_materno, LOWER(LTRIM(RTRIM(@correo))),
            @telefono, @estatus, @codigo_qr, @foto, GETUTCDATE(), 0);
        DECLARE @id_usuario BIGINT = CONVERT(BIGINT, SCOPE_IDENTITY());
        INSERT dbo.[PASSWORD] (ID_USUARIO, [PASSWORD]) VALUES (@id_usuario, @password_hash);
        DECLARE @id_password BIGINT = CONVERT(BIGINT, SCOPE_IDENTITY());
        UPDATE dbo.USUARIO SET ID_PASSWORD = @id_password WHERE ID_USUARIO = @id_usuario;
        COMMIT;
        SET @respuesta = 'Empleado registrado con sus credenciales iniciales.';
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK;
        SET @numeroError = ERROR_NUMBER();
        SET @respuesta = ERROR_MESSAGE();
    END CATCH;
END;
GO
