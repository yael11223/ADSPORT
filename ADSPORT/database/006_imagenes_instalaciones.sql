-- Ejecutar después de 005_usuarios_canchas_cronograma.sql.
-- Agrega una fotografía por cancha. Puede ejecutarse nuevamente sin perder imágenes.
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
IF OBJECT_ID('dbo.CANCHA','U') IS NULL
    THROW 51000,'Primero ejecuta 005_usuarios_canchas_cronograma.sql en esta base.',1;
GO
IF COL_LENGTH('dbo.CANCHA','IMAGEN') IS NULL
    ALTER TABLE dbo.CANCHA ADD IMAGEN varbinary(max) NULL;
IF COL_LENGTH('dbo.CANCHA','IMAGEN_TIPO') IS NULL
    ALTER TABLE dbo.CANCHA ADD IMAGEN_TIPO varchar(50) NULL;
GO
CREATE OR ALTER PROCEDURE dbo.CANCHA_LISTAR @IncluirInactivas bit=0
AS
BEGIN
    SET NOCOUNT ON;
    SELECT ca.ID_CANCHA,ca.ID_DEPORTE,ca.NOMBRE,ca.UBICACION,ca.ACTIVO,d.NOMBRE_DEPORTE,d.ACTIVO AS DEPORTE_ACTIVO,
        CONVERT(bit,CASE WHEN DATALENGTH(ca.IMAGEN)>0 THEN 1 ELSE 0 END) AS TIENE_IMAGEN,ca.FECHA_MODIFICACION
    FROM dbo.CANCHA ca JOIN dbo.DEPORTE d ON d.ID_DEPORTE=ca.ID_DEPORTE
    WHERE @IncluirInactivas=1 OR ca.ACTIVO=1 AND d.ACTIVO=1 ORDER BY ca.NOMBRE;
    SELECT a.ID_CANCHA,a.DIA_ISO,a.HORA_INICIO,a.HORA_FIN FROM dbo.CANCHA_APERTURA a
    JOIN dbo.CANCHA ca ON ca.ID_CANCHA=a.ID_CANCHA JOIN dbo.DEPORTE d ON d.ID_DEPORTE=ca.ID_DEPORTE
    WHERE @IncluirInactivas=1 OR ca.ACTIVO=1 AND d.ACTIVO=1 ORDER BY a.ID_CANCHA,a.DIA_ISO,a.HORA_INICIO;
END;
GO
CREATE OR ALTER PROCEDURE dbo.CANCHA_IMAGEN_GUARDAR
    @IdCancha bigint,@Imagen varbinary(max),@Tipo varchar(50),
    @numeroError int=0 OUTPUT,@respuesta varchar(1000)=NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET @numeroError=0; SET @respuesta='Imagen de la cancha guardada.';
    BEGIN TRY
        IF @Imagen IS NULL OR DATALENGTH(@Imagen)=0 OR DATALENGTH(@Imagen)>5242880
            THROW 51000,'La imagen debe tener contenido y no superar 5 MB.',1;
        IF @Tipo IS NULL OR @Tipo NOT IN ('image/jpeg','image/png','image/webp')
            THROW 51000,'Elige una imagen JPEG, PNG o WebP.',1;
        UPDATE dbo.CANCHA SET IMAGEN=@Imagen,IMAGEN_TIPO=@Tipo,FECHA_MODIFICACION=SYSUTCDATETIME() WHERE ID_CANCHA=@IdCancha;
        IF @@ROWCOUNT=0 THROW 51004,'La cancha no existe.',1;
    END TRY
    BEGIN CATCH
        SET @numeroError=ERROR_NUMBER(); SET @respuesta=ERROR_MESSAGE();
    END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.CANCHA_IMAGEN_OBTENER
    @IdCancha bigint,@IncluirInactivas bit=0,@numeroError int=0 OUTPUT,@respuesta varchar(1000)=NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET @numeroError=0; SET @respuesta='Imagen consultada.';
    BEGIN TRY
        SELECT ca.IMAGEN,ca.IMAGEN_TIPO FROM dbo.CANCHA ca JOIN dbo.DEPORTE d ON d.ID_DEPORTE=ca.ID_DEPORTE
        WHERE ca.ID_CANCHA=@IdCancha AND DATALENGTH(ca.IMAGEN)>0 AND (@IncluirInactivas=1 OR ca.ACTIVO=1 AND d.ACTIVO=1);
        IF @@ROWCOUNT=0 THROW 51004,'La instalación o su fotografía no están disponibles.',1;
    END TRY
    BEGIN CATCH
        SET @numeroError=ERROR_NUMBER(); SET @respuesta=ERROR_MESSAGE();
    END CATCH;
END;
GO
