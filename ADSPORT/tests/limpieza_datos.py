"""Comprueba la limpieza solo en LocalDB temporal; no lee la conexión del proyecto."""
from pathlib import Path
import re
import sys
import uuid

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/".artifacts/python"))
import pyodbc

DB="ADSPORT_LimpiezaTest_"+uuid.uuid4().hex[:12]
driver=next(d for d in reversed(pyodbc.drivers()) if "ODBC Driver" in d and "SQL Server" in d)
CS="DRIVER={"+driver+"};SERVER=(localdb)\\MSSQLLocalDB;Trusted_Connection=yes;Encrypt=no;TrustServerCertificate=yes;"
SCRIPT=ROOT/"database/herramientas/limpiar_datos_conservar_cuentas.sql"
TABLAS=["CLASE_ASISTENCIA","PAGO_CONFIRMACION_CORREO","PAGO_MERCADOPAGO","PAGO","REGISTRO_ACCESO","RESERVA",
    "HORARIO","CANCHA_APERTURA","CLASE","CANCHA","DEPORTE","CODIGO_VERIFICACION","USUARIO","ROL","PASSWORD"]


def ejecutar(db,texto,*parametros):
    c=db.cursor()
    try:
        c.execute(texto,*parametros)
        while c.nextset():pass
    finally:c.close()


def aplicar(db,ruta):
    for lote in re.split(r"(?im)^\s*GO\s*$",ruta.read_text(encoding="utf-8-sig")):
        if lote.strip():ejecutar(db,lote)


def fotos_tablas(db):
    return {t:[tuple(f) for f in db.execute("SELECT * FROM dbo.["+t+"] ORDER BY 1")] for t in TABLAS}


def main():
    master=pyodbc.connect(CS+"DATABASE=master",autocommit=True)
    db=None
    try:
        master.execute("CREATE DATABASE ["+DB+"]")
        db=pyodbc.connect(CS+"DATABASE="+DB,autocommit=True)
        aplicar(db,ROOT/"tests/fixtures/base_adjunta.sql")
        for migracion in sorted((ROOT/"database").glob("0*.sql")):aplicar(db,migracion)
        ejecutar(db,"""
            INSERT dbo.ROL(NOMBRE_ROL,FECHA_UTIMA_MODIFICACION)
            SELECT r.nombre,GETUTCDATE() FROM (VALUES('USUARIO'),('ENTRENADOR')) r(nombre)
            WHERE NOT EXISTS(SELECT 1 FROM dbo.ROL existente WHERE existente.NOMBRE_ROL=r.nombre);
            """)
        hash_ficticio="$2a$12$1PxPWkqo5CyMUnokFw0JFOtL270rt1Ju4jRZCN4jLmZi2MUC2DOtC"
        for indice,rol in enumerate(["ADMINISTRADOR","USUARIO","ENTRENADOR"]):
            ejecutar(db,"""
                DECLARE @rol bigint=(SELECT ID_ROL FROM dbo.ROL WHERE NOMBRE_ROL=?),@error int,@respuesta varchar(1000),@id bigint,@qr varchar(128);
                EXEC dbo.USUARIO_AGREGA @id_rol=@rol,@nombre='Cuenta',@apellido_paterno='Conservada',@apellido_materno='',
                    @correo=?,@telefono='5551234567',@estatus='ACTIVO',@foto=0x89504E47,@password_hash=?,
                    @numeroError=@error OUTPUT,@respuesta=@respuesta OUTPUT,@id_usuario=@id OUTPUT,@codigo_generado=@qr OUTPUT;
                IF @error<>0 THROW 51000,@respuesta,1;
                UPDATE dbo.USUARIO SET FONDO_PERFIL=0x01020304,FONDO_TIPO='image/png' WHERE ID_USUARIO=@id;
                """,rol,f"limpieza.{indice}@example.test",hash_ficticio)
        ejecutar(db,"""
            SET NOCOUNT ON;
            DECLARE @alumno bigint=(SELECT ID_USUARIO FROM dbo.USUARIO WHERE CORREO='limpieza.1@example.test'),
                @profesor bigint=(SELECT ID_USUARIO FROM dbo.USUARIO WHERE CORREO='limpieza.2@example.test'),
                @deporte bigint,@cancha bigint,@clase bigint,@reserva bigint,@pago bigint,@cobro uniqueidentifier=NEWID();
            INSERT dbo.DEPORTE(NOMBRE_DEPORTE,ACTIVO,FECHA_UTIMA_MODIFICACION) VALUES('Prueba de limpieza',1,GETUTCDATE());
            SET @deporte=SCOPE_IDENTITY();
            INSERT dbo.CANCHA(ID_DEPORTE,NOMBRE,ACTIVO) VALUES(@deporte,'Cancha a limpiar',1); SET @cancha=SCOPE_IDENTITY();
            INSERT dbo.CANCHA_APERTURA(ID_CANCHA,DIA_ISO,HORA_INICIO,HORA_FIN) VALUES(@cancha,1,'08:00','20:00');
            INSERT dbo.CLASE(ID_DEPORTE,ID_ENTRENADOR,NOMBRE_CLASE,PRECIO,CUPO_MAXIMO,DISPONIBLE)
                VALUES(@deporte,@profesor,'Clase a limpiar',50,5,1); SET @clase=SCOPE_IDENTITY();
            INSERT dbo.HORARIO(ID_CLASE,ID_CANCHA,DIA_ISO,HORA_INICIO,HORA_FIN,ACTIVO) VALUES(@clase,@cancha,1,'09:00','10:00',1);
            INSERT dbo.RESERVA(ID_USUARIO,ID_CLASE,ESTATUS_RESERVA,SEMANA_INICIO,SEMANA_FIN,MODO_PRUEBA)
                VALUES(@alumno,@clase,'CONFIRMADA','20261123','20261129',1); SET @reserva=SCOPE_IDENTITY();
            INSERT dbo.PAGO(ID_RESERVA,SUBTOTAL,IVA,MONTO_TOTAL) VALUES(@reserva,50,8,58); SET @pago=SCOPE_IDENTITY();
            INSERT dbo.PAGO_MERCADOPAGO(ID_COBRO,ID_RESERVA,ID_PAGO,IMPORTE,MODO_PRUEBA,ESTADO,CLASE_NOMBRE,ENTRENADOR_NOMBRE,
                HORARIOS,CORREO,URL_RETORNO,VIGENCIA_SEGUNDOS,SUBTOTAL,IVA,TASA_IVA,CODIGO_ACCESO)
                VALUES(@cobro,@reserva,@pago,58,1,'APROBADO','Clase a limpiar','Profesor','[]','limpieza.1@example.test',
                    'http://localhost',600,50,8,0.16,REPLICATE('A',48));
            INSERT dbo.PAGO_CONFIRMACION_CORREO(ID_COBRO) VALUES(@cobro);
            INSERT dbo.CLASE_ASISTENCIA(ID_COBRO,FECHA,HORA_INICIO,HORA_FIN,PRESENTE,ID_ENTRENADOR,METODO)
                VALUES(@cobro,'20261123','09:00','10:00',1,@profesor,'QR');
            INSERT dbo.REGISTRO_ACCESO(ID_PASE,ID_STAFF,FECHA_ESCANEO) VALUES(@clase,@profesor,GETDATE());
            INSERT dbo.CODIGO_VERIFICACION(ID_USUARIO,CORREO,CODIGO_HASH,FECHA_CREACION,FECHA_EXPIRACION,UTILIZADO,INTENTOS,
                FECHA_UTIMA_MODIFICACION,VERIFICADO,PROPOSITO)
            SELECT u.ID_USUARIO,u.CORREO,REPLICATE('B',64),DATEADD(day,-v.dias,GETUTCDATE()),DATEADD(day,1,GETUTCDATE()),
                v.consumido,0,DATEADD(day,-v.dias,GETUTCDATE()),v.consumido,v.proposito
            FROM dbo.USUARIO u CROSS JOIN (VALUES(2,1,'RECUPERACION'),(1,1,'RECUPERACION'),(0,0,'RECUPERACION'),(0,0,'REGISTRO')) v(dias,consumido,proposito);
            """)
        antes=fotos_tablas(db)
        assert all(antes[t] for t in TABLAS)
        # Fallo tras varios DELETE: toda la operación tiene que revertirse.
        ejecutar(db,"CREATE TRIGGER dbo.TEST_LIMPIEZA_FALLO ON dbo.CANCHA AFTER DELETE AS THROW 51000,'Fallo controlado',1;")
        try:aplicar(db,SCRIPT)
        except pyodbc.Error as e:assert "Fallo controlado" in str(e)
        else:raise AssertionError("Se esperaba el error controlado")
        assert fotos_tablas(db)==antes
        print("OK Un error revierte todos los borrados sin modificar las cuentas.",flush=True)
        ejecutar(db,"DROP TRIGGER dbo.TEST_LIMPIEZA_FALLO")
        objetos=[tuple(r) for r in db.execute("SELECT object_id,name,type FROM sys.objects WHERE is_ms_shipped=0 ORDER BY object_id")]
        fks=[tuple(r) for r in db.execute("SELECT object_id,is_disabled,is_not_trusted FROM sys.foreign_keys ORDER BY object_id")]
        marcas=[r[0] for r in db.execute("""
            SELECT MAX(ID_CODIGO) FROM dbo.CODIGO_VERIFICACION WHERE PROPOSITO='RECUPERACION' AND UTILIZADO=1 AND VERIFICADO=1 GROUP BY ID_USUARIO
            """)]
        aplicar(db,SCRIPT)
        despues=fotos_tablas(db)
        assert all(not despues[t] for t in TABLAS if t not in ["USUARIO","ROL","PASSWORD","CODIGO_VERIFICACION"])
        assert all(antes[t]==despues[t] for t in ["USUARIO","ROL","PASSWORD"])
        assert [r[0] for r in db.execute("SELECT ID_CODIGO FROM dbo.CODIGO_VERIFICACION ORDER BY ID_CODIGO")]==sorted(marcas)
        assert objetos==[tuple(r) for r in db.execute("SELECT object_id,name,type FROM sys.objects WHERE is_ms_shipped=0 ORDER BY object_id")]
        assert fks==[tuple(r) for r in db.execute("SELECT object_id,is_disabled,is_not_trusted FROM sys.foreign_keys ORDER BY object_id")]
        print("OK Limpia los datos y conserva usuarios, fotos, fondos, QR, roles, contraseñas, estructuras y restricciones.",flush=True)
        login=db.execute("EXEC dbo.USUARIO_LOGIN_OBTENER @CORREO='limpieza.0@example.test'").fetchone()
        assert login.CODIGO_RESPUESTA==200 and login.PASSWORD_HASH==hash_ficticio
        cuenta=db.execute("SELECT ID_USUARIO FROM dbo.USUARIO WHERE CORREO='limpieza.0@example.test'").fetchone()[0]
        assert db.execute("EXEC dbo.RECUPERACION_PASSWORD_SESION_REVOCADA @IdUsuario=?,@InicioSesion='20000101'",cuenta).fetchone()[0]
        print("OK El login mantiene su hash y las sesiones anteriores siguen revocadas.",flush=True)
        aplicar(db,SCRIPT)
        assert fotos_tablas(db)==despues
        print("OK Se puede repetir sobre la base ya limpia.",flush=True)
    finally:
        if db:db.close()
        if not re.fullmatch(r"ADSPORT_LimpiezaTest_[a-f0-9]{12}",DB):raise RuntimeError("Nombre de base temporal inesperado")
        master.execute("ALTER DATABASE ["+DB+"] SET SINGLE_USER WITH ROLLBACK IMMEDIATE")
        master.execute("DROP DATABASE ["+DB+"]")
        master.close()
        print("Base temporal de pruebas eliminada.",flush=True)


if __name__=="__main__":main()
