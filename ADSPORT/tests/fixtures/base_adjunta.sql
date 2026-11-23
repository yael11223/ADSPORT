-- Copia del esquema adjunto, sin las propiedades descriptivas. Solo para una base VACIA de pruebas.
/****** Object:  Table [dbo].[CLASE]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CLASE](
	[ID_CLASE] [bigint] IDENTITY(1,1) NOT NULL,
	[ID_DEPORTE] [bigint] NULL,
	[ID_ENTRENADOR] [bigint] NULL,
	[NOMBRE_CLASE] [varchar](100) NULL,
	[PRECIO] [decimal](10, 2) NULL,
	[CUPO_MAXIMO] [int] NULL,
	[FECHA_ULTIMA_MODIFICACION] [datetime] NULL,
	[DESCRIPCION] [nvarchar](2000) NULL,
	[DISPONIBLE] [bit] NOT NULL,
	[UBICACION] [nvarchar](100) NULL,
 CONSTRAINT [PK_CLASE] PRIMARY KEY CLUSTERED 
(
	[ID_CLASE] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[CODIGO_VERIFICACION]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[CODIGO_VERIFICACION](
	[ID_CODIGO] [bigint] IDENTITY(1,1) NOT NULL,
	[ID_USUARIO] [bigint] NULL,
	[CODIGO_HASH] [varchar](255) NOT NULL,
	[FECHA_CREACION] [datetime] NOT NULL,
	[FECHA_EXPIRACION] [datetime] NOT NULL,
	[UTILIZADO] [bit] NOT NULL,
	[INTENTOS] [int] NOT NULL,
	[FECHA_UTIMA_MODIFICACION] [datetime] NOT NULL,
	[CORREO] [varchar](150) NOT NULL,
	[VERIFICADO] [bit] NOT NULL,
 CONSTRAINT [PK_CODIGO_VERIFICACION] PRIMARY KEY CLUSTERED 
(
	[ID_CODIGO] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[DEPORTE]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[DEPORTE](
	[ID_DEPORTE] [bigint] IDENTITY(1,1) NOT NULL,
	[NOMBRE_DEPORTE] [nvarchar](50) NULL,
	[DESCRIPCION] [nvarchar](2000) NULL,
	[FECHA_UTIMA_MODIFICACION] [datetime] NULL,
	[ACTIVO] [bit] NOT NULL,
	[IMAGEN] [varbinary](max) NULL,
	[IMAGEN_TIPO] [varchar](50) NULL,
 CONSTRAINT [PK_DEPORTE] PRIMARY KEY CLUSTERED 
(
	[ID_DEPORTE] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
/****** Object:  Table [dbo].[HORARIO]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[HORARIO](
	[ID_HORARIO] [bigint] IDENTITY(1,1) NOT NULL,
	[ID_CLASE] [bigint] NULL,
	[DIA_SEMANA] [datetime] NULL,
	[HORA_INICIO] [time](7) NULL,
	[HORA_FIN] [time](7) NULL,
	[CANCHA] [varchar](100) NULL,
	[FECHA_ULTIMA_MODIFICACION] [datetime] NULL,
	[DIA_ISO] [tinyint] NULL,
	[ACTIVO] [bit] NOT NULL,
 CONSTRAINT [PK_HORARIO] PRIMARY KEY CLUSTERED 
(
	[ID_HORARIO] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PAGO]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PAGO](
	[ID_PAGO] [bigint] IDENTITY(1,1) NOT NULL,
	[ID_RESERVA] [bigint] NULL,
	[SUBTOTAL] [decimal](10, 2) NULL,
	[IVA] [decimal](10, 2) NULL,
	[MONTO_TOTAL] [decimal](10, 2) NULL,
	[FECHA_PAGO] [date] NULL,
	[METODO_PAGO] [varchar](50) NULL,
	[FECHA_UTIMA_MODIFICACION] [datetime] NULL,
 CONSTRAINT [PK_PAGO] PRIMARY KEY CLUSTERED 
(
	[ID_PAGO] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[PASSWORD]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[PASSWORD](
	[ID_PASSWORD] [bigint] IDENTITY(1,1) NOT NULL,
	[ID_USUARIO] [bigint] NOT NULL,
	[PASSWORD] [varchar](60) NOT NULL,
 CONSTRAINT [PK_PASSWORD] PRIMARY KEY CLUSTERED 
(
	[ID_PASSWORD] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[REGISTRO_ACCESO]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[REGISTRO_ACCESO](
	[ID_REGISTRO] [bigint] IDENTITY(1,1) NOT NULL,
	[ID_PASE] [bigint] NULL,
	[ID_STAFF] [bigint] NULL,
	[FECHA_ESCANEO] [date] NULL,
	[FECHA_ULTIMA_MODIFICACION] [datetime] NULL,
 CONSTRAINT [PK_REGISTRO_ACCESO] PRIMARY KEY CLUSTERED 
(
	[ID_REGISTRO] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[RESERVA]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[RESERVA](
	[ID_RESERVA] [bigint] IDENTITY(1,1) NOT NULL,
	[ID_USUARIO] [bigint] NULL,
	[ID_CLASE] [bigint] NULL,
	[FECHA_RESERVA] [date] NULL,
	[ESTATUS_RESERVA] [varchar](50) NULL,
	[FECHA_UTIMA_MODIFICACION] [datetime] NULL,
 CONSTRAINT [PK_RESERVA] PRIMARY KEY CLUSTERED 
(
	[ID_RESERVA] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[ROL]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[ROL](
	[ID_ROL] [bigint] IDENTITY(1,1) NOT NULL,
	[NOMBRE_ROL] [varchar](100) NULL,
	[FECHA_UTIMA_MODIFICACION] [datetime] NULL,
 CONSTRAINT [PK_ROL] PRIMARY KEY CLUSTERED 
(
	[ID_ROL] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO
/****** Object:  Table [dbo].[USUARIO]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[USUARIO](
	[ID_USUARIO] [bigint] IDENTITY(1,1) NOT NULL,
	[ID_ROL] [bigint] NOT NULL,
	[NOMBRE] [varchar](100) NOT NULL,
	[APELLIDO_PATERNO] [varchar](100) NULL,
	[APELLIDO_MATERNO] [varchar](100) NULL,
	[CORREO] [varchar](100) NOT NULL,
	[TELEFONO] [varchar](100) NULL,
	[ESTATUS] [varchar](50) NOT NULL,
	[CODIGO_QR] [varchar](10) NULL,
	[FECHA__ULTIMA_MODIFICACION] [datetime] NOT NULL,
	[ID_PASSWORD] [bigint] NULL,
	[FOTO] [varbinary](max) NULL,
 CONSTRAINT [PK_USUARIO] PRIMARY KEY CLUSTERED 
(
	[ID_USUARIO] ASC
)WITH (STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO
ALTER TABLE [dbo].[CLASE] ADD  CONSTRAINT [DF_CLASE_DISPONIBLE]  DEFAULT ((0)) FOR [DISPONIBLE]
GO
ALTER TABLE [dbo].[CODIGO_VERIFICACION] ADD  CONSTRAINT [DF_CODIGO_VERIFICACION_VERIFICADO]  DEFAULT ((0)) FOR [VERIFICADO]
GO
ALTER TABLE [dbo].[DEPORTE] ADD  CONSTRAINT [DF_DEPORTE_ACTIVO]  DEFAULT ((1)) FOR [ACTIVO]
GO
ALTER TABLE [dbo].[HORARIO] ADD  CONSTRAINT [DF_HORARIO_ACTIVO]  DEFAULT ((1)) FOR [ACTIVO]
GO
ALTER TABLE [dbo].[CLASE]  WITH CHECK ADD  CONSTRAINT [FK_CLASE_DEPORTE] FOREIGN KEY([ID_DEPORTE])
REFERENCES [dbo].[DEPORTE] ([ID_DEPORTE])
GO
ALTER TABLE [dbo].[CLASE] CHECK CONSTRAINT [FK_CLASE_DEPORTE]
GO
ALTER TABLE [dbo].[CLASE]  WITH CHECK ADD  CONSTRAINT [FK_CLASE_USUARIO] FOREIGN KEY([ID_ENTRENADOR])
REFERENCES [dbo].[USUARIO] ([ID_USUARIO])
GO
ALTER TABLE [dbo].[CLASE] CHECK CONSTRAINT [FK_CLASE_USUARIO]
GO
ALTER TABLE [dbo].[CODIGO_VERIFICACION]  WITH CHECK ADD  CONSTRAINT [FK_CODIGO_VERIFICACION_USUARIO] FOREIGN KEY([ID_USUARIO])
REFERENCES [dbo].[USUARIO] ([ID_USUARIO])
GO
ALTER TABLE [dbo].[CODIGO_VERIFICACION] CHECK CONSTRAINT [FK_CODIGO_VERIFICACION_USUARIO]
GO
ALTER TABLE [dbo].[HORARIO]  WITH CHECK ADD  CONSTRAINT [FK_HORARIO_CLASE] FOREIGN KEY([ID_CLASE])
REFERENCES [dbo].[CLASE] ([ID_CLASE])
GO
ALTER TABLE [dbo].[HORARIO] CHECK CONSTRAINT [FK_HORARIO_CLASE]
GO
ALTER TABLE [dbo].[PAGO]  WITH CHECK ADD  CONSTRAINT [FK_PAGO_RESERVA] FOREIGN KEY([ID_RESERVA])
REFERENCES [dbo].[RESERVA] ([ID_RESERVA])
GO
ALTER TABLE [dbo].[PAGO] CHECK CONSTRAINT [FK_PAGO_RESERVA]
GO
ALTER TABLE [dbo].[REGISTRO_ACCESO]  WITH CHECK ADD  CONSTRAINT [FK_REGISTRO_ACCESO_CLASE] FOREIGN KEY([ID_PASE])
REFERENCES [dbo].[CLASE] ([ID_CLASE])
GO
ALTER TABLE [dbo].[REGISTRO_ACCESO] CHECK CONSTRAINT [FK_REGISTRO_ACCESO_CLASE]
GO
ALTER TABLE [dbo].[REGISTRO_ACCESO]  WITH CHECK ADD  CONSTRAINT [FK_REGISTRO_ACCESO_USUARIO] FOREIGN KEY([ID_STAFF])
REFERENCES [dbo].[USUARIO] ([ID_USUARIO])
GO
ALTER TABLE [dbo].[REGISTRO_ACCESO] CHECK CONSTRAINT [FK_REGISTRO_ACCESO_USUARIO]
GO
ALTER TABLE [dbo].[RESERVA]  WITH CHECK ADD  CONSTRAINT [FK_RESERVA_CLASE] FOREIGN KEY([ID_CLASE])
REFERENCES [dbo].[CLASE] ([ID_CLASE])
GO
ALTER TABLE [dbo].[RESERVA] CHECK CONSTRAINT [FK_RESERVA_CLASE]
GO
ALTER TABLE [dbo].[RESERVA]  WITH CHECK ADD  CONSTRAINT [FK_RESERVA_USUARIO] FOREIGN KEY([ID_USUARIO])
REFERENCES [dbo].[USUARIO] ([ID_USUARIO])
GO
ALTER TABLE [dbo].[RESERVA] CHECK CONSTRAINT [FK_RESERVA_USUARIO]
GO
ALTER TABLE [dbo].[CLASE]  WITH NOCHECK ADD  CONSTRAINT [CK_CLASE_CUPO_POSITIVO] CHECK  (([CUPO_MAXIMO] IS NULL OR [CUPO_MAXIMO]>(0)))
GO
ALTER TABLE [dbo].[CLASE] CHECK CONSTRAINT [CK_CLASE_CUPO_POSITIVO]
GO
ALTER TABLE [dbo].[CLASE]  WITH NOCHECK ADD  CONSTRAINT [CK_CLASE_PRECIO_NO_NEGATIVO] CHECK  (([PRECIO] IS NULL OR [PRECIO]>=(0)))
GO
ALTER TABLE [dbo].[CLASE] CHECK CONSTRAINT [CK_CLASE_PRECIO_NO_NEGATIVO]
GO
ALTER TABLE [dbo].[HORARIO]  WITH NOCHECK ADD  CONSTRAINT [CK_HORARIO_DIA_ISO] CHECK  (([DIA_ISO] IS NULL OR [DIA_ISO]>=(1) AND [DIA_ISO]<=(7)))
GO
ALTER TABLE [dbo].[HORARIO] CHECK CONSTRAINT [CK_HORARIO_DIA_ISO]
GO
/****** Object:  StoredProcedure [dbo].[CLASE_AGREGA]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- =============================================
-- Author:		Elienay Cantera
-- Create date: 13 de noviembre
-- Description:	Elimina una clase y sus horarios asociados.
-- =============================================
CREATE   PROCEDURE [dbo].[CLASE_AGREGA]
    @id_deporte BIGINT,
    @id_entrenador BIGINT,
    @nombre_clase VARCHAR(100),
    @precio DECIMAL(10, 2),
    @cupo_maximo INT,
    @dia_semana DATETIME,
    @hora_inicio TIME,
    @hora_fin TIME,
    @cancha VARCHAR(100),
    @numeroError INT OUTPUT,
    @respuesta VARCHAR(1000) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        INSERT INTO dbo.CLASE (
            ID_DEPORTE, ID_ENTRENADOR, NOMBRE_CLASE, PRECIO, CUPO_MAXIMO, FECHA_ULTIMA_MODIFICACION
        )
        VALUES (
            @id_deporte, @id_entrenador, @nombre_clase, @precio, @cupo_maximo, GETDATE()
        );

        DECLARE @nuevoIdClase BIGINT = SCOPE_IDENTITY();

        INSERT INTO dbo.HORARIO (
            ID_CLASE, DIA_SEMANA, HORA_INICIO, HORA_FIN, CANCHA, FECHA_ULTIMA_MODIFICACION
        )
        VALUES (
            @nuevoIdClase, @dia_semana, @hora_inicio, @hora_fin, @cancha, GETDATE()
        );

        COMMIT TRANSACTION;
        SET @numeroError = 0;
        SET @respuesta = 'Clase y horario registrados correctamente.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SET @numeroError = ERROR_NUMBER();
        SET @respuesta = ERROR_MESSAGE();
    END CATCH
END
GO
/****** Object:  StoredProcedure [dbo].[CLASE_ELIMINA]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- =============================================
-- Author:		Elienay Cantera
-- Create date: 13 de noviembre
-- Description:	Elimina una clase y sus horarios asociados.
-- =============================================
CREATE   PROCEDURE [dbo].[CLASE_ELIMINA]
    @id_clase BIGINT,
    @numeroError INT OUTPUT,
    @respuesta VARCHAR(1000) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        DELETE FROM dbo.HORARIO WHERE ID_CLASE = @id_clase;
        DELETE FROM dbo.CLASE WHERE ID_CLASE = @id_clase;

        COMMIT TRANSACTION;
        SET @numeroError = 0;
        SET @respuesta = 'Clase eliminada correctamente.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        SET @numeroError = ERROR_NUMBER();
        SET @respuesta = ERROR_MESSAGE();
    END CATCH
END
GO
/****** Object:  StoredProcedure [dbo].[CLASE_FOTO_PUBLICA]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   PROCEDURE [dbo].[CLASE_FOTO_PUBLICA]
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
/****** Object:  StoredProcedure [dbo].[CLASE_LISTA_POR_DEPORTE]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- =============================================
-- Author:		Elienay Cantera
-- Create date: 13 de noviembre
-- Description:	Lista todas las clases
-- =============================================
CREATE   PROCEDURE [dbo].[CLASE_LISTA_POR_DEPORTE]
    @id_deporte BIGINT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        C.ID_CLASE,
        C.ID_DEPORTE,
        D.NOMBRE_DEPORTE,
        C.ID_ENTRENADOR,
        LTRIM(RTRIM(
            ISNULL(U.NOMBRE, '') + ' ' + 
            ISNULL(U.APELLIDO_PATERNO, '') + ' ' + 
            ISNULL(U.APELLIDO_MATERNO, '')
        )) AS NOMBRE_ENTRENADOR,
        U.CORREO AS CORREO_ENTRENADOR,
        CASE WHEN U.FOTO IS NOT NULL THEN 1 ELSE 0 END AS TIENE_FOTO,
        C.NOMBRE_CLASE,
        C.PRECIO,
        C.CUPO_MAXIMO,
        H.ID_HORARIO,
        H.DIA_SEMANA,
        CONVERT(VARCHAR(5), H.HORA_INICIO, 108) AS HORA_INICIO,
        CONVERT(VARCHAR(5), H.HORA_FIN, 108) AS HORA_FIN,
        H.CANCHA
    FROM dbo.CLASE C
    INNER JOIN dbo.DEPORTE D ON C.ID_DEPORTE = D.ID_DEPORTE
    INNER JOIN dbo.USUARIO U ON C.ID_ENTRENADOR = U.ID_USUARIO
    LEFT JOIN dbo.HORARIO H ON C.ID_CLASE = H.ID_CLASE
    WHERE C.ID_DEPORTE = @id_deporte
    ORDER BY C.ID_CLASE, H.DIA_SEMANA, H.HORA_INICIO;
END
GO
/****** Object:  StoredProcedure [dbo].[CLASE_LISTA_POR_ENTRENADOR]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- =============================================
-- Author:		Elienay Cantera
-- Create date: 13 de noviembre
-- Description:	Consulta las clases y horarios creados por un entrenador específico
-- =============================================
CREATE   PROCEDURE [dbo].[CLASE_LISTA_POR_ENTRENADOR]
    @id_entrenador BIGINT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        C.ID_CLASE,
        C.ID_DEPORTE,
        D.NOMBRE_DEPORTE,
        C.NOMBRE_CLASE,
        C.PRECIO,
        C.CUPO_MAXIMO,
        H.ID_HORARIO,
        H.DIA_SEMANA,
        CONVERT(VARCHAR(5), H.HORA_INICIO, 108) AS HORA_INICIO,
        CONVERT(VARCHAR(5), H.HORA_FIN, 108) AS HORA_FIN,
        H.CANCHA
    FROM dbo.CLASE C
    INNER JOIN dbo.DEPORTE D ON C.ID_DEPORTE = D.ID_DEPORTE
    LEFT JOIN dbo.HORARIO H ON C.ID_CLASE = H.ID_CLASE
    WHERE C.ID_ENTRENADOR = @id_entrenador
    ORDER BY C.ID_CLASE DESC;
END
GO
/****** Object:  StoredProcedure [dbo].[CODIGO_VERIFICACION_AGREGAR]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
/*
============================================================
 Nombre: CODIGO_VERIFICACION_AGREGAR
 Autor: Yael Aldemar Lila Lara
 Fecha de creación: 03/11/2026

 Descripción:
 Registra un nuevo código de verificación asociado a un
 correo electrónico para la creación de cuentas en ADSPORT.

 Valida los parámetros recibidos, comprueba que el correo
 no esté registrado, invalida códigos anteriores y guarda
 el nuevo código con una vigencia de 10 minutos.

 Devuelve códigos de respuesta para que la API pueda
 identificar el resultado de la operación.
============================================================
*/

CREATE   PROCEDURE [dbo].[CODIGO_VERIFICACION_AGREGAR]
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
/****** Object:  StoredProcedure [dbo].[CODIGO_VERIFICACION_REENVIAR]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
/*
============================================================
 Nombre: CODIGO_VERIFICACION_REENVIAR
 Autor: Yael Aldemar Lila Lara
 Fecha de creación: 03/11/2026

 Descripción:
 Comprueba si un correo electrónico puede solicitar
 un nuevo código de verificación para ADSPORT.

 Valida el correo, comprueba si ya existe una cuenta
 registrada y verifica que hayan transcurrido al menos
 60 segundos desde la última solicitud.

 Devuelve códigos de respuesta para que la API
 identifique el resultado de la operación.
============================================================
*/

CREATE   PROCEDURE [dbo].[CODIGO_VERIFICACION_REENVIAR]
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
        WHERE CORREO = @CORREO;

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
/****** Object:  StoredProcedure [dbo].[CODIGO_VERIFICACION_VALIDAR]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
/*
============================================================
 Nombre: CODIGO_VERIFICACION_VALIDAR
 Autor: Yael Aldemar Lila Lara
 Fecha de creación: 03/11/2026

 Descripción:
 Valida el código de verificación asociado a un correo
 electrónico durante el registro de usuarios en ADSPORT.

 Comprueba la existencia del código, su fecha de expiración,
 el número de intentos y la coincidencia del hash recibido.

 Si el código es correcto, marca el registro como utilizado
 y verificado.

 Devuelve códigos de respuesta para identificar el
 resultado de la operación desde la API.
============================================================
*/

CREATE   PROCEDURE [dbo].[CODIGO_VERIFICACION_VALIDAR]
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
/****** Object:  StoredProcedure [dbo].[DEPORTE_ACTUALIZA]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- =============================================
-- Author:		Elienay Cantera
-- Create date: 13 de noviembre
-- Description:	Actualiza el nombre y descripción de un deporte existente
--                          
-- =============================================

CREATE   PROCEDURE [dbo].[DEPORTE_ACTUALIZA]
    @id_deporte BIGINT,
    @nombre_deporte VARCHAR(50),
    @descripcion VARCHAR(100),
    @numeroError INT OUTPUT,
    @respuesta VARCHAR(1000) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        -- Validar existencia del deporte
        IF NOT EXISTS (
            SELECT 1 
            FROM [dbo].[DEPORTE] 
            WHERE ID_DEPORTE = @id_deporte
        )
        BEGIN
            SET @numeroError = 1;
            SET @respuesta = 'El deporte especificado no existe.';
            RETURN;
        END;

        -- Validar campo obligatorio
        IF NULLIF(LTRIM(RTRIM(@nombre_deporte)), '') IS NULL
        BEGIN
            SET @numeroError = 2;
            SET @respuesta = 'El nombre del deporte es obligatorio.';
            RETURN;
        END;

        -- Validar que el nombre no pertenezca a otro deporte
        IF EXISTS (
            SELECT 1 
            FROM [dbo].[DEPORTE] 
            WHERE UPPER(LTRIM(RTRIM(NOMBRE_DEPORTE))) = UPPER(LTRIM(RTRIM(@nombre_deporte)))
              AND ID_DEPORTE <> @id_deporte
        )
        BEGIN
            SET @numeroError = 3;
            SET @respuesta = 'Ya existe otro deporte con ese nombre.';
            RETURN;
        END;

        -- Actualizar registro
        UPDATE [dbo].[DEPORTE]
        SET 
            NOMBRE_DEPORTE = LTRIM(RTRIM(@nombre_deporte)),
            DESCRIPCION = LTRIM(RTRIM(@descripcion)),
            FECHA_UTIMA_MODIFICACION = GETDATE()
        WHERE ID_DEPORTE = @id_deporte;

        SET @numeroError = 0;
        SET @respuesta = 'Deporte actualizado correctamente.';
    END TRY
    BEGIN CATCH
        SET @numeroError = ERROR_NUMBER();
        SET @respuesta = ERROR_MESSAGE();
    END CATCH
END;
GO
/****** Object:  StoredProcedure [dbo].[DEPORTE_AGREGAR]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- =============================================
-- Author:		Elienay Cantera
-- Create date: 13 de noviembre
-- Description:	Registra un nuevo deporte en el catálogo
--              
-- =============================================
CREATE   PROCEDURE [dbo].[DEPORTE_AGREGAR]
    @nombre_deporte VARCHAR(50),
    @descripcion VARCHAR(100),
    @numeroError INT OUTPUT,
    @respuesta VARCHAR(1000) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        -- Validar campo obligatorio
        IF NULLIF(LTRIM(RTRIM(@nombre_deporte)), '') IS NULL
        BEGIN
            SET @numeroError = 1;
            SET @respuesta = 'El nombre del deporte es obligatorio.';
            RETURN;
        END;

        -- Validar que no esté duplicado
        IF EXISTS (
            SELECT 1 
            FROM [dbo].[DEPORTE] 
            WHERE UPPER(LTRIM(RTRIM(NOMBRE_DEPORTE))) = UPPER(LTRIM(RTRIM(@nombre_deporte)))
        )
        BEGIN
            SET @numeroError = 2;
            SET @respuesta = 'Ese deporte ya se encuentra registrado.';
            RETURN;
        END;

        -- Inserción real en la base de datos
        INSERT INTO [dbo].[DEPORTE]
        (
            NOMBRE_DEPORTE,
            DESCRIPCION,
            FECHA_UTIMA_MODIFICACION
        )
        VALUES
        (
            LTRIM(RTRIM(@nombre_deporte)),
            LTRIM(RTRIM(@descripcion)),
            GETDATE()
        );

        SET @numeroError = 0;
        SET @respuesta = 'Deporte registrado correctamente.';
    END TRY
    BEGIN CATCH
        SET @numeroError = ERROR_NUMBER();
        SET @respuesta = ERROR_MESSAGE();
    END CATCH
END;
GO
/****** Object:  StoredProcedure [dbo].[DEPORTE_BUSCAR_POR_ID]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- =============================================
-- Author:		Elienay Cantera
-- Create date: 13 de noviembre
-- Description:	Consulta un deporte específico
--                          
-- =============================================

CREATE   PROCEDURE [dbo].[DEPORTE_BUSCAR_POR_ID]
    @id_deporte BIGINT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        ID_DEPORTE,
        NOMBRE_DEPORTE,
        DESCRIPCION,
        FECHA_UTIMA_MODIFICACION
    FROM [dbo].[DEPORTE]
    WHERE ID_DEPORTE = @id_deporte;
END;
GO
/****** Object:  StoredProcedure [dbo].[DEPORTE_DESACTIVAR]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   PROCEDURE [dbo].[DEPORTE_DESACTIVAR]
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
/****** Object:  StoredProcedure [dbo].[DEPORTE_ELIMINA]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

-- =============================================
-- Author:		Elienay Cantera
-- Create date: 13 de noviembre
-- Description:	Elimina un deporte de la base
--                          
-- =============================================

CREATE   PROCEDURE [dbo].[DEPORTE_ELIMINA]
    @id_deporte BIGINT,
    @numeroError INT OUTPUT,
    @respuesta VARCHAR(1000) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        -- Validar existencia del deporte
        IF NOT EXISTS (
            SELECT 1 
            FROM [dbo].[DEPORTE] 
            WHERE ID_DEPORTE = @id_deporte
        )
        BEGIN
            SET @numeroError = 1;
            SET @respuesta = 'El deporte especificado no existe.';
            RETURN;
        END;

        -- Validar que no esté siendo usado en la tabla CLASE
        IF EXISTS (
            SELECT 1 
            FROM [dbo].[CLASE] 
            WHERE ID_DEPORTE = @id_deporte
        )
        BEGIN
            SET @numeroError = 2;
            SET @respuesta = 'No se puede eliminar el deporte porque tiene clases registradas.';
            RETURN;
        END;

        -- Eliminar registro
        DELETE FROM [dbo].[DEPORTE]
        WHERE ID_DEPORTE = @id_deporte;

        SET @numeroError = 0;
        SET @respuesta = 'Deporte eliminado correctamente.';
    END TRY
    BEGIN CATCH
        SET @numeroError = ERROR_NUMBER();
        SET @respuesta = ERROR_MESSAGE();
    END CATCH
END;
GO
/****** Object:  StoredProcedure [dbo].[DEPORTE_GUARDAR]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   PROCEDURE [dbo].[DEPORTE_GUARDAR]
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
/****** Object:  StoredProcedure [dbo].[DEPORTE_IMAGEN_GUARDAR]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   PROCEDURE [dbo].[DEPORTE_IMAGEN_GUARDAR]
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
/****** Object:  StoredProcedure [dbo].[DEPORTE_IMAGEN_OBTENER]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   PROCEDURE [dbo].[DEPORTE_IMAGEN_OBTENER]
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
/****** Object:  StoredProcedure [dbo].[DEPORTE_LISTA]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   PROCEDURE [dbo].[DEPORTE_LISTA]
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
/****** Object:  StoredProcedure [dbo].[DEPORTE_LISTAR]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   PROCEDURE [dbo].[DEPORTE_LISTAR]
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
/****** Object:  StoredProcedure [dbo].[DEPORTE_OBTENER]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   PROCEDURE [dbo].[DEPORTE_OBTENER]
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
/****** Object:  StoredProcedure [dbo].[ENTRENADOR_CLASE_DISPONIBILIDAD]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   PROCEDURE [dbo].[ENTRENADOR_CLASE_DISPONIBILIDAD]
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
/****** Object:  StoredProcedure [dbo].[ENTRENADOR_CLASE_GUARDAR]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   PROCEDURE [dbo].[ENTRENADOR_CLASE_GUARDAR]
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
/****** Object:  StoredProcedure [dbo].[ENTRENADOR_CLASES_CONSULTAR]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   PROCEDURE [dbo].[ENTRENADOR_CLASES_CONSULTAR]
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
/****** Object:  StoredProcedure [dbo].[ENTRENADOR_CUENTA_OBTENER]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   PROCEDURE [dbo].[ENTRENADOR_CUENTA_OBTENER]
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
/****** Object:  StoredProcedure [dbo].[ENTRENADOR_FOTO_OBTENER]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   PROCEDURE [dbo].[ENTRENADOR_FOTO_OBTENER]
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
/****** Object:  StoredProcedure [dbo].[ENTRENADOR_PASSWORD_CAMBIAR]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   PROCEDURE [dbo].[ENTRENADOR_PASSWORD_CAMBIAR]
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
/****** Object:  StoredProcedure [dbo].[ENTRENADOR_PASSWORD_OBTENER]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   PROCEDURE [dbo].[ENTRENADOR_PASSWORD_OBTENER]
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
/****** Object:  StoredProcedure [dbo].[NUEVO_USUARIO_AGREGA]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
/*
============================================================
 Nombre: NUEVO_USUARIO_AGREGA
 Autor: Yael Aldemar Lila Lara
 Fecha de creación: 03/11/2026

 Descripción:
 Registra un nuevo usuario en ADSPORT después de
 comprobar la verificación de su correo electrónico.

 Busca automáticamente el ID del rol USUARIO en
 la tabla ROL y lo asigna al nuevo registro.

 Guarda los datos personales en la tabla USUARIO y
 el hash de la contraseña en la tabla PASSWORD.

 Relaciona ambos registros mediante sus identificadores.

 Utiliza una transacción para evitar registros
 incompletos y devuelve códigos de respuesta
 para su consumo desde la API.
============================================================
*/

CREATE   PROCEDURE [dbo].[NUEVO_USUARIO_AGREGA]
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
            NULL,
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
/****** Object:  StoredProcedure [dbo].[ROL_ACTUALIZA]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   PROCEDURE [dbo].[ROL_ACTUALIZA]
    @IdRol INT,
    @NombreRol VARCHAR(100),
    @Resultado BIT OUTPUT,
    @Mensaje VARCHAR(500) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET @Resultado = 1;
    SET @Mensaje = 'Rol actualizado correctamente.';

    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM ROL WHERE ID_ROL = @IdRol)
        BEGIN
            SET @Resultado = 0;
            SET @Mensaje = 'El rol no existe.';
            RETURN;
        END

        UPDATE ROL
        SET NOMBRE_ROL = @NombreRol
        WHERE ID_ROL = @IdRol;

    END TRY
    BEGIN CATCH
        SET @Resultado = 0;
        SET @Mensaje = ERROR_MESSAGE();
    END CATCH
END;

GO
/****** Object:  StoredProcedure [dbo].[ROL_CONSULTA]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   PROCEDURE [dbo].[ROL_CONSULTA]
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 
        ID_ROL AS IdRol,
        NOMBRE_ROL AS NombreRol
    FROM ROL;
END;

GO
/****** Object:  StoredProcedure [dbo].[ROL_CONSULTA_BY_ID]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   PROCEDURE [dbo].[ROL_CONSULTA_BY_ID]
    @IdRol INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 
        ID_ROL AS IdRol,
        NOMBRE_ROL AS NombreRol
    FROM ROL
    WHERE ID_ROL = @IdRol;
END;

GO
/****** Object:  StoredProcedure [dbo].[ROL_ELIMINA]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   PROCEDURE [dbo].[ROL_ELIMINA]
    @IdRol INT,
    @Resultado BIT OUTPUT,
    @Mensaje VARCHAR(500) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET @Resultado = 1;
    SET @Mensaje = 'Rol eliminado correctamente.';

    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM ROL WHERE ID_ROL = @IdRol)
        BEGIN
            SET @Resultado = 0;
            SET @Mensaje = 'El rol no existe.';
            RETURN;
        END

        DELETE FROM ROL
        WHERE ID_ROL = @IdRol;

    END TRY
    BEGIN CATCH
        SET @Resultado = 0;
        SET @Mensaje = ERROR_MESSAGE();
    END CATCH
END;

GO
/****** Object:  StoredProcedure [dbo].[ROL_REGISTRAR]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE   PROCEDURE [dbo].[ROL_REGISTRAR]
    @NombreRol VARCHAR(100),
    @Resultado BIT OUTPUT,
    @Mensaje VARCHAR(500) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET @Resultado = 1;
    SET @Mensaje = 'Rol registrado correctamente.';

    BEGIN TRY
        IF EXISTS (SELECT 1 FROM ROL WHERE NOMBRE_ROL = @NombreRol)
        BEGIN
            SET @Resultado = 0;
            SET @Mensaje = 'El nombre del rol ya existe.';
            RETURN;
        END

        -- Se agrega la columna y GETDATE() para registrar la fecha actual
        INSERT INTO ROL (NOMBRE_ROL, FECHA_UTIMA_MODIFICACION)
        VALUES (@NombreRol, GETDATE());

    END TRY
    BEGIN CATCH
        SET @Resultado = 0;
        SET @Mensaje = ERROR_MESSAGE();
    END CATCH
END;

GO
/****** Object:  StoredProcedure [dbo].[USUARIO_AGREGA]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE   PROCEDURE [dbo].[USUARIO_AGREGA]
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
/****** Object:  StoredProcedure [dbo].[USUARIO_CORREO_VERIFICADO]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
/*
============================================================
 Nombre: USUARIO_CORREO_VERIFICADO
 Autor: Yael Aldemar Lila Lara
 Fecha de creación: 03/11/2026

 Descripción:
 Comprueba si un correo electrónico ha sido verificado
 correctamente durante el proceso de registro de
 usuarios en ADSPORT.

 Consulta la solicitud de verificación más reciente
 y comprueba su estado.

 Devuelve códigos de respuesta para que la API
 identifique si el usuario puede continuar con el
 formulario de registro.
============================================================
*/

CREATE   PROCEDURE [dbo].[USUARIO_CORREO_VERIFICADO]
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
        WHERE CORREO = @CORREO
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
/****** Object:  StoredProcedure [dbo].[USUARIO_LOGIN_OBTENER]    Script Date: 22/11/2026 07:42:48 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

/*
============================================================
 Nombre: USUARIO_LOGIN_OBTENER
 Autor: Yael Aldemar Lila Lara
 Fecha de creación: 06/11/2026

 Descripción:
 Consulta los datos de un usuario registrado en ADSPORT
 mediante su correo electrónico.

 Valida que el correo sea obligatorio, que exista
 un usuario registrado y que su cuenta esté activa.

 Obtiene los datos personales, el rol y el hash BCrypt
 de la contraseña almacenada en la tabla PASSWORD.

 Relaciona las tablas USUARIO, ROL y PASSWORD mediante
 sus identificadores.

 La comparación de la contraseña se realiza en C#
 utilizando BCrypt.Verify.

 Devuelve códigos de respuesta y mensajes para que
 la API pueda identificar el resultado de la operación.
============================================================
*/

CREATE   PROCEDURE [dbo].[USUARIO_LOGIN_OBTENER]
    @CORREO VARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

    -- ========================================
    -- 1. VALIDAR CORREO OBLIGATORIO
    -- ========================================

    IF NULLIF(LTRIM(RTRIM(@CORREO)), '') IS NULL
    BEGIN
        SELECT
            400 AS CODIGO_RESPUESTA,
            'El correo electrónico es obligatorio.' AS MENSAJE;
        RETURN;
    END;

    -- ========================================
    -- 2. VERIFICAR EXISTENCIA DEL USUARIO
    -- ========================================

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.USUARIO
        WHERE CORREO = LTRIM(RTRIM(@CORREO))
    )
    BEGIN
        SELECT
            401 AS CODIGO_RESPUESTA,
            'Credenciales incorrectas.' AS MENSAJE;
        RETURN;
    END;

    -- ========================================
    -- 3. VALIDAR ESTADO DE LA CUENTA
    -- ========================================

    IF EXISTS (
        SELECT 1
        FROM dbo.USUARIO
        WHERE CORREO = LTRIM(RTRIM(@CORREO))
          AND UPPER(LTRIM(RTRIM(ISNULL(ESTATUS, '')))) <> 'ACTIVO'
    )
    BEGIN
        SELECT
            403 AS CODIGO_RESPUESTA,
            'La cuenta no está activa.' AS MENSAJE;
        RETURN;
    END;

    -- ========================================
    -- 4. CONSULTAR DATOS PARA LOGIN
    -- ========================================

    BEGIN TRY

        SELECT
            200 AS CODIGO_RESPUESTA,
            'Usuario encontrado correctamente.' AS MENSAJE,

            U.ID_USUARIO,
            U.NOMBRE,
            U.APELLIDO_PATERNO,
            U.APELLIDO_MATERNO,
            U.CORREO,
            U.ESTATUS,
            U.ID_ROL,
            R.NOMBRE_ROL,
            P.[PASSWORD] AS PASSWORD_HASH

        FROM dbo.USUARIO U

        INNER JOIN dbo.[PASSWORD] P
            ON P.ID_USUARIO = U.ID_USUARIO
           AND P.ID_PASSWORD = U.ID_PASSWORD

        LEFT JOIN dbo.ROL R
            ON R.ID_ROL = U.ID_ROL

        WHERE U.CORREO = LTRIM(RTRIM(@CORREO));

        -- La API deberá comprobar que se obtuvo
        -- un registro con un hash de contraseña válido.

    END TRY

    BEGIN CATCH

        SELECT
            500 AS CODIGO_RESPUESTA,
            'Ocurrió un error interno al consultar el usuario.' AS MENSAJE;

    END CATCH;

END;

GO
