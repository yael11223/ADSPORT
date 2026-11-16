-- ADSPORT: integración del catálogo administrable de deportes.
-- Ejecutar 001, 002, 003 y después este script. Reejecutable, sin eliminar datos.
-- Las imágenes se guardan en SQL Server; no se escriben archivos públicos.
USE [ADSPORT];
GO
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
IF OBJECT_ID('dbo.DEPORTE', 'U') IS NULL
    THROW 51000, N'Primero instala el esquema original de ADSPORT.', 1;
GO
BEGIN TRANSACTION;
IF COL_LENGTH('dbo.DEPORTE', 'ACTIVO') IS NULL
    ALTER TABLE dbo.DEPORTE ADD ACTIVO bit NOT NULL CONSTRAINT DF_DEPORTE_ACTIVO DEFAULT (1) WITH VALUES;
IF COL_LENGTH('dbo.DEPORTE', 'DESCRIPCION') IS NULL
    ALTER TABLE dbo.DEPORTE ADD DESCRIPCION nvarchar(2000) NULL;
-- Solo amplía columnas del esquema original. No reduce versiones ya ampliadas.
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.DEPORTE') AND name = 'DESCRIPCION'
           AND ((system_type_id = 167 AND max_length BETWEEN 1 AND 2000)
             OR (system_type_id = 231 AND max_length BETWEEN 1 AND 3999)))
    ALTER TABLE dbo.DEPORTE ALTER COLUMN DESCRIPCION nvarchar(2000) NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.DEPORTE') AND name = 'NOMBRE_DEPORTE'
           AND system_type_id = 167 AND max_length BETWEEN 1 AND 50)
    ALTER TABLE dbo.DEPORTE ALTER COLUMN NOMBRE_DEPORTE nvarchar(50) NULL;
IF COL_LENGTH('dbo.DEPORTE', 'IMAGEN') IS NULL
    ALTER TABLE dbo.DEPORTE ADD IMAGEN varbinary(max) NULL;
IF COL_LENGTH('dbo.DEPORTE', 'IMAGEN_TIPO') IS NULL
    ALTER TABLE dbo.DEPORTE ADD IMAGEN_TIPO varchar(50) NULL;
COMMIT TRANSACTION;
GO
CREATE OR ALTER PROCEDURE dbo.DEPORTE_LISTA
    @incluir_inactivos bit = 0,
    @numeroError int = 0 OUTPUT,
    @respuesta varchar(1000) = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET @numeroError = 0;
    SET @respuesta = 'Deportes consultados correctamente.';
    BEGIN TRY
        SELECT ID_DEPORTE, NOMBRE_DEPORTE, DESCRIPCION, ACTIVO, FECHA_UTIMA_MODIFICACION,
               CONVERT(bit, CASE WHEN DATALENGTH(IMAGEN) > 0 THEN 1 ELSE 0 END) AS TIENE_IMAGEN
        FROM dbo.DEPORTE WHERE ACTIVO = 1 OR @incluir_inactivos = 1
        ORDER BY NOMBRE_DEPORTE, ID_DEPORTE;
    END TRY
    BEGIN CATCH
        SET @numeroError = ERROR_NUMBER();
        SET @respuesta = ERROR_MESSAGE();
    END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.DEPORTE_OBTENER
    @id_deporte bigint,
    @incluir_inactivos bit = 0,
    @numeroError int = 0 OUTPUT,
    @respuesta varchar(1000) = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET @numeroError = 0;
    SET @respuesta = 'Deporte consultado correctamente.';
    BEGIN TRY
        SELECT ID_DEPORTE, NOMBRE_DEPORTE, DESCRIPCION, ACTIVO, FECHA_UTIMA_MODIFICACION,
               CONVERT(bit, CASE WHEN DATALENGTH(IMAGEN) > 0 THEN 1 ELSE 0 END) AS TIENE_IMAGEN
        FROM dbo.DEPORTE WHERE ID_DEPORTE = @id_deporte AND (ACTIVO = 1 OR @incluir_inactivos = 1);
    END TRY
    BEGIN CATCH
        SET @numeroError = ERROR_NUMBER();
        SET @respuesta = ERROR_MESSAGE();
    END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.DEPORTE_GUARDAR
    @id_deporte bigint = NULL,
    @nombre_deporte nvarchar(max),
    @descripcion nvarchar(max) = NULL,
    @activo bit = 1,
    @numeroError int = 0 OUTPUT,
    @respuesta varchar(1000) = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    SET @numeroError = 0;
    SET @respuesta = 'Deporte guardado correctamente.';
    BEGIN TRY
        -- Recibe el texto completo para rechazar excesos, sin truncar parámetros silenciosamente.
        IF DATALENGTH(@nombre_deporte) > 100 OR DATALENGTH(@descripcion) > 4000
            THROW 51000, N'El nombre admite hasta 50 caracteres y la descripción hasta 2000.', 1;
        SET @nombre_deporte = LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(@nombre_deporte, CHAR(9), ' '), CHAR(10), ' '), CHAR(13), ' ')));
        WHILE CHARINDEX('  ', @nombre_deporte) > 0 SET @nombre_deporte = REPLACE(@nombre_deporte, '  ', ' ');
        IF NULLIF(@nombre_deporte, '') IS NULL OR @activo IS NULL OR (@id_deporte IS NOT NULL AND @id_deporte <= 0)
            THROW 51000, N'Indica un nombre y estado válidos para el deporte.', 1;
        BEGIN TRANSACTION;
        DECLARE @resultado_lock int;
        EXEC @resultado_lock = sys.sp_getapplock @Resource = 'ADSPORT_DEPORTE_CATALOGO', @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 10000;
        IF @resultado_lock < 0 THROW 51009, N'Otra operación está guardando deportes. Inténtalo nuevamente.', 1;
        IF @id_deporte IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.DEPORTE WITH (UPDLOCK, HOLDLOCK) WHERE ID_DEPORTE = @id_deporte)
            THROW 51004, N'El deporte no existe.', 1;
        -- Mismo nombre aunque cambien mayúsculas, acentos o espacios exteriores.
        IF EXISTS (SELECT 1 FROM dbo.DEPORTE WITH (UPDLOCK, HOLDLOCK)
                   WHERE UPPER(LTRIM(RTRIM(NOMBRE_DEPORTE))) COLLATE Latin1_General_100_CI_AI =
                         UPPER(@nombre_deporte) COLLATE Latin1_General_100_CI_AI
                     AND (@id_deporte IS NULL OR ID_DEPORTE <> @id_deporte))
            THROW 51009, N'Ya existe un deporte con ese nombre. Puedes editarlo o reactivarlo.', 1;
        IF @id_deporte IS NULL
        BEGIN
            INSERT dbo.DEPORTE (NOMBRE_DEPORTE, DESCRIPCION, ACTIVO, FECHA_UTIMA_MODIFICACION)
            VALUES (@nombre_deporte, NULLIF(LTRIM(RTRIM(@descripcion)), ''), @activo, GETUTCDATE());
            SET @id_deporte = CONVERT(bigint, SCOPE_IDENTITY());
        END
        ELSE
            UPDATE dbo.DEPORTE SET NOMBRE_DEPORTE = @nombre_deporte, DESCRIPCION = NULLIF(LTRIM(RTRIM(@descripcion)), ''),
                ACTIVO = @activo, FECHA_UTIMA_MODIFICACION = GETUTCDATE() WHERE ID_DEPORTE = @id_deporte;
        COMMIT TRANSACTION;
        SELECT @id_deporte AS ID_DEPORTE;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SET @numeroError = ERROR_NUMBER();
        SET @respuesta = ERROR_MESSAGE();
    END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.DEPORTE_DESACTIVAR
    @id_deporte bigint,
    @numeroError int = 0 OUTPUT,
    @respuesta varchar(1000) = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    SET @numeroError = 0;
    SET @respuesta = 'Deporte desactivado; sus clases y datos se conservan.';
    BEGIN TRY
        UPDATE dbo.DEPORTE SET ACTIVO = 0, FECHA_UTIMA_MODIFICACION = GETUTCDATE() WHERE ID_DEPORTE = @id_deporte;
        IF @@ROWCOUNT = 0 THROW 51004, N'El deporte no existe.', 1;
    END TRY
    BEGIN CATCH
        SET @numeroError = ERROR_NUMBER();
        SET @respuesta = ERROR_MESSAGE();
    END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.DEPORTE_IMAGEN_GUARDAR
    @id_deporte bigint,
    @imagen varbinary(max),
    @imagen_tipo varchar(50),
    @numeroError int = 0 OUTPUT,
    @respuesta varchar(1000) = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    SET @numeroError = 0;
    SET @respuesta = 'Imagen guardada correctamente.';
    BEGIN TRY
        IF @imagen IS NULL OR DATALENGTH(@imagen) NOT BETWEEN 1 AND 5242880
            THROW 51000, N'La imagen debe tener contenido y no superar 5 MB.', 1;
        IF @imagen_tipo IS NULL OR NOT (
            @imagen_tipo = 'image/jpeg' AND SUBSTRING(@imagen, 1, 3) = 0xFFD8FF OR
            @imagen_tipo = 'image/png' AND SUBSTRING(@imagen, 1, 8) = 0x89504E470D0A1A0A OR
            @imagen_tipo = 'image/webp' AND SUBSTRING(@imagen, 1, 4) = 0x52494646 AND SUBSTRING(@imagen, 9, 4) = 0x57454250)
            THROW 51000, N'El contenido debe ser una imagen JPEG, PNG o WebP.', 1;
        UPDATE dbo.DEPORTE SET IMAGEN = @imagen, IMAGEN_TIPO = @imagen_tipo, FECHA_UTIMA_MODIFICACION = GETUTCDATE()
        WHERE ID_DEPORTE = @id_deporte;
        IF @@ROWCOUNT = 0 THROW 51004, N'El deporte no existe.', 1;
    END TRY
    BEGIN CATCH
        SET @numeroError = ERROR_NUMBER();
        SET @respuesta = ERROR_MESSAGE();
    END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.DEPORTE_IMAGEN_OBTENER
    @id_deporte bigint,
    @incluir_inactivos bit = 0,
    @numeroError int = 0 OUTPUT,
    @respuesta varchar(1000) = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET @numeroError = 0;
    SET @respuesta = 'Imagen consultada correctamente.';
    BEGIN TRY
        SELECT IMAGEN, IMAGEN_TIPO FROM dbo.DEPORTE
        WHERE ID_DEPORTE = @id_deporte AND (ACTIVO = 1 OR @incluir_inactivos = 1) AND DATALENGTH(IMAGEN) > 0;
    END TRY
    BEGIN CATCH
        SET @numeroError = ERROR_NUMBER();
        SET @respuesta = ERROR_MESSAGE();
    END CATCH;
END;
GO
