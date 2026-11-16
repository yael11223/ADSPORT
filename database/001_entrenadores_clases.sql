-- ADSPORT: módulo de clases. Ejecutar en la base ADSPORT existente.
-- Idempotente: conserva CLASE, HORARIO, RESERVA y todos sus registros.
-- Requiere SQL Server 2016+ y nivel de compatibilidad 130+ (OPENJSON).
USE [ADSPORT];
GO
SET XACT_ABORT ON;
GO
IF OBJECT_ID('dbo.CLASE', 'U') IS NULL OR OBJECT_ID('dbo.HORARIO', 'U') IS NULL
    THROW 51000, N'Primero instala el esquema original de ADSPORT.', 1;
GO
BEGIN TRANSACTION;
IF COL_LENGTH('dbo.CLASE', 'DESCRIPCION') IS NULL
    ALTER TABLE dbo.CLASE ADD DESCRIPCION nvarchar(2000) NULL;
IF COL_LENGTH('dbo.CLASE', 'DISPONIBLE') IS NULL
    ALTER TABLE dbo.CLASE ADD DISPONIBLE bit NOT NULL CONSTRAINT DF_CLASE_DISPONIBLE DEFAULT (0) WITH VALUES;
IF COL_LENGTH('dbo.CLASE', 'UBICACION') IS NULL
    ALTER TABLE dbo.CLASE ADD UBICACION nvarchar(100) NULL;
IF COL_LENGTH('dbo.HORARIO', 'DIA_ISO') IS NULL
    ALTER TABLE dbo.HORARIO ADD DIA_ISO tinyint NULL;
IF COL_LENGTH('dbo.HORARIO', 'ACTIVO') IS NULL
    ALTER TABLE dbo.HORARIO ADD ACTIVO bit NOT NULL CONSTRAINT DF_HORARIO_ACTIVO DEFAULT (1) WITH VALUES;
IF COL_LENGTH('dbo.DEPORTE', 'ACTIVO') IS NULL
    ALTER TABLE dbo.DEPORTE ADD ACTIVO bit NOT NULL CONSTRAINT DF_DEPORTE_ACTIVO DEFAULT (1) WITH VALUES;
COMMIT TRANSACTION;
GO
-- DIA_SEMANA original es datetime. Se conserva; el módulo nuevo usa lunes=1...domingo=7.
UPDATE dbo.HORARIO
SET DIA_ISO = CONVERT(tinyint, ((DATEDIFF(day, CONVERT(date, '19000101', 112), DIA_SEMANA) % 7 + 7) % 7) + 1)
WHERE DIA_ISO IS NULL AND DIA_SEMANA IS NOT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_HORARIO_DIA_ISO' AND parent_object_id = OBJECT_ID('dbo.HORARIO'))
    ALTER TABLE dbo.HORARIO WITH NOCHECK ADD CONSTRAINT CK_HORARIO_DIA_ISO CHECK (DIA_ISO IS NULL OR DIA_ISO BETWEEN 1 AND 7);
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_CLASE_PRECIO_NO_NEGATIVO' AND parent_object_id = OBJECT_ID('dbo.CLASE'))
    ALTER TABLE dbo.CLASE WITH NOCHECK ADD CONSTRAINT CK_CLASE_PRECIO_NO_NEGATIVO CHECK (PRECIO IS NULL OR PRECIO >= 0);
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_CLASE_CUPO_POSITIVO' AND parent_object_id = OBJECT_ID('dbo.CLASE'))
    ALTER TABLE dbo.CLASE WITH NOCHECK ADD CONSTRAINT CK_CLASE_CUPO_POSITIVO CHECK (CUPO_MAXIMO IS NULL OR CUPO_MAXIMO > 0);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CLASE_ENTRENADOR' AND object_id = OBJECT_ID('dbo.CLASE'))
    CREATE INDEX IX_CLASE_ENTRENADOR ON dbo.CLASE(ID_ENTRENADOR, DISPONIBLE);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_HORARIO_CLASE_ACTIVO' AND object_id = OBJECT_ID('dbo.HORARIO'))
    CREATE INDEX IX_HORARIO_CLASE_ACTIVO ON dbo.HORARIO(ID_CLASE, ACTIVO) INCLUDE (DIA_ISO, HORA_INICIO, HORA_FIN);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_RESERVA_CLASE' AND object_id = OBJECT_ID('dbo.RESERVA'))
    CREATE INDEX IX_RESERVA_CLASE ON dbo.RESERVA(ID_CLASE) INCLUDE (ID_USUARIO, ESTATUS_RESERVA);
GO
-- Catálogo inicial una sola vez. Reaplicar no recrea deportes renombrados por el administrador.
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE class = 1 AND major_id = OBJECT_ID('dbo.DEPORTE')
               AND minor_id = 0 AND name = 'ADSPORT_CatalogoInicial')
BEGIN
BEGIN TRANSACTION;
-- Una instalación previa de 001 ya realizó su semilla: solo se registra el marcador.
IF OBJECT_ID('dbo.ENTRENADOR_CLASE_GUARDAR', 'P') IS NULL
INSERT dbo.DEPORTE (NOMBRE_DEPORTE, DESCRIPCION, FECHA_UTIMA_MODIFICACION)
SELECT s.Nombre, s.Descripcion, GETDATE()
FROM (VALUES
    (N'Tenis', N'Clases de tenis'),
    (N'Boxeo', N'Clases de boxeo'),
    (N'Fútbol', N'Clases de fútbol'),
    (N'Baloncesto', N'Clases de baloncesto'),
    (N'Natación', N'Clases de natación')
) s(Nombre, Descripcion)
WHERE NOT EXISTS (SELECT 1 FROM dbo.DEPORTE d WHERE UPPER(LTRIM(RTRIM(d.NOMBRE_DEPORTE))) = UPPER(s.Nombre));
EXEC sys.sp_addextendedproperty @name = N'ADSPORT_CatalogoInicial', @value = 1,
    @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'TABLE', @level1name = N'DEPORTE';
COMMIT TRANSACTION;
END;
GO
CREATE OR ALTER PROCEDURE dbo.DEPORTE_LISTAR
    @numeroError int = 0 OUTPUT,
    @respuesta varchar(1000) = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET @numeroError = 0;
    SET @respuesta = 'Deportes consultados correctamente.';
    BEGIN TRY
        SELECT ID_DEPORTE, NOMBRE_DEPORTE FROM dbo.DEPORTE
        WHERE ACTIVO = 1 AND NULLIF(LTRIM(RTRIM(NOMBRE_DEPORTE)), '') IS NOT NULL
        ORDER BY NOMBRE_DEPORTE, ID_DEPORTE;
    END TRY
    BEGIN CATCH
        SET @numeroError = ERROR_NUMBER();
        SET @respuesta = ERROR_MESSAGE();
    END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.ENTRENADOR_CLASES_CONSULTAR
    @IdEntrenador bigint = NULL,
    @Deporte nvarchar(50) = NULL,
    @numeroError int = 0 OUTPUT,
    @respuesta varchar(1000) = NULL OUTPUT,
    @IdDeporte bigint = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET @numeroError = 0;
    SET @respuesta = 'Clases consultadas correctamente.';
    BEGIN TRY
    IF @IdDeporte IS NOT NULL AND @IdDeporte <= 0
        THROW 51000, N'El identificador del deporte debe ser positivo.', 1;
    -- NULL corresponde al catálogo público: solo clases publicadas de entrenadores activos.
    IF @IdEntrenador IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM dbo.USUARIO u JOIN dbo.ROL r ON r.ID_ROL = u.ID_ROL
        WHERE u.ID_USUARIO = @IdEntrenador AND UPPER(LTRIM(RTRIM(r.NOMBRE_ROL))) = 'ENTRENADOR'
          AND UPPER(LTRIM(RTRIM(u.ESTATUS))) = 'ACTIVO')
        THROW 51003, N'La cuenta no tiene acceso como entrenador activo.', 1;

    SELECT c.ID_CLASE, c.ID_DEPORTE, d.NOMBRE_DEPORTE, CONVERT(bit, ISNULL(d.ACTIVO, 0)) AS DEPORTE_ACTIVO, c.NOMBRE_CLASE, c.DESCRIPCION,
           c.PRECIO, c.CUPO_MAXIMO, c.DISPONIBLE, c.UBICACION,
           LTRIM(RTRIM(CONCAT(u.NOMBRE, ' ', u.APELLIDO_PATERNO, ' ', u.APELLIDO_MATERNO))) AS ENTRENADOR_NOMBRE,
           CONVERT(bit, CASE WHEN DATALENGTH(u.FOTO) > 0 THEN 1 ELSE 0 END) AS TIENE_FOTO,
           (SELECT COUNT(DISTINCT rv.ID_USUARIO) FROM dbo.RESERVA rv
            WHERE rv.ID_CLASE = c.ID_CLASE AND UPPER(LTRIM(RTRIM(rv.ESTATUS_RESERVA))) IN
                  ('ACTIVA','ACTIVO','CONFIRMADA','CONFIRMADO','PAGADA','PAGADO','PENDIENTE')) AS ALUMNOS_INSCRITOS
    INTO #Clases
    FROM dbo.CLASE c
    JOIN dbo.USUARIO u ON u.ID_USUARIO = c.ID_ENTRENADOR
    JOIN dbo.ROL r ON r.ID_ROL = u.ID_ROL
    LEFT JOIN dbo.DEPORTE d ON d.ID_DEPORTE = c.ID_DEPORTE
    WHERE (@IdEntrenador IS NOT NULL AND c.ID_ENTRENADOR = @IdEntrenador
           OR @IdEntrenador IS NULL AND c.DISPONIBLE = 1 AND d.ACTIVO = 1
              AND UPPER(LTRIM(RTRIM(r.NOMBRE_ROL))) = 'ENTRENADOR'
              AND UPPER(LTRIM(RTRIM(u.ESTATUS))) = 'ACTIVO'
              AND c.PRECIO >= 0 AND c.CUPO_MAXIMO > 0
              AND EXISTS (SELECT 1 FROM dbo.HORARIO h WHERE h.ID_CLASE = c.ID_CLASE AND h.ACTIVO = 1
                          AND h.DIA_ISO BETWEEN 1 AND 7 AND h.HORA_INICIO < h.HORA_FIN))
      AND (@IdDeporte IS NOT NULL AND c.ID_DEPORTE = @IdDeporte
           OR @IdDeporte IS NULL AND (@Deporte IS NULL OR LTRIM(RTRIM(d.NOMBRE_DEPORTE)) = @Deporte));

    SELECT * FROM #Clases ORDER BY NOMBRE_DEPORTE, NOMBRE_CLASE, ID_CLASE;
    SELECT h.ID_CLASE, h.DIA_ISO, h.HORA_INICIO, h.HORA_FIN
    FROM dbo.HORARIO h JOIN #Clases c ON c.ID_CLASE = h.ID_CLASE
    WHERE h.ACTIVO = 1 AND h.DIA_ISO BETWEEN 1 AND 7 AND h.HORA_INICIO < h.HORA_FIN
    ORDER BY h.ID_CLASE, h.DIA_ISO, h.HORA_INICIO;
    END TRY
    BEGIN CATCH
        SET @numeroError = ERROR_NUMBER();
        SET @respuesta = ERROR_MESSAGE();
    END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.ENTRENADOR_CLASE_GUARDAR
    @IdEntrenador bigint,
    @IdClase bigint = NULL,
    @IdDeporte bigint,
    @NombreClase nvarchar(100),
    @Descripcion nvarchar(2000),
    @Precio decimal(10,2),
    @CupoMaximo int,
    @Disponible bit,
    @Ubicacion nvarchar(100) = NULL,
    @Horarios nvarchar(max),
    @numeroError int = 0 OUTPUT,
    @respuesta varchar(1000) = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    SET @numeroError = 0;
    SET @respuesta = 'Clase guardada correctamente.';
    BEGIN TRY
    IF @IdEntrenador IS NULL OR @IdEntrenador <= 0 OR @Precio IS NULL OR @Precio < 0
       OR @CupoMaximo IS NULL OR @CupoMaximo NOT BETWEEN 1 AND 10000 OR @Disponible IS NULL
       OR NULLIF(LTRIM(RTRIM(@NombreClase)), '') IS NULL
       OR NULLIF(LTRIM(RTRIM(@Descripcion)), '') IS NULL
        THROW 51000, N'Revisa nombre, descripción, precio y capacidad de la clase.', 1;
    IF ISJSON(@Horarios) <> 1 OR LEFT(LTRIM(@Horarios), 1) <> '['
        THROW 51000, N'Los horarios no son válidos.', 1;
    DECLARE @Nuevos TABLE (N int IDENTITY, Dia int NULL, Inicio time(0) NULL, Fin time(0) NULL);
    INSERT @Nuevos (Dia, Inicio, Fin)
    SELECT TRY_CONVERT(int, Dia), TRY_CONVERT(time(0), Inicio), TRY_CONVERT(time(0), Fin)
    FROM OPENJSON(@Horarios) WITH (Dia nvarchar(20) '$.diaSemana', Inicio nvarchar(20) '$.horaInicio', Fin nvarchar(20) '$.horaFin');
    IF (SELECT COUNT(*) FROM @Nuevos) NOT BETWEEN 1 AND 21
       OR EXISTS (SELECT 1 FROM @Nuevos WHERE Dia IS NULL OR Dia NOT BETWEEN 1 AND 7 OR Inicio IS NULL OR Fin IS NULL OR Inicio >= Fin)
        THROW 51000, N'Agrega de 1 a 21 horarios con día válido y hora final posterior a la inicial.', 1;
    IF EXISTS (SELECT 1 FROM @Nuevos a JOIN @Nuevos b ON a.N < b.N AND a.Dia = b.Dia AND a.Inicio < b.Fin AND a.Fin > b.Inicio)
        THROW 51009, N'Los horarios de la clase se superponen.', 1;

        BEGIN TRANSACTION;
        DECLARE @LockResult int, @LockResource nvarchar(255) = CONCAT(N'ADSPORT_CLASES_', @IdEntrenador);
        EXEC @LockResult = sys.sp_getapplock @Resource = @LockResource, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 10000;
        IF @LockResult < 0 THROW 51009, N'Otra operación está guardando tus clases. Inténtalo nuevamente.', 1;
        IF NOT EXISTS (SELECT 1 FROM dbo.USUARIO u WITH (UPDLOCK, HOLDLOCK) JOIN dbo.ROL r ON r.ID_ROL = u.ID_ROL
                       WHERE u.ID_USUARIO = @IdEntrenador AND UPPER(LTRIM(RTRIM(r.NOMBRE_ROL))) = 'ENTRENADOR'
                         AND UPPER(LTRIM(RTRIM(u.ESTATUS))) = 'ACTIVO')
            THROW 51003, N'La cuenta no tiene acceso como entrenador activo.', 1;
        IF @IdClase IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.CLASE WITH (UPDLOCK, HOLDLOCK) WHERE ID_CLASE = @IdClase AND ID_ENTRENADOR = @IdEntrenador)
            THROW 51004, N'La clase no está disponible en tu cuenta.', 1;
        IF NOT EXISTS (SELECT 1 FROM dbo.DEPORTE WHERE ID_DEPORTE = @IdDeporte)
            THROW 51000, N'Selecciona un deporte existente.', 1;
        IF (@IdClase IS NULL OR @Disponible = 1) AND NOT EXISTS (
            SELECT 1 FROM dbo.DEPORTE WITH (UPDLOCK, HOLDLOCK) WHERE ID_DEPORTE = @IdDeporte AND ACTIVO = 1)
            THROW 51000, N'El deporte está inactivo. Selecciona un deporte activo para crear o publicar la clase.', 1;
        IF @IdClase IS NOT NULL AND @CupoMaximo < (
            SELECT COUNT(DISTINCT ID_USUARIO) FROM dbo.RESERVA WITH (UPDLOCK, HOLDLOCK)
            WHERE ID_CLASE = @IdClase AND UPPER(LTRIM(RTRIM(ESTATUS_RESERVA))) IN
                  ('ACTIVA','ACTIVO','CONFIRMADA','CONFIRMADO','PAGADA','PAGADO','PENDIENTE'))
            THROW 51009, N'La capacidad no puede ser menor a los alumnos inscritos.', 1;
        IF @Disponible = 1 AND EXISTS (
            SELECT 1 FROM dbo.CLASE c WITH (UPDLOCK, HOLDLOCK)
            JOIN dbo.HORARIO h ON h.ID_CLASE = c.ID_CLASE AND h.ACTIVO = 1
            JOIN @Nuevos n ON n.Dia = h.DIA_ISO AND n.Inicio < h.HORA_FIN AND n.Fin > h.HORA_INICIO
            WHERE c.ID_ENTRENADOR = @IdEntrenador AND c.DISPONIBLE = 1 AND (@IdClase IS NULL OR c.ID_CLASE <> @IdClase))
            THROW 51009, N'El horario coincide con otra de tus clases disponibles.', 1;

        IF @IdClase IS NULL
        BEGIN
            INSERT dbo.CLASE (ID_DEPORTE, ID_ENTRENADOR, NOMBRE_CLASE, DESCRIPCION, PRECIO, CUPO_MAXIMO, DISPONIBLE, UBICACION, FECHA_ULTIMA_MODIFICACION)
            VALUES (@IdDeporte, @IdEntrenador, @NombreClase, @Descripcion, @Precio, @CupoMaximo, @Disponible, @Ubicacion, GETDATE());
            SET @IdClase = CONVERT(bigint, SCOPE_IDENTITY());
        END
        ELSE
        BEGIN
            UPDATE dbo.CLASE SET ID_DEPORTE = @IdDeporte, NOMBRE_CLASE = @NombreClase, DESCRIPCION = @Descripcion,
                PRECIO = @Precio, CUPO_MAXIMO = @CupoMaximo, DISPONIBLE = @Disponible, UBICACION = @Ubicacion,
                FECHA_ULTIMA_MODIFICACION = GETDATE()
            WHERE ID_CLASE = @IdClase AND ID_ENTRENADOR = @IdEntrenador;
            -- Conserva historial de horarios; nunca elimina inscripciones o clases.
            UPDATE dbo.HORARIO SET ACTIVO = 0, FECHA_ULTIMA_MODIFICACION = GETDATE() WHERE ID_CLASE = @IdClase AND ACTIVO = 1;
        END;
        INSERT dbo.HORARIO (ID_CLASE, DIA_SEMANA, DIA_ISO, HORA_INICIO, HORA_FIN, CANCHA, ACTIVO, FECHA_ULTIMA_MODIFICACION)
        SELECT @IdClase, NULL, Dia, Inicio, Fin, @Ubicacion, 1, GETDATE() FROM @Nuevos;
        COMMIT TRANSACTION;
        SELECT @IdClase AS ID_CLASE;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SET @numeroError = ERROR_NUMBER();
        SET @respuesta = ERROR_MESSAGE();
    END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.ENTRENADOR_CLASE_DISPONIBILIDAD
    @IdEntrenador bigint,
    @IdClase bigint,
    @Disponible bit,
    @numeroError int = 0 OUTPUT,
    @respuesta varchar(1000) = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    SET @numeroError = 0;
    SET @respuesta = 'Disponibilidad actualizada correctamente.';
    BEGIN TRY
        IF @Disponible IS NULL THROW 51000, N'Indica la disponibilidad de la clase.', 1;
        BEGIN TRANSACTION;
        DECLARE @LockResult int, @LockResource nvarchar(255) = CONCAT(N'ADSPORT_CLASES_', @IdEntrenador);
        EXEC @LockResult = sys.sp_getapplock @Resource = @LockResource, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 10000;
        IF @LockResult < 0 THROW 51009, N'Otra operación está guardando tus clases. Inténtalo nuevamente.', 1;
        IF NOT EXISTS (SELECT 1 FROM dbo.USUARIO u WITH (UPDLOCK, HOLDLOCK) JOIN dbo.ROL r ON r.ID_ROL = u.ID_ROL
                       WHERE u.ID_USUARIO = @IdEntrenador AND UPPER(LTRIM(RTRIM(r.NOMBRE_ROL))) = 'ENTRENADOR'
                         AND UPPER(LTRIM(RTRIM(u.ESTATUS))) = 'ACTIVO')
            THROW 51003, N'La cuenta no tiene acceso como entrenador activo.', 1;
        IF NOT EXISTS (SELECT 1 FROM dbo.CLASE WITH (UPDLOCK, HOLDLOCK) WHERE ID_CLASE = @IdClase AND ID_ENTRENADOR = @IdEntrenador)
            THROW 51004, N'La clase no está disponible en tu cuenta.', 1;
        IF @Disponible = 1
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM dbo.CLASE c JOIN dbo.DEPORTE d WITH (UPDLOCK, HOLDLOCK) ON d.ID_DEPORTE = c.ID_DEPORTE
                           WHERE c.ID_CLASE = @IdClase AND d.ACTIVO = 1)
                THROW 51000, N'El deporte está inactivo. Cambia la clase a un deporte activo antes de publicarla.', 1;
            IF EXISTS (SELECT 1 FROM dbo.CLASE WHERE ID_CLASE = @IdClase AND
                       (PRECIO IS NULL OR PRECIO < 0 OR CUPO_MAXIMO IS NULL OR CUPO_MAXIMO < 1 OR
                        NULLIF(LTRIM(RTRIM(DESCRIPCION)), '') IS NULL OR NULLIF(LTRIM(RTRIM(NOMBRE_CLASE)), '') IS NULL OR ID_DEPORTE IS NULL))
                THROW 51000, N'Completa nombre, descripción, deporte, precio y capacidad antes de publicar.', 1;
            IF NOT EXISTS (SELECT 1 FROM dbo.HORARIO WHERE ID_CLASE = @IdClase AND ACTIVO = 1 AND DIA_ISO BETWEEN 1 AND 7 AND HORA_INICIO < HORA_FIN)
                THROW 51000, N'Agrega horarios válidos antes de publicar la clase.', 1;
            IF EXISTS (SELECT 1 FROM dbo.HORARIO WHERE ID_CLASE = @IdClase AND ACTIVO = 1 AND
                       (DIA_ISO IS NULL OR DIA_ISO NOT BETWEEN 1 AND 7 OR HORA_INICIO IS NULL OR HORA_FIN IS NULL OR HORA_INICIO >= HORA_FIN))
                THROW 51000, N'Corrige los horarios incompletos antes de publicar la clase.', 1;
            IF EXISTS (SELECT 1 FROM dbo.HORARIO a JOIN dbo.HORARIO b ON a.ID_HORARIO < b.ID_HORARIO
                       AND a.ID_CLASE = b.ID_CLASE AND a.DIA_ISO = b.DIA_ISO AND a.HORA_INICIO < b.HORA_FIN AND a.HORA_FIN > b.HORA_INICIO
                       WHERE a.ID_CLASE = @IdClase AND a.ACTIVO = 1 AND b.ACTIVO = 1)
                THROW 51009, N'Los horarios de la clase se superponen.', 1;
            IF (SELECT CUPO_MAXIMO FROM dbo.CLASE WHERE ID_CLASE = @IdClase) < (
                SELECT COUNT(DISTINCT ID_USUARIO) FROM dbo.RESERVA WITH (UPDLOCK, HOLDLOCK)
                WHERE ID_CLASE = @IdClase AND UPPER(LTRIM(RTRIM(ESTATUS_RESERVA))) IN
                      ('ACTIVA','ACTIVO','CONFIRMADA','CONFIRMADO','PAGADA','PAGADO','PENDIENTE'))
                THROW 51009, N'La capacidad no puede ser menor a los alumnos inscritos.', 1;
            IF EXISTS (
                SELECT 1 FROM dbo.HORARIO propio JOIN dbo.HORARIO otro ON propio.DIA_ISO = otro.DIA_ISO
                     AND propio.HORA_INICIO < otro.HORA_FIN AND propio.HORA_FIN > otro.HORA_INICIO
                JOIN dbo.CLASE c ON c.ID_CLASE = otro.ID_CLASE
                WHERE propio.ID_CLASE = @IdClase AND propio.ACTIVO = 1 AND otro.ACTIVO = 1
                  AND c.ID_CLASE <> @IdClase AND c.ID_ENTRENADOR = @IdEntrenador AND c.DISPONIBLE = 1)
                THROW 51009, N'El horario coincide con otra de tus clases disponibles.', 1;
        END;
        UPDATE dbo.CLASE SET DISPONIBLE = @Disponible, FECHA_ULTIMA_MODIFICACION = GETDATE()
        WHERE ID_CLASE = @IdClase AND ID_ENTRENADOR = @IdEntrenador;
        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SET @numeroError = ERROR_NUMBER();
        SET @respuesta = ERROR_MESSAGE();
    END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.CLASE_FOTO_PUBLICA
    @IdClase bigint,
    @numeroError int = 0 OUTPUT,
    @respuesta varchar(1000) = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET @numeroError = 0;
    SET @respuesta = 'Fotografía consultada correctamente.';
    BEGIN TRY
    SELECT u.FOTO FROM dbo.CLASE c JOIN dbo.USUARIO u ON u.ID_USUARIO = c.ID_ENTRENADOR
    JOIN dbo.DEPORTE d ON d.ID_DEPORTE = c.ID_DEPORTE AND d.ACTIVO = 1
    JOIN dbo.ROL r ON r.ID_ROL = u.ID_ROL
    WHERE c.ID_CLASE = @IdClase AND c.DISPONIBLE = 1 AND c.PRECIO >= 0 AND c.CUPO_MAXIMO > 0
      AND UPPER(LTRIM(RTRIM(r.NOMBRE_ROL))) = 'ENTRENADOR'
      AND UPPER(LTRIM(RTRIM(u.ESTATUS))) = 'ACTIVO'
      AND EXISTS (SELECT 1 FROM dbo.HORARIO h WHERE h.ID_CLASE = c.ID_CLASE AND h.ACTIVO = 1 AND h.DIA_ISO BETWEEN 1 AND 7 AND h.HORA_INICIO < h.HORA_FIN);
    END TRY
    BEGIN CATCH
        SET @numeroError = ERROR_NUMBER();
        SET @respuesta = ERROR_MESSAGE();
    END CATCH;
END;
GO
