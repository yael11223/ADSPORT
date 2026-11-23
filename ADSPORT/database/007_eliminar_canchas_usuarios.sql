-- Ejecutar después de 005 y 006. Elimina físicamente canchas y usuarios.
-- Las clases afectadas se despublican. Se conservan clases, reservas, pagos y accesos,
-- desvinculando únicamente las referencias al registro eliminado.
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
CREATE OR ALTER PROCEDURE dbo.CANCHA_ELIMINAR
    @IdCancha bigint,@numeroError int=0 OUTPUT,@respuesta varchar(1000)=NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    SET @numeroError=0; SET @respuesta='Cancha eliminada definitivamente.';
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @Lock int;
        EXEC @Lock=sys.sp_getapplock @Resource=N'ADSPORT_AGENDA',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
        IF @Lock<0 THROW 51009,'La agenda se está actualizando. Intenta nuevamente.',1;
        IF NOT EXISTS(SELECT 1 FROM dbo.CANCHA WITH(UPDLOCK,HOLDLOCK) WHERE ID_CANCHA=@IdCancha)
            THROW 51004,'La cancha no existe.',1;

        -- Solo se despublican clases que todavía utilizan esta cancha.
        -- Una asignación histórica no modifica clases ya trasladadas a otra instalación.
        UPDATE c SET DISPONIBLE=0,UBICACION=NULL,FECHA_ULTIMA_MODIFICACION=GETUTCDATE()
        FROM dbo.CLASE c WHERE EXISTS(SELECT 1 FROM dbo.HORARIO h
            WHERE h.ID_CLASE=c.ID_CLASE AND h.ID_CANCHA=@IdCancha AND h.ACTIVO=1);
        UPDATE dbo.HORARIO SET ID_CANCHA=NULL,CANCHA=NULL,FECHA_ULTIMA_MODIFICACION=GETUTCDATE()
            WHERE ID_CANCHA=@IdCancha;
        DELETE dbo.CANCHA_APERTURA WHERE ID_CANCHA=@IdCancha;
        DELETE dbo.CANCHA WHERE ID_CANCHA=@IdCancha;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF XACT_STATE()<>0 ROLLBACK;
        SET @numeroError=ERROR_NUMBER(); SET @respuesta=ERROR_MESSAGE();
    END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.USUARIO_BORRAR
    @id_usuario bigint,@numeroError int=0 OUTPUT,@respuesta varchar(1000)=NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    SET @numeroError=0; SET @respuesta='Usuario eliminado definitivamente.';
    BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @Lock int,@Correo varchar(100);
        EXEC @Lock=sys.sp_getapplock @Resource=N'ADSPORT_AGENDA',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
        IF @Lock<0 THROW 51009,'La agenda se está actualizando. Intenta nuevamente.',1;
        IF NOT EXISTS(SELECT 1 FROM dbo.USUARIO WITH(UPDLOCK,HOLDLOCK) WHERE ID_USUARIO=@id_usuario)
            THROW 51004,'El usuario no existe.',1;
        SELECT @Correo=CORREO FROM dbo.USUARIO WHERE ID_USUARIO=@id_usuario;

        UPDATE dbo.CLASE SET ID_ENTRENADOR=NULL,DISPONIBLE=0,FECHA_ULTIMA_MODIFICACION=GETUTCDATE()
            WHERE ID_ENTRENADOR=@id_usuario;
        UPDATE dbo.RESERVA SET ID_USUARIO=NULL,FECHA_UTIMA_MODIFICACION=GETUTCDATE()
            WHERE ID_USUARIO=@id_usuario;
        UPDATE dbo.REGISTRO_ACCESO SET ID_STAFF=NULL,FECHA_ULTIMA_MODIFICACION=GETUTCDATE()
            WHERE ID_STAFF=@id_usuario;
        DELETE dbo.CODIGO_VERIFICACION WHERE ID_USUARIO=@id_usuario
            OR LOWER(LTRIM(RTRIM(CORREO)))=LOWER(LTRIM(RTRIM(@Correo)));
        UPDATE dbo.USUARIO SET ID_PASSWORD=NULL WHERE ID_USUARIO=@id_usuario;
        DELETE dbo.[PASSWORD] WHERE ID_USUARIO=@id_usuario;
        DELETE dbo.USUARIO WHERE ID_USUARIO=@id_usuario;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF XACT_STATE()<>0 ROLLBACK;
        SET @numeroError=ERROR_NUMBER(); SET @respuesta=ERROR_MESSAGE();
    END CATCH;
END;
GO
