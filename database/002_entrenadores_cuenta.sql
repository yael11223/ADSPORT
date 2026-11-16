/* ADSPORT - cuentas de entrenadores. Ejecutar después de 001_entrenadores_clases.sql.
   No crea cuentas, no cambia roles ni credenciales existentes y no elimina datos.
   Parámetros OUTPUT opcionales: compatibles con las llamadas anteriores.
   CREATE OR ALTER permite volver a ejecutar este script. Requiere SQL Server 2016 SP1+.
*/
USE [ADSPORT];
GO
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER PROCEDURE dbo.ENTRENADOR_CUENTA_OBTENER
    @id_usuario BIGINT,
    @numeroError INT = 0 OUTPUT,
    @respuesta VARCHAR(1000) = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET @numeroError = 0;
    SET @respuesta = 'Cuenta consultada correctamente.';
    BEGIN TRY
    IF @id_usuario IS NULL OR @id_usuario <= 0
        THROW 50400, 'El identificador de usuario no es válido.', 1;
    SELECT U.ID_USUARIO,
        LTRIM(RTRIM(CONCAT(U.NOMBRE, ' ', NULLIF(U.APELLIDO_PATERNO, ''),
            CASE WHEN NULLIF(U.APELLIDO_MATERNO, '') IS NULL THEN '' ELSE ' ' + U.APELLIDO_MATERNO END))) AS NOMBRE_COMPLETO,
        U.CORREO, U.TELEFONO, U.ESTATUS, R.NOMBRE_ROL,
        CAST(CASE WHEN DATALENGTH(U.FOTO) > 0 THEN 1 ELSE 0 END AS BIT) AS TIENE_FOTO
    FROM dbo.USUARIO U
    INNER JOIN dbo.ROL R ON R.ID_ROL = U.ID_ROL
    WHERE U.ID_USUARIO = @id_usuario;
    IF @@ROWCOUNT = 0 THROW 50404, 'La cuenta no existe.', 1;
    END TRY
    BEGIN CATCH
        SET @numeroError = CASE WHEN ERROR_NUMBER() = 50400 THEN 400 WHEN ERROR_NUMBER() = 50404 THEN 404 ELSE ERROR_NUMBER() END;
        SET @respuesta = ERROR_MESSAGE();
    END CATCH;
END;
GO

CREATE OR ALTER PROCEDURE dbo.ENTRENADOR_FOTO_OBTENER
    @id_usuario BIGINT,
    @numeroError INT = 0 OUTPUT,
    @respuesta VARCHAR(1000) = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET @numeroError = 0;
    SET @respuesta = 'Fotografía consultada correctamente.';
    BEGIN TRY
    IF @id_usuario IS NULL OR @id_usuario <= 0
        THROW 50400, 'El identificador de usuario no es válido.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.USUARIO U INNER JOIN dbo.ROL R ON R.ID_ROL = U.ID_ROL
        WHERE U.ID_USUARIO = @id_usuario
          AND UPPER(LTRIM(RTRIM(R.NOMBRE_ROL))) = 'ENTRENADOR'
          AND UPPER(LTRIM(RTRIM(U.ESTATUS))) = 'ACTIVO')
        THROW 50403, 'La cuenta no tiene acceso como entrenador activo.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.USUARIO WHERE ID_USUARIO = @id_usuario AND DATALENGTH(FOTO) > 0)
        THROW 50404, 'El entrenador no tiene fotografía.', 1;
    SELECT U.FOTO FROM dbo.USUARIO U
    INNER JOIN dbo.ROL R ON R.ID_ROL = U.ID_ROL
    WHERE U.ID_USUARIO = @id_usuario
      AND UPPER(LTRIM(RTRIM(R.NOMBRE_ROL))) = 'ENTRENADOR'
      AND UPPER(LTRIM(RTRIM(U.ESTATUS))) = 'ACTIVO';
    END TRY
    BEGIN CATCH
        SET @numeroError = CASE ERROR_NUMBER() WHEN 50400 THEN 400 WHEN 50403 THEN 403 WHEN 50404 THEN 404 ELSE ERROR_NUMBER() END;
        SET @respuesta = ERROR_MESSAGE();
    END CATCH;
END;
GO

CREATE OR ALTER PROCEDURE dbo.ENTRENADOR_PASSWORD_OBTENER
    @id_usuario BIGINT,
    @numeroError INT = 0 OUTPUT,
    @respuesta VARCHAR(1000) = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET @numeroError = 0;
    SET @respuesta = 'Credencial consultada correctamente.';
    BEGIN TRY
    IF @id_usuario IS NULL OR @id_usuario <= 0
        THROW 50400, 'El identificador de usuario no es válido.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.USUARIO U INNER JOIN dbo.ROL R ON R.ID_ROL = U.ID_ROL
        WHERE U.ID_USUARIO = @id_usuario
          AND UPPER(LTRIM(RTRIM(R.NOMBRE_ROL))) = 'ENTRENADOR'
          AND UPPER(LTRIM(RTRIM(U.ESTATUS))) = 'ACTIVO')
        THROW 50403, 'La cuenta no tiene acceso como entrenador activo.', 1;
    SELECT P.[PASSWORD] FROM dbo.USUARIO U
    INNER JOIN dbo.ROL R ON R.ID_ROL = U.ID_ROL
    INNER JOIN dbo.[PASSWORD] P ON P.ID_PASSWORD = U.ID_PASSWORD AND P.ID_USUARIO = U.ID_USUARIO
    WHERE U.ID_USUARIO = @id_usuario
      AND UPPER(LTRIM(RTRIM(R.NOMBRE_ROL))) = 'ENTRENADOR'
      AND UPPER(LTRIM(RTRIM(U.ESTATUS))) = 'ACTIVO';
    IF @@ROWCOUNT = 0 THROW 50404, 'No se encontró la credencial de la cuenta.', 1;
    END TRY
    BEGIN CATCH
        SET @numeroError = CASE ERROR_NUMBER() WHEN 50400 THEN 400 WHEN 50403 THEN 403 WHEN 50404 THEN 404 ELSE ERROR_NUMBER() END;
        SET @respuesta = ERROR_MESSAGE();
    END CATCH;
END;
GO

CREATE OR ALTER PROCEDURE dbo.ENTRENADOR_PASSWORD_CAMBIAR
    @id_usuario BIGINT,
    @password_anterior VARCHAR(60),
    @password_nuevo VARCHAR(60),
    @numeroError INT = 0 OUTPUT,
    @respuesta VARCHAR(1000) = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    SET @numeroError = 0;
    SET @respuesta = 'Contraseña actualizada correctamente.';
    BEGIN TRY
    IF @id_usuario IS NULL OR @id_usuario <= 0
        THROW 50400, 'El identificador de usuario no es válido.', 1;
    IF @password_nuevo IS NULL OR LEN(@password_nuevo) <> 60 OR LEFT(@password_nuevo, 4) NOT IN ('$2a$', '$2b$', '$2y$')
        THROW 50400, 'El formato de la credencial nueva no es válido.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.USUARIO U INNER JOIN dbo.ROL R ON R.ID_ROL = U.ID_ROL
        WHERE U.ID_USUARIO = @id_usuario
          AND UPPER(LTRIM(RTRIM(R.NOMBRE_ROL))) = 'ENTRENADOR'
          AND UPPER(LTRIM(RTRIM(U.ESTATUS))) = 'ACTIVO')
        THROW 50403, 'La cuenta no tiene acceso como entrenador activo.', 1;

    UPDATE P SET P.[PASSWORD] = @password_nuevo
    FROM dbo.[PASSWORD] P
    INNER JOIN dbo.USUARIO U ON U.ID_PASSWORD = P.ID_PASSWORD AND U.ID_USUARIO = P.ID_USUARIO
    INNER JOIN dbo.ROL R ON R.ID_ROL = U.ID_ROL
    WHERE U.ID_USUARIO = @id_usuario
      AND UPPER(LTRIM(RTRIM(R.NOMBRE_ROL))) = 'ENTRENADOR'
      AND UPPER(LTRIM(RTRIM(U.ESTATUS))) = 'ACTIVO'
      AND P.[PASSWORD] COLLATE Latin1_General_100_BIN2 = @password_anterior COLLATE Latin1_General_100_BIN2;
    DECLARE @cambiado INT = @@ROWCOUNT;
    IF @cambiado = 0
        THROW 50409, 'La credencial cambió o ya no está disponible. Comprueba tu sesión e inténtalo de nuevo.', 1;
    SELECT @cambiado AS CAMBIADO;
    END TRY
    BEGIN CATCH
        SET @numeroError = CASE ERROR_NUMBER() WHEN 50400 THEN 400 WHEN 50403 THEN 403 WHEN 50409 THEN 409 ELSE ERROR_NUMBER() END;
        SET @respuesta = ERROR_MESSAGE();
        SELECT 0 AS CAMBIADO;
    END CATCH;
END;
GO
