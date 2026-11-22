-- ADSPORT: ejecutar sobre la base de datos del script adjunto del 22/11/2026.
-- Puede ejecutarse nuevamente. Conserva usuarios, clases, reservas e historial.
-- Los horarios son semanales (ISO: lunes=1, domingo=7), sin intervalos nocturnos.
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET XACT_ABORT ON;
GO
IF COL_LENGTH('dbo.USUARIO', 'CODIGO_QR') < 128
    ALTER TABLE dbo.USUARIO ALTER COLUMN CODIGO_QR varchar(128) NULL;
GO
-- Identificadores opacos: el QR no contiene contraseñas, correo ni otros datos personales.
UPDATE dbo.USUARIO SET CODIGO_QR = 'ADS:' + REPLACE(CONVERT(varchar(36), NEWID()), '-', '')
WHERE NULLIF(LTRIM(RTRIM(CODIGO_QR)), '') IS NULL;
;WITH Repetidos AS (
    SELECT CODIGO_QR, ROW_NUMBER() OVER (PARTITION BY CODIGO_QR ORDER BY ID_USUARIO) AS N
    FROM dbo.USUARIO
)
UPDATE Repetidos SET CODIGO_QR = 'ADS:' + REPLACE(CONVERT(varchar(36), NEWID()), '-', '') WHERE N > 1;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.USUARIO') AND name = 'UX_USUARIO_CODIGO_QR')
    CREATE UNIQUE INDEX UX_USUARIO_CODIGO_QR ON dbo.USUARIO(CODIGO_QR) WHERE CODIGO_QR IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM dbo.ROL WHERE UPPER(LTRIM(RTRIM(NOMBRE_ROL))) = 'ENTRENADOR')
    INSERT dbo.ROL(NOMBRE_ROL, FECHA_UTIMA_MODIFICACION) VALUES ('ENTRENADOR', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM dbo.ROL WHERE UPPER(LTRIM(RTRIM(NOMBRE_ROL))) = 'USUARIO')
    INSERT dbo.ROL(NOMBRE_ROL, FECHA_UTIMA_MODIFICACION) VALUES ('USUARIO', GETUTCDATE());
GO
IF OBJECT_ID('dbo.CANCHA', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CANCHA (
        ID_CANCHA bigint IDENTITY PRIMARY KEY,
        ID_DEPORTE bigint NOT NULL REFERENCES dbo.DEPORTE(ID_DEPORTE),
        NOMBRE nvarchar(100) NOT NULL,
        UBICACION nvarchar(100) NULL,
        ACTIVO bit NOT NULL CONSTRAINT DF_CANCHA_ACTIVO DEFAULT 1,
        FECHA_MODIFICACION datetime2 NOT NULL CONSTRAINT DF_CANCHA_FECHA DEFAULT SYSUTCDATETIME()
    );
    CREATE UNIQUE INDEX UX_CANCHA_NOMBRE ON dbo.CANCHA(NOMBRE);
END;
IF OBJECT_ID('dbo.CANCHA_APERTURA', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CANCHA_APERTURA (
        ID_APERTURA bigint IDENTITY PRIMARY KEY,
        ID_CANCHA bigint NOT NULL REFERENCES dbo.CANCHA(ID_CANCHA),
        DIA_ISO tinyint NOT NULL CHECK (DIA_ISO BETWEEN 1 AND 7),
        HORA_INICIO time(0) NOT NULL,
        HORA_FIN time(0) NOT NULL,
        CONSTRAINT CK_CANCHA_APERTURA_HORAS CHECK (HORA_INICIO < HORA_FIN)
    );
    CREATE INDEX IX_CANCHA_APERTURA ON dbo.CANCHA_APERTURA(ID_CANCHA, DIA_ISO, HORA_INICIO);
END;
IF COL_LENGTH('dbo.HORARIO', 'ID_CANCHA') IS NULL
    ALTER TABLE dbo.HORARIO ADD ID_CANCHA bigint NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_HORARIO_CANCHA')
    ALTER TABLE dbo.HORARIO ADD CONSTRAINT FK_HORARIO_CANCHA FOREIGN KEY(ID_CANCHA) REFERENCES dbo.CANCHA(ID_CANCHA);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.HORARIO') AND name = 'IX_HORARIO_CANCHA')
    CREATE INDEX IX_HORARIO_CANCHA ON dbo.HORARIO(ID_CANCHA, DIA_ISO, ACTIVO) INCLUDE(ID_CLASE, HORA_INICIO, HORA_FIN);
GO
CREATE OR ALTER PROCEDURE dbo.USUARIO_LISTA @Rol varchar(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT u.ID_USUARIO, u.ID_ROL, r.NOMBRE_ROL, u.NOMBRE, u.APELLIDO_PATERNO,
        u.APELLIDO_MATERNO, u.CORREO, u.TELEFONO, u.ESTATUS, u.CODIGO_QR,
        u.FECHA__ULTIMA_MODIFICACION, CONVERT(bit, CASE WHEN DATALENGTH(u.FOTO) > 0 THEN 1 ELSE 0 END) AS TIENE_FOTO
    FROM dbo.USUARIO u LEFT JOIN dbo.ROL r ON r.ID_ROL = u.ID_ROL
    WHERE @Rol IS NULL OR UPPER(LTRIM(RTRIM(r.NOMBRE_ROL))) = UPPER(LTRIM(RTRIM(@Rol)))
    ORDER BY u.NOMBRE, u.APELLIDO_PATERNO, u.ID_USUARIO;
END;
GO
CREATE OR ALTER PROCEDURE dbo.USUARIO_BUSCAR_POR_ID @id_usuario bigint
AS
BEGIN
    SET NOCOUNT ON;
    SELECT u.*, r.NOMBRE_ROL,
        CONVERT(bit, CASE WHEN DATALENGTH(u.FOTO) > 0 THEN 1 ELSE 0 END) AS TIENE_FOTO
    FROM dbo.USUARIO u LEFT JOIN dbo.ROL r ON r.ID_ROL = u.ID_ROL WHERE u.ID_USUARIO = @id_usuario;
END;
GO
CREATE OR ALTER PROCEDURE dbo.USUARIO_AGREGA
    @id_rol bigint, @nombre varchar(100), @apellido_paterno varchar(100),
    @apellido_materno varchar(100), @correo varchar(100), @telefono varchar(100),
    @estatus varchar(50), @codigo_qr varchar(128) = NULL, @foto varbinary(max) = NULL,
    @password_hash varchar(60) = NULL, @numeroError int OUTPUT, @respuesta varchar(1000) OUTPUT,
    @id_usuario bigint = NULL OUTPUT, @codigo_generado varchar(128) = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    SET @numeroError = 0; SET @respuesta = 'Usuario registrado con su código QR.';
    BEGIN TRY
        IF @password_hash IS NULL OR LEN(@password_hash) <> 60 OR LEFT(@password_hash, 4) NOT IN ('$2a$', '$2b$', '$2y$')
            THROW 51000, 'La contraseña inicial no es válida.', 1;
        IF NULLIF(LTRIM(RTRIM(@nombre)), '') IS NULL OR NULLIF(LTRIM(RTRIM(@apellido_paterno)), '') IS NULL
           OR @correo NOT LIKE '%_@_%._%' OR @correo IS NULL OR UPPER(@estatus) NOT IN ('ACTIVO','INACTIVO') OR @estatus IS NULL
            THROW 51000, 'Completa nombre, apellido, correo y estatus válidos.', 1;
        BEGIN TRANSACTION;
        IF NOT EXISTS (SELECT 1 FROM dbo.ROL WHERE ID_ROL = @id_rol)
            THROW 51000, 'El rol seleccionado no existe.', 1;
        IF EXISTS (SELECT 1 FROM dbo.USUARIO WITH (UPDLOCK, HOLDLOCK)
                   WHERE LOWER(LTRIM(RTRIM(CORREO))) = LOWER(LTRIM(RTRIM(@correo))))
            THROW 51009, 'El correo ya está registrado.', 1;
        SET @codigo_generado = 'ADS:' + REPLACE(CONVERT(varchar(36), NEWID()), '-', '');
        INSERT dbo.USUARIO(ID_ROL,NOMBRE,APELLIDO_PATERNO,APELLIDO_MATERNO,CORREO,TELEFONO,ESTATUS,CODIGO_QR,FOTO,FECHA__ULTIMA_MODIFICACION,ID_PASSWORD)
        VALUES(@id_rol,LTRIM(RTRIM(@nombre)),LTRIM(RTRIM(@apellido_paterno)),NULLIF(LTRIM(RTRIM(@apellido_materno)),''),
               LOWER(LTRIM(RTRIM(@correo))),@telefono,UPPER(@estatus),@codigo_generado,@foto,GETUTCDATE(),0);
        SET @id_usuario = CONVERT(bigint, SCOPE_IDENTITY());
        INSERT dbo.[PASSWORD](ID_USUARIO,[PASSWORD]) VALUES(@id_usuario,@password_hash);
        UPDATE dbo.USUARIO SET ID_PASSWORD = CONVERT(bigint,SCOPE_IDENTITY()) WHERE ID_USUARIO = @id_usuario;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK;
        SET @id_usuario = NULL; SET @codigo_generado = NULL;
        SET @numeroError = ERROR_NUMBER(); SET @respuesta = ERROR_MESSAGE();
    END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.USUARIO_ACTUALIZA
    @id_usuario bigint, @id_rol bigint, @nombre varchar(100), @apellido_paterno varchar(100),
    @apellido_materno varchar(100), @correo varchar(100), @telefono varchar(100), @estatus varchar(50),
    @codigo_qr varchar(128) = NULL, @foto varbinary(max) = NULL,
    @numeroError int OUTPUT, @respuesta varchar(1000) OUTPUT
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    SET @numeroError = 0; SET @respuesta = 'Usuario actualizado. Su QR se conserva.';
    BEGIN TRY
        IF NULLIF(LTRIM(RTRIM(@nombre)),'') IS NULL OR NULLIF(LTRIM(RTRIM(@apellido_paterno)),'') IS NULL
           OR @correo IS NULL OR @correo NOT LIKE '%_@_%._%' OR @estatus IS NULL OR UPPER(@estatus) NOT IN ('ACTIVO','INACTIVO')
            THROW 51000, 'Completa los datos obligatorios del usuario.', 1;
        BEGIN TRANSACTION;
        DECLARE @Lock int;
        EXEC @Lock = sys.sp_getapplock @Resource=N'ADSPORT_AGENDA', @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=10000;
        IF @Lock < 0 THROW 51009, 'La agenda se está actualizando. Intenta nuevamente.', 1;
        IF NOT EXISTS (SELECT 1 FROM dbo.USUARIO WHERE ID_USUARIO=@id_usuario) THROW 51004, 'El usuario no existe.', 1;
        IF NOT EXISTS (SELECT 1 FROM dbo.ROL WHERE ID_ROL=@id_rol) THROW 51000, 'El rol no existe.', 1;
        IF EXISTS (SELECT 1 FROM dbo.USUARIO WITH(UPDLOCK,HOLDLOCK) WHERE ID_USUARIO<>@id_usuario
                   AND LOWER(LTRIM(RTRIM(CORREO)))=LOWER(LTRIM(RTRIM(@correo)))) THROW 51009, 'El correo ya está registrado.', 1;
        UPDATE dbo.USUARIO SET ID_ROL=@id_rol,NOMBRE=LTRIM(RTRIM(@nombre)),APELLIDO_PATERNO=LTRIM(RTRIM(@apellido_paterno)),
            APELLIDO_MATERNO=NULLIF(LTRIM(RTRIM(@apellido_materno)),''),CORREO=LOWER(LTRIM(RTRIM(@correo))),
            TELEFONO=@telefono,ESTATUS=UPPER(@estatus),FOTO=COALESCE(@foto,FOTO),FECHA__ULTIMA_MODIFICACION=GETUTCDATE()
        WHERE ID_USUARIO=@id_usuario;
        IF UPPER(@estatus)<>'ACTIVO' OR NOT EXISTS (SELECT 1 FROM dbo.ROL WHERE ID_ROL=@id_rol AND UPPER(LTRIM(RTRIM(NOMBRE_ROL)))='ENTRENADOR')
            UPDATE dbo.CLASE SET DISPONIBLE=0,FECHA_ULTIMA_MODIFICACION=GETUTCDATE() WHERE ID_ENTRENADOR=@id_usuario;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF XACT_STATE()<>0 ROLLBACK;
        SET @numeroError=ERROR_NUMBER(); SET @respuesta=ERROR_MESSAGE();
    END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.USUARIO_ELIMINA @id_usuario bigint,@numeroError int OUTPUT,@respuesta varchar(1000) OUTPUT
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    SET @numeroError=0; SET @respuesta='Usuario desactivado. Se conservan sus datos, clases y reservas.';
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @Lock int;
        EXEC @Lock=sys.sp_getapplock @Resource=N'ADSPORT_AGENDA',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
        IF @Lock<0 THROW 51009,'La agenda se está actualizando. Intenta nuevamente.',1;
        IF NOT EXISTS(SELECT 1 FROM dbo.USUARIO WHERE ID_USUARIO=@id_usuario) THROW 51004,'El usuario no existe.',1;
        UPDATE dbo.USUARIO SET ESTATUS='INACTIVO',FECHA__ULTIMA_MODIFICACION=GETUTCDATE() WHERE ID_USUARIO=@id_usuario;
        UPDATE dbo.CLASE SET DISPONIBLE=0,FECHA_ULTIMA_MODIFICACION=GETUTCDATE() WHERE ID_ENTRENADOR=@id_usuario;
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
    SELECT ca.ID_CANCHA,ca.ID_DEPORTE,ca.NOMBRE,ca.UBICACION,ca.ACTIVO,d.NOMBRE_DEPORTE,d.ACTIVO AS DEPORTE_ACTIVO
    FROM dbo.CANCHA ca JOIN dbo.DEPORTE d ON d.ID_DEPORTE=ca.ID_DEPORTE
    WHERE @IncluirInactivas=1 OR ca.ACTIVO=1 AND d.ACTIVO=1 ORDER BY ca.NOMBRE;
    SELECT a.ID_CANCHA,a.DIA_ISO,a.HORA_INICIO,a.HORA_FIN FROM dbo.CANCHA_APERTURA a
    JOIN dbo.CANCHA ca ON ca.ID_CANCHA=a.ID_CANCHA JOIN dbo.DEPORTE d ON d.ID_DEPORTE=ca.ID_DEPORTE
    WHERE @IncluirInactivas=1 OR ca.ACTIVO=1 AND d.ACTIVO=1 ORDER BY a.ID_CANCHA,a.DIA_ISO,a.HORA_INICIO;
END;
GO
CREATE OR ALTER PROCEDURE dbo.CANCHA_GUARDAR
    @IdCancha bigint=NULL,@IdDeporte bigint,@Nombre nvarchar(100),@Ubicacion nvarchar(100)=NULL,
    @Activo bit,@Horarios nvarchar(max),@numeroError int=0 OUTPUT,@respuesta varchar(1000)=NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    SET @numeroError=0; SET @respuesta='Cancha guardada correctamente.';
    BEGIN TRY
        IF NULLIF(LTRIM(RTRIM(@Nombre)),'') IS NULL OR @Activo IS NULL THROW 51000,'Completa el nombre de la cancha.',1;
        IF ISJSON(@Horarios)<>1 OR LEFT(LTRIM(@Horarios),1)<>'[' THROW 51000,'Los horarios de apertura no son válidos.',1;
        DECLARE @Apertura TABLE(N int IDENTITY,Dia int,Inicio time(0),Fin time(0));
        INSERT @Apertura(Dia,Inicio,Fin)
        SELECT TRY_CONVERT(int,Dia),TRY_CONVERT(time(0),Inicio),TRY_CONVERT(time(0),Fin)
        FROM OPENJSON(@Horarios) WITH(Dia nvarchar(20) '$.diaSemana',Inicio nvarchar(20) '$.horaInicio',Fin nvarchar(20) '$.horaFin');
        IF (SELECT COUNT(*) FROM @Apertura) NOT BETWEEN 1 AND 21
           OR EXISTS(SELECT 1 FROM @Apertura WHERE Dia IS NULL OR Dia NOT BETWEEN 1 AND 7 OR Inicio IS NULL OR Fin IS NULL OR Inicio>=Fin)
            THROW 51000,'Agrega entre 1 y 21 horarios válidos de apertura.',1;
        IF EXISTS(SELECT 1 FROM @Apertura a JOIN @Apertura b ON a.N<b.N AND a.Dia=b.Dia AND a.Inicio<b.Fin AND a.Fin>b.Inicio)
            THROW 51009,'Los horarios de apertura se cruzan.',1;
        BEGIN TRANSACTION;
        DECLARE @Lock int;
        EXEC @Lock=sys.sp_getapplock @Resource=N'ADSPORT_AGENDA',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
        IF @Lock<0 THROW 51009,'La agenda se está actualizando. Intenta nuevamente.',1;
        IF NOT EXISTS(SELECT 1 FROM dbo.DEPORTE WHERE ID_DEPORTE=@IdDeporte)
            THROW 51000,'Selecciona un deporte existente.',1;
        IF @Activo=1 AND NOT EXISTS(SELECT 1 FROM dbo.DEPORTE WHERE ID_DEPORTE=@IdDeporte AND ACTIVO=1)
            THROW 51000,'Selecciona un deporte activo para habilitar la cancha.',1;
        IF @IdCancha IS NOT NULL AND NOT EXISTS(SELECT 1 FROM dbo.CANCHA WHERE ID_CANCHA=@IdCancha)
            THROW 51004,'La cancha no existe.',1;
        IF EXISTS(SELECT 1 FROM dbo.CANCHA WHERE (@IdCancha IS NULL OR ID_CANCHA<>@IdCancha)
                  AND UPPER(LTRIM(RTRIM(NOMBRE)))=UPPER(LTRIM(RTRIM(@Nombre)))) THROW 51009,'Ya existe una cancha con ese nombre.',1;
        IF EXISTS(SELECT 1 FROM dbo.HORARIO h JOIN dbo.CLASE c ON c.ID_CLASE=h.ID_CLASE
                  WHERE h.ID_CANCHA=@IdCancha AND h.ACTIVO=1 AND c.DISPONIBLE=1
                    AND (@Activo=0 OR c.ID_DEPORTE<>@IdDeporte OR NOT EXISTS(
                        SELECT 1 FROM @Apertura a WHERE a.Dia=h.DIA_ISO AND a.Inicio<=h.HORA_INICIO AND a.Fin>=h.HORA_FIN)))
            THROW 51009,'La cancha tiene clases publicadas. Reasígnalas o desactívalas antes de cambiar el deporte, cerrar la cancha o reducir sus horarios.',1;
        IF @IdCancha IS NULL
        BEGIN
            INSERT dbo.CANCHA(ID_DEPORTE,NOMBRE,UBICACION,ACTIVO) VALUES(@IdDeporte,LTRIM(RTRIM(@Nombre)),@Ubicacion,@Activo);
            SET @IdCancha=CONVERT(bigint,SCOPE_IDENTITY());
        END
        ELSE UPDATE dbo.CANCHA SET ID_DEPORTE=@IdDeporte,NOMBRE=LTRIM(RTRIM(@Nombre)),UBICACION=@Ubicacion,
            ACTIVO=@Activo,FECHA_MODIFICACION=SYSUTCDATETIME() WHERE ID_CANCHA=@IdCancha;
        DELETE dbo.CANCHA_APERTURA WHERE ID_CANCHA=@IdCancha;
        INSERT dbo.CANCHA_APERTURA(ID_CANCHA,DIA_ISO,HORA_INICIO,HORA_FIN) SELECT @IdCancha,Dia,Inicio,Fin FROM @Apertura;
        COMMIT;
        SELECT @IdCancha AS ID_CANCHA;
    END TRY
    BEGIN CATCH
        IF XACT_STATE()<>0 ROLLBACK;
        SET @numeroError=ERROR_NUMBER(); SET @respuesta=ERROR_MESSAGE();
    END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.CANCHA_DISPONIBILIDAD
    @IdCancha bigint,@DiaISO int=NULL,@IdEntrenador bigint=NULL,@ExcluirClase bigint=NULL,
    @numeroError int=0 OUTPUT,@respuesta varchar(1000)=NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET @numeroError=0; SET @respuesta='Disponibilidad consultada.';
    BEGIN TRY
        IF @DiaISO IS NOT NULL AND @DiaISO NOT BETWEEN 1 AND 7 THROW 51000,'El día no es válido.',1;
        IF NOT EXISTS(SELECT 1 FROM dbo.CANCHA WHERE ID_CANCHA=@IdCancha) THROW 51004,'La cancha no existe.',1;
        IF @ExcluirClase IS NOT NULL AND @IdEntrenador IS NOT NULL AND NOT EXISTS(
            SELECT 1 FROM dbo.CLASE WHERE ID_CLASE=@ExcluirClase AND ID_ENTRENADOR=@IdEntrenador)
            THROW 51003,'Solo puedes excluir una clase de tu cuenta.',1;
        SELECT a.DIA_ISO,a.HORA_INICIO,a.HORA_FIN FROM dbo.CANCHA_APERTURA a
        JOIN dbo.CANCHA ca ON ca.ID_CANCHA=a.ID_CANCHA JOIN dbo.DEPORTE d ON d.ID_DEPORTE=ca.ID_DEPORTE
        WHERE a.ID_CANCHA=@IdCancha AND ca.ACTIVO=1 AND d.ACTIVO=1 AND (@DiaISO IS NULL OR a.DIA_ISO=@DiaISO)
        ORDER BY a.DIA_ISO,a.HORA_INICIO;
        SELECT h.DIA_ISO,h.HORA_INICIO,h.HORA_FIN,c.ID_CLASE,c.NOMBRE_CLASE,h.ID_CANCHA
        FROM dbo.HORARIO h JOIN dbo.CLASE c ON c.ID_CLASE=h.ID_CLASE
        WHERE h.ACTIVO=1 AND c.DISPONIBLE=1 AND (h.ID_CANCHA=@IdCancha OR c.ID_ENTRENADOR=@IdEntrenador)
          AND (@ExcluirClase IS NULL OR c.ID_CLASE<>@ExcluirClase) AND (@DiaISO IS NULL OR h.DIA_ISO=@DiaISO)
          AND h.DIA_ISO BETWEEN 1 AND 7 AND h.HORA_INICIO<h.HORA_FIN
        ORDER BY h.DIA_ISO,h.HORA_INICIO;
    END TRY
    BEGIN CATCH
        SET @numeroError=ERROR_NUMBER(); SET @respuesta=ERROR_MESSAGE();
    END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.ENTRENADOR_CLASE_GUARDAR
    @IdEntrenador bigint,@IdClase bigint=NULL,@IdDeporte bigint,@NombreClase nvarchar(100),
    @Descripcion nvarchar(2000),@Precio decimal(10,2),@CupoMaximo int,@Disponible bit,
    @Ubicacion nvarchar(100)=NULL,@Horarios nvarchar(max),@numeroError int=0 OUTPUT,
    @respuesta varchar(1000)=NULL OUTPUT,@IdCancha bigint=NULL
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    SET @numeroError=0; SET @respuesta='Clase guardada correctamente.';
    BEGIN TRY
        IF @IdEntrenador IS NULL OR @IdEntrenador<=0 OR @IdCancha IS NULL OR @IdCancha<=0
           OR @Precio IS NULL OR @Precio<0 OR @CupoMaximo IS NULL OR @CupoMaximo NOT BETWEEN 1 AND 10000
           OR @Disponible IS NULL OR NULLIF(LTRIM(RTRIM(@NombreClase)),'') IS NULL OR NULLIF(LTRIM(RTRIM(@Descripcion)),'') IS NULL
            THROW 51000,'Completa los datos de la clase y selecciona una cancha.',1;
        IF ISJSON(@Horarios)<>1 OR LEFT(LTRIM(@Horarios),1)<>'[' THROW 51000,'Los horarios no son válidos.',1;
        DECLARE @Nuevos TABLE(N int IDENTITY,Dia int,Inicio time(0),Fin time(0));
        INSERT @Nuevos(Dia,Inicio,Fin)
        SELECT TRY_CONVERT(int,Dia),TRY_CONVERT(time(0),Inicio),TRY_CONVERT(time(0),Fin)
        FROM OPENJSON(@Horarios) WITH(Dia nvarchar(20) '$.diaSemana',Inicio nvarchar(20) '$.horaInicio',Fin nvarchar(20) '$.horaFin');
        IF (SELECT COUNT(*) FROM @Nuevos) NOT BETWEEN 1 AND 21 OR EXISTS(
            SELECT 1 FROM @Nuevos WHERE Dia IS NULL OR Dia NOT BETWEEN 1 AND 7 OR Inicio IS NULL OR Fin IS NULL OR Inicio>=Fin)
            THROW 51000,'Agrega de 1 a 21 horarios válidos.',1;
        IF EXISTS(SELECT 1 FROM @Nuevos a JOIN @Nuevos b ON a.N<b.N AND a.Dia=b.Dia AND a.Inicio<b.Fin AND a.Fin>b.Inicio)
            THROW 51009,'Los horarios de esta clase se cruzan.',1;
        BEGIN TRANSACTION;
        DECLARE @Lock int;
        -- El mismo bloqueo protege altas, ediciones, publicaciones y cambios de apertura.
        EXEC @Lock=sys.sp_getapplock @Resource=N'ADSPORT_AGENDA',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
        IF @Lock<0 THROW 51009,'La agenda se está actualizando. Intenta nuevamente.',1;
        IF NOT EXISTS(SELECT 1 FROM dbo.USUARIO u JOIN dbo.ROL r ON r.ID_ROL=u.ID_ROL
                      WHERE u.ID_USUARIO=@IdEntrenador AND UPPER(LTRIM(RTRIM(r.NOMBRE_ROL)))='ENTRENADOR'
                        AND UPPER(LTRIM(RTRIM(u.ESTATUS)))='ACTIVO') THROW 51003,'Se requiere un entrenador activo.',1;
        IF @IdClase IS NOT NULL AND NOT EXISTS(SELECT 1 FROM dbo.CLASE WHERE ID_CLASE=@IdClase AND ID_ENTRENADOR=@IdEntrenador)
            THROW 51004,'La clase no pertenece a tu cuenta.',1;
        IF NOT EXISTS(SELECT 1 FROM dbo.CANCHA ca WITH(UPDLOCK,HOLDLOCK) JOIN dbo.DEPORTE d WITH(UPDLOCK,HOLDLOCK) ON d.ID_DEPORTE=ca.ID_DEPORTE
                      WHERE ca.ID_CANCHA=@IdCancha AND ca.ID_DEPORTE=@IdDeporte AND ca.ACTIVO=1 AND d.ACTIVO=1)
            THROW 51000,'La cancha debe estar activa y corresponder al deporte de la clase.',1;
        IF EXISTS(SELECT 1 FROM @Nuevos n WHERE NOT EXISTS(SELECT 1 FROM dbo.CANCHA_APERTURA a
                  WHERE a.ID_CANCHA=@IdCancha AND a.DIA_ISO=n.Dia AND a.HORA_INICIO<=n.Inicio AND a.HORA_FIN>=n.Fin))
            THROW 51009,'Un horario está fuera del horario de apertura de la cancha.',1;
        IF @IdClase IS NOT NULL AND @CupoMaximo<(SELECT COUNT(DISTINCT ID_USUARIO) FROM dbo.RESERVA WITH(UPDLOCK,HOLDLOCK)
            WHERE ID_CLASE=@IdClase AND UPPER(LTRIM(RTRIM(ESTATUS_RESERVA))) IN ('ACTIVA','ACTIVO','CONFIRMADA','CONFIRMADO','PAGADA','PAGADO','PENDIENTE'))
            THROW 51009,'La capacidad no puede ser menor a los alumnos inscritos.',1;
        IF @Disponible=1 AND EXISTS(SELECT 1 FROM dbo.HORARIO h JOIN dbo.CLASE c ON c.ID_CLASE=h.ID_CLASE
            JOIN @Nuevos n ON n.Dia=h.DIA_ISO AND n.Inicio<h.HORA_FIN AND n.Fin>h.HORA_INICIO
            WHERE h.ACTIVO=1 AND c.DISPONIBLE=1 AND (@IdClase IS NULL OR c.ID_CLASE<>@IdClase)
              AND (h.ID_CANCHA=@IdCancha OR c.ID_ENTRENADOR=@IdEntrenador))
            THROW 51009,'La cancha o el profesor ya tienen una clase en ese horario. Actualiza la disponibilidad.',1;
        SELECT @Ubicacion=COALESCE(NULLIF(UBICACION,''),NOMBRE) FROM dbo.CANCHA WHERE ID_CANCHA=@IdCancha;
        IF @IdClase IS NULL
        BEGIN
            INSERT dbo.CLASE(ID_DEPORTE,ID_ENTRENADOR,NOMBRE_CLASE,DESCRIPCION,PRECIO,CUPO_MAXIMO,DISPONIBLE,UBICACION,FECHA_ULTIMA_MODIFICACION)
            VALUES(@IdDeporte,@IdEntrenador,@NombreClase,@Descripcion,@Precio,@CupoMaximo,@Disponible,@Ubicacion,GETUTCDATE());
            SET @IdClase=CONVERT(bigint,SCOPE_IDENTITY());
        END
        ELSE
        BEGIN
            UPDATE dbo.CLASE SET ID_DEPORTE=@IdDeporte,NOMBRE_CLASE=@NombreClase,DESCRIPCION=@Descripcion,PRECIO=@Precio,
                CUPO_MAXIMO=@CupoMaximo,DISPONIBLE=@Disponible,UBICACION=@Ubicacion,FECHA_ULTIMA_MODIFICACION=GETUTCDATE()
            WHERE ID_CLASE=@IdClase AND ID_ENTRENADOR=@IdEntrenador;
            UPDATE dbo.HORARIO SET ACTIVO=0,FECHA_ULTIMA_MODIFICACION=GETUTCDATE() WHERE ID_CLASE=@IdClase AND ACTIVO=1;
        END;
        INSERT dbo.HORARIO(ID_CLASE,DIA_SEMANA,DIA_ISO,HORA_INICIO,HORA_FIN,CANCHA,ID_CANCHA,ACTIVO,FECHA_ULTIMA_MODIFICACION)
        SELECT @IdClase,NULL,n.Dia,n.Inicio,n.Fin,ca.NOMBRE,@IdCancha,1,GETUTCDATE()
        FROM @Nuevos n CROSS JOIN dbo.CANCHA ca WHERE ca.ID_CANCHA=@IdCancha;
        COMMIT;
        SELECT @IdClase AS ID_CLASE;
    END TRY
    BEGIN CATCH
        IF XACT_STATE()<>0 ROLLBACK;
        SET @numeroError=ERROR_NUMBER(); SET @respuesta=ERROR_MESSAGE();
    END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.ENTRENADOR_CLASE_DISPONIBILIDAD
    @IdEntrenador bigint,@IdClase bigint,@Disponible bit,@numeroError int=0 OUTPUT,@respuesta varchar(1000)=NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    SET @numeroError=0; SET @respuesta='Disponibilidad actualizada.';
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @Lock int;
        EXEC @Lock=sys.sp_getapplock @Resource=N'ADSPORT_AGENDA',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
        IF @Lock<0 THROW 51009,'La agenda se está actualizando. Intenta nuevamente.',1;
        IF @Disponible IS NULL THROW 51000,'Indica la disponibilidad.',1;
        IF NOT EXISTS(SELECT 1 FROM dbo.USUARIO u JOIN dbo.ROL r ON r.ID_ROL=u.ID_ROL WHERE u.ID_USUARIO=@IdEntrenador
            AND UPPER(LTRIM(RTRIM(r.NOMBRE_ROL)))='ENTRENADOR' AND UPPER(LTRIM(RTRIM(u.ESTATUS)))='ACTIVO')
            THROW 51003,'Se requiere un entrenador activo.',1;
        IF NOT EXISTS(SELECT 1 FROM dbo.CLASE WHERE ID_CLASE=@IdClase AND ID_ENTRENADOR=@IdEntrenador)
            THROW 51004,'La clase no pertenece a tu cuenta.',1;
        IF @Disponible=1
        BEGIN
            IF EXISTS(SELECT 1 FROM dbo.CLASE c LEFT JOIN dbo.DEPORTE d WITH(UPDLOCK,HOLDLOCK) ON d.ID_DEPORTE=c.ID_DEPORTE
                WHERE c.ID_CLASE=@IdClase AND (d.ACTIVO IS NULL OR d.ACTIVO=0 OR c.PRECIO IS NULL OR c.PRECIO<0
                    OR c.CUPO_MAXIMO IS NULL OR c.CUPO_MAXIMO<1 OR NULLIF(LTRIM(RTRIM(c.NOMBRE_CLASE)),'') IS NULL
                    OR NULLIF(LTRIM(RTRIM(c.DESCRIPCION)),'') IS NULL))
                THROW 51000,'Completa los datos de la clase y selecciona un deporte activo.',1;
            IF NOT EXISTS(SELECT 1 FROM dbo.HORARIO WHERE ID_CLASE=@IdClase AND ACTIVO=1)
                THROW 51000,'Agrega horarios a la clase antes de publicarla.',1;
            IF EXISTS(SELECT 1 FROM dbo.HORARIO h JOIN dbo.CLASE c ON c.ID_CLASE=h.ID_CLASE
                LEFT JOIN dbo.CANCHA ca WITH(UPDLOCK,HOLDLOCK) ON ca.ID_CANCHA=h.ID_CANCHA
                WHERE h.ID_CLASE=@IdClase AND h.ACTIVO=1 AND (ca.ID_CANCHA IS NULL OR ca.ACTIVO=0 OR ca.ID_DEPORTE<>c.ID_DEPORTE
                    OR h.DIA_ISO IS NULL OR h.DIA_ISO NOT BETWEEN 1 AND 7 OR h.HORA_INICIO IS NULL OR h.HORA_FIN IS NULL OR h.HORA_INICIO>=h.HORA_FIN
                    OR NOT EXISTS(SELECT 1 FROM dbo.CANCHA_APERTURA a WHERE a.ID_CANCHA=h.ID_CANCHA AND a.DIA_ISO=h.DIA_ISO
                        AND a.HORA_INICIO<=h.HORA_INICIO AND a.HORA_FIN>=h.HORA_FIN)))
                THROW 51009,'Edita la clase para asignar una cancha activa y horarios dentro de su apertura.',1;
            IF EXISTS(SELECT 1 FROM dbo.HORARIO a JOIN dbo.HORARIO b ON a.ID_HORARIO<b.ID_HORARIO AND a.ID_CLASE=b.ID_CLASE
                AND a.DIA_ISO=b.DIA_ISO AND a.HORA_INICIO<b.HORA_FIN AND a.HORA_FIN>b.HORA_INICIO
                WHERE a.ID_CLASE=@IdClase AND a.ACTIVO=1 AND b.ACTIVO=1) THROW 51009,'Los horarios de esta clase se cruzan.',1;
            IF EXISTS(SELECT 1 FROM dbo.HORARIO propio JOIN dbo.HORARIO otro ON propio.DIA_ISO=otro.DIA_ISO
                AND propio.HORA_INICIO<otro.HORA_FIN AND propio.HORA_FIN>otro.HORA_INICIO
                JOIN dbo.CLASE c ON c.ID_CLASE=otro.ID_CLASE
                WHERE propio.ID_CLASE=@IdClase AND propio.ACTIVO=1 AND otro.ACTIVO=1 AND c.ID_CLASE<>@IdClase AND c.DISPONIBLE=1
                  AND (otro.ID_CANCHA=propio.ID_CANCHA OR c.ID_ENTRENADOR=@IdEntrenador))
                THROW 51009,'La cancha o el profesor ya tienen una clase en ese horario.',1;
            IF (SELECT CUPO_MAXIMO FROM dbo.CLASE WHERE ID_CLASE=@IdClase)<(SELECT COUNT(DISTINCT ID_USUARIO) FROM dbo.RESERVA
                WHERE ID_CLASE=@IdClase AND UPPER(LTRIM(RTRIM(ESTATUS_RESERVA))) IN ('ACTIVA','ACTIVO','CONFIRMADA','CONFIRMADO','PAGADA','PAGADO','PENDIENTE'))
                THROW 51009,'La capacidad es menor a los alumnos inscritos.',1;
        END;
        UPDATE dbo.CLASE SET DISPONIBLE=@Disponible,FECHA_ULTIMA_MODIFICACION=GETUTCDATE() WHERE ID_CLASE=@IdClase;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF XACT_STATE()<>0 ROLLBACK;
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
        SELECT c.ID_CLASE,c.ID_DEPORTE,d.NOMBRE_DEPORTE,CONVERT(bit,ISNULL(d.ACTIVO,0)) AS DEPORTE_ACTIVO,
            c.NOMBRE_CLASE,c.DESCRIPCION,c.PRECIO,c.CUPO_MAXIMO,c.DISPONIBLE,c.UBICACION,
            LTRIM(RTRIM(CONCAT(u.NOMBRE,' ',u.APELLIDO_PATERNO,' ',u.APELLIDO_MATERNO))) AS ENTRENADOR_NOMBRE,
            CONVERT(bit,CASE WHEN DATALENGTH(u.FOTO)>0 THEN 1 ELSE 0 END) AS TIENE_FOTO,
            (SELECT COUNT(DISTINCT rv.ID_USUARIO) FROM dbo.RESERVA rv WHERE rv.ID_CLASE=c.ID_CLASE
             AND UPPER(LTRIM(RTRIM(rv.ESTATUS_RESERVA))) IN ('ACTIVA','ACTIVO','CONFIRMADA','CONFIRMADO','PAGADA','PAGADO','PENDIENTE')) AS ALUMNOS_INSCRITOS,
            cancha.ID_CANCHA,cancha.NOMBRE_CANCHA
        INTO #Clases
        FROM dbo.CLASE c JOIN dbo.USUARIO u ON u.ID_USUARIO=c.ID_ENTRENADOR JOIN dbo.ROL r ON r.ID_ROL=u.ID_ROL
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
        LTRIM(RTRIM(CONCAT(u.NOMBRE,' ',u.APELLIDO_PATERNO,' ',u.APELLIDO_MATERNO))) AS ENTRENADOR_NOMBRE,
        c.ID_DEPORTE,d.NOMBRE_DEPORTE,h.ID_CANCHA,ca.NOMBRE AS NOMBRE_CANCHA,COALESCE(ca.UBICACION,c.UBICACION) AS UBICACION,
        h.DIA_ISO,h.HORA_INICIO,h.HORA_FIN,c.DISPONIBLE,
        CONVERT(bit,CASE WHEN c.DISPONIBLE=1 AND ca.ACTIVO=1 THEN 1 ELSE 0 END) AS OCUPA_CANCHA
    FROM dbo.HORARIO h JOIN dbo.CLASE c ON c.ID_CLASE=h.ID_CLASE JOIN dbo.USUARIO u ON u.ID_USUARIO=c.ID_ENTRENADOR
    LEFT JOIN dbo.DEPORTE d ON d.ID_DEPORTE=c.ID_DEPORTE LEFT JOIN dbo.CANCHA ca ON ca.ID_CANCHA=h.ID_CANCHA
    WHERE h.ACTIVO=1 AND h.DIA_ISO BETWEEN 1 AND 7 AND h.HORA_INICIO<h.HORA_FIN
      AND (@IdEntrenador IS NULL OR c.ID_ENTRENADOR=@IdEntrenador) AND (@IdCancha IS NULL OR h.ID_CANCHA=@IdCancha)
      AND (@IdDeporte IS NULL OR c.ID_DEPORTE=@IdDeporte) AND (@IncluirNoDisponibles=1 OR c.DISPONIBLE=1)
    ORDER BY h.DIA_ISO,h.HORA_INICIO,ca.NOMBRE,c.NOMBRE_CLASE;
END;
GO
-- Los usuarios registrados desde la web también reciben un identificador QR.
-- El DEFAULT cubre las inserciones que omiten la columna CODIGO_QR.
IF NOT EXISTS(SELECT 1 FROM sys.default_constraints dc JOIN sys.columns co ON co.object_id=dc.parent_object_id AND co.column_id=dc.parent_column_id
              WHERE dc.parent_object_id=OBJECT_ID('dbo.USUARIO') AND co.name='CODIGO_QR')
    ALTER TABLE dbo.USUARIO ADD CONSTRAINT DF_USUARIO_QR DEFAULT ('ADS:' + REPLACE(CONVERT(varchar(36),NEWID()),'-','')) FOR CODIGO_QR;
GO

-- Registro público: conserva la verificación de correo y genera el QR en la misma transacción.
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
        WHERE UPPER(LTRIM(RTRIM(NOMBRE_ROL))) = 'USUARIO'
        ORDER BY ID_ROL;

        -- Validar que exista el rol USUARIO
        IF @ID_ROL IS NULL
        BEGIN
            ROLLBACK TRANSACTION;

            SELECT
                404 AS CODIGO_RESPUESTA,
                'No se encontró el rol USUARIO.' AS MENSAJE,
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
