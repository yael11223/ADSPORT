"""Pruebas reales de ADSPORT en una base LocalDB temporal; nunca usa appsettings para conectar a SQL."""
from __future__ import annotations
import concurrent.futures
import base64
import io
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ".artifacts" / "python"))
import pyodbc
from PIL import Image
from playwright.sync_api import sync_playwright, expect
import zxingcpp
from recuperacion_password import ServidorCorreoPruebas, probar_recuperacion

ARTIFACTS = ROOT / ".artifacts"
ARTIFACTS.mkdir(exist_ok=True)
DB = "ADSPORT_CodexTest_" + uuid.uuid4().hex[:12]
SERVER = r"(localdb)\MSSQLLocalDB"
DRIVER = next((d for d in reversed(pyodbc.drivers()) if "ODBC Driver" in d and "SQL Server" in d), None)
if not DRIVER:
    raise RuntimeError("Instala un controlador ODBC de SQL Server.")
CS = "DRIVER={" + DRIVER + "};SERVER=" + SERVER + ";Trusted_Connection=yes;Encrypt=no;TrustServerCertificate=yes;"
CHECKS: list[str] = []
PAGE_ERRORS: list[str] = []
PASSWORD = "Prueba#2026!"  # Credencial ficticia, exclusiva de la base temporal.


def check(nombre, condicion=True, detalle=""):
    if not condicion:
        raise AssertionError(nombre + (": " + str(detalle) if detalle else ""))
    CHECKS.append(nombre)
    print("OK", nombre, flush=True)


def aplicar(conexion, ruta):
    for batch in re.split(r"(?im)^\s*GO\s*$", ruta.read_text(encoding="utf-8-sig")):
        if batch.strip():
            cursor = conexion.cursor()
            try:
                cursor.execute(batch)
                while cursor.nextset():
                    pass
            except Exception as error:
                raise RuntimeError("Error SQL en " + ruta.name + ":\n" + batch[:350] + "\n" + str(error)) from error
            finally:
                cursor.close()


def main():
    master = pyodbc.connect(CS + "DATABASE=master;", autocommit=True, timeout=10)
    app = None
    database = None
    log = None
    smtp = None
    try:
        master.execute("CREATE DATABASE [" + DB + "]")
        database = pyodbc.connect(CS + "DATABASE=" + DB + ";", autocommit=True)
        aplicar(database, ROOT / "tests/fixtures/base_adjunta.sql")
        aplicar(database, ROOT / "database/005_usuarios_canchas_cronograma.sql")
        aplicar(database, ROOT / "database/005_usuarios_canchas_cronograma.sql")
        check("Migración aplicada dos veces sobre el esquema adjunto")
        aplicar(database, ROOT / "database/006_imagenes_instalaciones.sql")
        aplicar(database, ROOT / "database/006_imagenes_instalaciones.sql")
        check("Migración de fotografías aplicada dos veces sin borrar datos")
        aplicar(database, ROOT / "database/007_eliminar_canchas_usuarios.sql")
        aplicar(database, ROOT / "database/007_eliminar_canchas_usuarios.sql")
        check("Procedimientos de eliminación instalados y repetibles")
        aplicar(database, ROOT / "database/008_eliminar_deportes_clases_roles.sql")
        aplicar(database, ROOT / "database/009_recuperacion_password.sql")
        aplicar(database, ROOT / "database/008_eliminar_deportes_clases_roles.sql")
        aplicar(database, ROOT / "database/009_recuperacion_password.sql")
        check("Eliminación de deportes, clases y roles instalada de forma repetible")
        check("Recuperación de contraseña instalada dos veces con la tabla de códigos existente")
        smtp = ServidorCorreoPruebas()
        clave_verificacion = os.urandom(32)
        with socket.socket() as reserva:
            reserva.bind(("127.0.0.1", 0))
            port = reserva.getsockname()[1]
        base = "http://127.0.0.1:" + str(port)
        env = os.environ.copy()
        env.update({
            "ASPNETCORE_ENVIRONMENT": "Development",
            "ASPNETCORE_URLS": base,
            "ConnectionStrings__CadenaSQL": r"Server=(localdb)\MSSQLLocalDB;Database=" + DB + ";Integrated Security=True;Encrypt=False;TrustServerCertificate=True",
            "DemoLogin__Correo": "admin.integration@example.test",
            "DemoLogin__Password": PASSWORD,
            "DemoLogin__Nombre": "Administración de prueba",
            "DataProtection__KeysDirectory": str(ARTIFACTS / "test-keys"),
            "DOTNET_CLI_HOME": str(ROOT / ".dotnet-home"),
            "DOTNET_CLI_TELEMETRY_OPTOUT": "1",
            "Verificacion__ClaveHmac": base64.b64encode(clave_verificacion).decode(),
            "Smtp__Servidor": "127.0.0.1",
            "Smtp__Puerto": str(smtp.puerto),
            "Smtp__CorreoRemitente": "club@example.test",
            "Smtp__PermitirSinTlsLocal": "true",
            "Smtp__Usuario": "",
            "Smtp__Password": "",
        })
        log = (ARTIFACTS / "integration-server.log").open("w", encoding="utf-8")
        app = subprocess.Popen(["dotnet", str(ARTIFACTS / "build/ADSPORT.dll")],
            cwd=ROOT / "MiWebAPI", env=env, stdout=log, stderr=subprocess.STDOUT,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        for _ in range(100):
            if app.poll() is not None:
                raise RuntimeError("El servidor terminó. Consulta .artifacts/integration-server.log.")
            try:
                with urllib.request.urlopen(base + "/api/Auth/sesion", timeout=1):
                    break
            except (OSError, urllib.error.URLError):
                time.sleep(.2)
        else:
            raise RuntimeError("El servidor de pruebas no respondió.")

        with sync_playwright() as pw:
            browser = pw.chromium.launch(channel="msedge", headless=True)
            admin = browser.new_context(viewport={"width": 1440, "height": 1050})
            anon = browser.new_context()
            page = admin.new_page()
            page.on("pageerror", lambda error: PAGE_ERRORS.append(str(error)))

            def api(ctx, metodo, ruta, datos=None, esperado=200, csrf=True):
                headers = {}
                if metodo not in ("GET", "HEAD") and csrf:
                    token = ctx.request.get(base + "/api/Auth/csrf").json()["token"]
                    headers["X-CSRF-TOKEN"] = token
                respuesta = ctx.request.fetch(base + ruta, method=metodo, data=datos, headers=headers)
                assert respuesta.status == esperado, (ruta, respuesta.status, respuesta.text()[:1000])
                return respuesta.json() if respuesta.headers.get("content-type", "").startswith("application/json") else respuesta

            api(admin, "POST", "/api/Auth/login", {"correo": "admin.integration@example.test", "password": PASSWORD})
            api(anon, "GET", "/api/Usuario", esperado=401)
            api(admin, "POST", "/api/Usuario", {}, esperado=400, csrf=False)
            roles = api(admin, "GET", "/api/Rol")
            profesor_rol = next(r["idRol"] for r in roles if r["nombreRol"] == "ENTRENADOR")
            usuario_rol = next(r["idRol"] for r in roles if r["nombreRol"] == "USUARIO")
            check("Roles disponibles, autenticación administrativa y CSRF obligatorios")
            check("Instalaciones públicas accesibles sin iniciar sesión", api(anon,"GET","/api/Instalaciones") == [])

            def datos_usuario(nombre, correo, rol):
                return {"idRol": rol, "nombre": nombre, "apellidoPaterno": "Prueba", "apellidoMaterno": "",
                    "correo": correo, "telefono": "", "estatus": "ACTIVO", "passwordInicial": PASSWORD}

            page.goto(base + "/usuarios.html", wait_until="domcontentloaded")
            expect(page.locator("#guardarUsuario")).to_be_enabled()
            page.locator("#usuarioNombre").fill("Ana")
            page.locator("#usuarioPaterno").fill("Prueba")
            page.locator("#usuarioCorreo").fill("ana@example.test")
            page.locator("#usuarioRol").select_option(str(profesor_rol))
            page.locator("#usuarioPassword").fill(PASSWORD)
            page.locator("#guardarUsuario").click()
            expect(page.locator("#dialogQr")).to_be_visible()
            usuarios = api(admin, "GET", "/api/Usuario")
            ana = next(u for u in usuarios if u["correo"] == "ana@example.test")
            png = admin.request.get(base + "/api/Usuario/" + str(ana["idUsuario"]) + "/qr")
            decoded = zxingcpp.read_barcode(Image.open(io.BytesIO(png.body())))
            check("Alta de profesor desde el formulario y QR PNG legible", decoded is not None and decoded.text == ana["codigoQr"])
            page.screenshot(path=str(ARTIFACTS / "usuarios-qr.png"), full_page=True)
            page.get_by_role("button", name="Cerrar", exact=True).first.click()

            page.locator("#abrirRol").click()
            page.locator("#nombreNuevoRol").fill("FISIOTERAPEUTA")
            page.locator("#guardarRol").click()
            expect(page.locator("#dialogRol")).not_to_be_visible()
            expect(page.locator("#usuarioRol option:checked")).to_have_text("FISIOTERAPEUTA")
            check("Creación de rol y selección automática en el alta")
            luis_resultado = api(admin, "POST", "/api/Usuario", datos_usuario("Luis", "luis@example.test", profesor_rol), esperado=201)
            cliente_resultado = api(admin, "POST", "/api/Usuario", datos_usuario("Cliente", "cliente@example.test", usuario_rol), esperado=201)
            luis = api(admin, "GET", "/api/Usuario/" + str(luis_resultado["idUsuario"]))
            cliente = api(admin, "GET", "/api/Usuario/" + str(cliente_resultado["idUsuario"]))
            check("Cada usuario recibe un QR único", len({ana["codigoQr"], luis["codigoQr"], cliente["codigoQr"]}) == 3)

            api(admin, "POST", "/api/Usuario", datos_usuario("Duplicado", " ANA@example.test ", profesor_rol), esperado=409)
            invalido = datos_usuario("Débil", "debil@example.test", usuario_rol)
            invalido["passwordInicial"] = "123"
            api(admin, "POST", "/api/Usuario", invalido, esperado=400)
            check("Correos duplicados y contraseñas débiles rechazados")
            editado = dict(ana, apellidoPaterno="Actualizada", codigoQr="un-qr-del-navegador")
            api(admin, "PUT", "/api/Usuario/" + str(ana["idUsuario"]), editado)
            ana_editada = api(admin, "GET", "/api/Usuario/" + str(ana["idUsuario"]))
            check("Edición conserva nombres separados y el QR original", ana_editada["apellidoPaterno"] == "Actualizada" and ana_editada["codigoQr"] == ana["codigoQr"])
            page.locator("#actualizarUsuarios").click()
            fila_ana = page.locator("#listaUsuarios tr").filter(has_text="ana@example.test")
            fila_ana.get_by_role("button", name="Editar", exact=True).click()
            expect(page.locator("#tituloFormularioUsuario")).to_have_text("Editar usuario")
            page.locator("#usuarioTelefono").fill("5551234567")
            page.locator("#guardarUsuario").click()
            expect(page.locator("#avisoUsuarios")).to_contain_text("actualizado")
            check("Edición desde el formulario conserva el rol y el QR",
                api(admin,"GET","/api/Usuario/"+str(ana["idUsuario"]))["telefono"] == "5551234567")
            page.goto(base + "/empleados.html", wait_until="domcontentloaded")
            expect(page.locator("#listaUsuarios tr")).to_have_count(2)
            expect(page.locator("#listaUsuarios")).not_to_contain_text("cliente@example.test")
            page.screenshot(path=str(ARTIFACTS / "profesores.png"), full_page=True)
            check("Directorio de profesores excluye los otros roles")

            tenis = api(admin, "POST", "/api/Deporte", {"nombreDeporte": "Tenis", "descripcion": "Clases de tenis", "activo": True})["idDeporte"]
            futbol = api(admin, "POST", "/api/Deporte", {"nombreDeporte": "Fútbol", "descripcion": "Clases de fútbol", "activo": True})["idDeporte"]
            page.goto(base + "/canchas.html", wait_until="domcontentloaded")
            expect(page.locator("#guardarCancha")).to_be_enabled()
            page.locator("#nombreCancha").fill("Cancha central")
            page.locator("#deporteCancha").select_option(str(tenis))
            page.locator("#ubicacionCancha").fill("Zona norte")
            fila = page.locator("#aperturaCancha .admin-schedule-row").first
            fila.locator('[data-campo="horaFin"]').fill("12:00")
            page.locator("#agregarApertura").click()
            segunda = page.locator("#aperturaCancha .admin-schedule-row").nth(1)
            segunda.locator('[data-campo="horaInicio"]').fill("14:00")
            segunda.locator('[data-campo="horaFin"]').fill("18:00")
            page.locator("#agregarApertura").click()
            tercera = page.locator("#aperturaCancha .admin-schedule-row").nth(2)
            tercera.locator('[data-campo="diaSemana"]').select_option("2")
            tercera.locator('[data-campo="horaFin"]').fill("18:00")
            foto_path = ROOT / "MiWebAPI/wwwroot/img/nosotros/tenis.png"
            foto_png = foto_path.read_bytes()
            page.locator("#imagenCancha").set_input_files(str(foto_path))
            expect(page.locator("#previewCancha")).to_be_visible()
            page.route("**/api/Cancha/*/imagen", lambda route: route.fulfill(status=503,content_type="application/json",
                body=json.dumps({"respuesta":"Fallo temporal de prueba"})), times=1)
            page.locator("#guardarCancha").click()
            expect(page.locator("#reintentarImagenCancha")).to_be_visible()
            expect(page.locator("#avisoCanchas")).to_contain_text("La cancha se guardó")
            id_antes_reintento = page.locator("#idCancha").input_value()
            page.locator("#reintentarImagenCancha").click()
            expect(page.locator("#avisoCanchas")).to_contain_text("Fotografía de la instalación guardada")
            expect(page.locator("#reintentarImagenCancha")).not_to_be_visible()
            canchas_tras_reintento = api(admin,"GET","/api/Cancha?incluirInactivas=true")
            check("La fotografía se puede reintentar sin duplicar la cancha",
                len(canchas_tras_reintento) == 1 and str(canchas_tras_reintento[0]["idCancha"]) == id_antes_reintento)
            check("El selector de día de apertura es legible y queda dentro del formulario",
                page.locator('#aperturaCancha [data-campo="diaSemana"]').first.bounding_box()["width"] >= 200
                and page.evaluate("document.querySelector('#aperturaCancha').scrollWidth <= document.querySelector('#aperturaCancha').clientWidth"))
            central = api(admin, "GET", "/api/Cancha?incluirInactivas=true")[0]
            check("Alta de cancha desde el formulario con varias aperturas por día", len(central["horarios"]) == 3)
            fotografia_publica = anon.request.get(base + central["imagenUrl"])
            check("Fotografía elegida desde el formulario guardada y servida como PNG",
                fotografia_publica.status == 200 and fotografia_publica.body() == foto_png
                and fotografia_publica.headers.get("content-type") == "image/png")
            def subir_foto(ctx, contenido, mime="image/png", esperado=200, csrf=True):
                headers = {}
                if csrf:
                    headers["X-CSRF-TOKEN"] = ctx.request.get(base + "/api/Auth/csrf").json()["token"]
                respuesta = ctx.request.post(base + "/api/Cancha/" + str(central["idCancha"]) + "/imagen",
                    headers=headers, multipart={"archivo":{"name":"instalacion.png","mimeType":mime,"buffer":contenido}})
                assert respuesta.status == esperado, (respuesta.status,respuesta.text()[:500])
                return respuesta
            subir_foto(anon,foto_png,esperado=401)
            subir_foto(admin,foto_png,esperado=400,csrf=False)
            subir_foto(admin,b"<html>archivo disfrazado</html>",esperado=400)
            subir_foto(admin,b"x"*(5*1024*1024+1),esperado=413)
            check("La carga de imágenes exige administrador, CSRF, formato real y máximo 5 MB")
            datos_central = {"nombre":central["nombre"],"idDeporte":tenis,"ubicacion":"Zona norte",
                "activo":False,"horarios":central["horarios"]}
            api(admin,"PUT","/api/Cancha/"+str(central["idCancha"]),datos_central)
            check("Canchas inactivas y sus fotografías se ocultan al público",
                not api(anon,"GET","/api/Instalaciones") and
                anon.request.get(base+"/api/Cancha/"+str(central["idCancha"])+"/imagen").status == 404
                and admin.request.get(base+"/api/Cancha/"+str(central["idCancha"])+"/imagen").status == 200)
            datos_central["activo"] = True
            api(admin,"PUT","/api/Cancha/"+str(central["idCancha"]),datos_central)
            check("Editar una cancha sin nueva fotografía conserva su imagen",
                anon.request.get(base+"/api/Cancha/"+str(central["idCancha"])+"/imagen").body() == foto_png)
            apertura = [{"diaSemana": 1, "horaInicio": "08:00", "horaFin": "18:00"}]
            secundaria = api(admin, "POST", "/api/Cancha", {"nombre": "Cancha secundaria", "idDeporte": tenis, "activo": True, "horarios": apertura}, esperado=201)["idCancha"]
            futbol_cancha = api(admin, "POST", "/api/Cancha", {"nombre": "Cancha fútbol", "idDeporte": futbol, "activo": True, "horarios": apertura}, esperado=201)["idCancha"]

            def login_profesor(correo):
                ctx = browser.new_context(viewport={"width": 1440, "height": 1050})
                token = ctx.request.get(base + "/api/Entrenador/csrf").json()["token"]
                respuesta = ctx.request.post(base + "/api/Entrenador/login", data={"correo": correo, "password": PASSWORD}, headers={"X-CSRF-TOKEN": token})
                assert respuesta.status == 200, respuesta.text()
                return ctx

            profe1 = login_profesor("ana@example.test")
            profe2 = login_profesor("luis@example.test")
            subir_foto(profe1,foto_png,esperado=403)
            check("Los profesores no pueden modificar fotografías de las instalaciones")
            api(profe1, "GET", "/api/Usuario", esperado=403)
            api(profe1, "GET", "/api/Cancha?incluirInactivas=true", esperado=403)
            api(profe1, "GET", "/api/Administracion/cronograma", esperado=403)
            api(profe1, "POST", "/api/Cancha", {}, esperado=403)
            api(anon, "GET", "/api/Cancha", esperado=401)
            check("Usuarios, agenda y canchas protegidos según el perfil")

            trainer_page = profe1.new_page()
            trainer_page.on("pageerror", lambda error: PAGE_ERRORS.append(str(error)))
            trainer_page.goto(base + "/perfilEntrenador.html", wait_until="domcontentloaded")
            expect(trainer_page.locator("#btnNuevaClase")).to_be_enabled()
            trainer_page.locator("#btnNuevaClase").click()
            trainer_page.locator("#claseNombre").fill("Tenis inicial")
            trainer_page.locator("#claseDeporte").select_option(str(tenis))
            trainer_page.locator("#claseCancha").select_option(str(central["idCancha"]))
            expect(trainer_page.locator("#avisoCanchaClase")).to_contain_text("Estas franjas")
            check("Selector del profesor muestra únicamente canchas del deporte",
                trainer_page.locator("#claseCancha option").count() == 3 and "Cancha fútbol" not in trainer_page.locator("#claseCancha").inner_text())
            trainer_page.locator("#claseDescripcion").fill("Entrenamiento técnico")
            trainer_page.locator("#clasePrecio").fill("150")
            trainer_page.locator("#claseCupo").fill("10")
            horario_ui = trainer_page.locator("#horariosEditor .trainer-schedule-row").first
            horario_ui.locator('[data-campo="dia"]').select_option("1")
            horario_ui.locator('[data-campo="inicio"]').select_option("09:00")
            horario_ui.locator('[data-campo="fin"]').select_option("10:00")
            trainer_page.screenshot(path=str(ARTIFACTS / "profesor-nueva-clase.png"), full_page=True)
            trainer_page.locator("#btnGuardarClase").click()
            expect(trainer_page.locator("#modalNuevaClase")).not_to_be_visible()
            expect(trainer_page.locator("#listaClasesEntrenador")).to_contain_text("Cancha central")
            clase1 = api(profe1, "GET", "/api/Entrenador/clases")[0]
            check("Profesor crea clase con cancha y horario libre desde su formulario")
            expect(trainer_page.locator("#nombreUsuarioHeader")).to_have_text("Ana")
            check("Header y perfil cargan sin referencias JavaScript inválidas")

            def datos_clase(nombre, cancha, inicio, fin, disponible=True, dia=1):
                return {"idDeporte": tenis, "idCancha": cancha, "nombreClase": nombre, "descripcion": "Sesión de integración",
                    "precio": 100, "cupoMaximo": 10, "disponible": disponible,
                    "horarios": [{"diaSemana": dia, "horaInicio": inicio, "horaFin": fin}]}

            central_id = central["idCancha"]
            api(profe2, "POST", "/api/Entrenador/clases", datos_clase("Cruce cancha", central_id, "09:30", "10:30"), esperado=409)
            api(profe1, "POST", "/api/Entrenador/clases", datos_clase("Cruce profesor", secundaria, "09:30", "10:30"), esperado=409)
            api(profe1, "POST", "/api/Entrenador/clases", datos_clase("Cancha incorrecta", futbol_cancha, "11:00", "12:00"), esperado=400)
            api(profe1, "POST", "/api/Entrenador/clases", datos_clase("Fuera apertura", central_id, "12:00", "13:00"), esperado=409)
            check("Servidor impide cruces de cancha o profesor, deporte incorrecto y horarios cerrados")
            clase2 = api(profe2, "POST", "/api/Entrenador/clases", datos_clase("Tenis avanzado", central_id, "10:00", "11:00"))["idClase"]
            check("Clases consecutivas permitidas")
            libre = api(admin, "GET", "/api/Cancha/" + str(central_id) + "/disponibilidad?diaSemana=1")
            check("Disponibilidad resta y une ocupaciones sin perder pausas de apertura",
                [(h["horaInicio"], h["horaFin"]) for h in libre["disponibles"]] == [("08:00","09:00"),("11:00","12:00"),("14:00","18:00")], libre)
            cerrada = api(admin, "GET", "/api/Cancha/" + str(central_id) + "/disponibilidad?diaSemana=7")
            check("Día sin apertura no ofrece horarios", not cerrada["disponibles"])
            propia = api(profe1, "GET", "/api/Cancha/" + str(central_id) + "/disponibilidad?diaSemana=1&excluirClase=" + str(clase1["idClase"]))
            check("Al editar una clase, su propio horario vuelve a estar disponible",
                any(h["horaInicio"] == "08:00" and h["horaFin"] == "10:00" for h in propia["disponibles"]))
            api(profe2, "GET", "/api/Cancha/" + str(central_id) + "/disponibilidad?excluirClase=" + str(clase1["idClase"]), esperado=403)

            borrador = api(profe1, "POST", "/api/Entrenador/clases", datos_clase("Borrador", central_id, "10:30", "11:30", False))["idClase"]
            api(profe1, "PUT", "/api/Entrenador/clases/" + str(borrador) + "/disponibilidad", {"disponible": True}, esperado=409)
            check("Publicar un borrador vuelve a validar los cruces")
            api(profe1, "PUT", "/api/Entrenador/clases/" + str(borrador), datos_clase("Borrador", secundaria, "14:00", "15:00"))
            filas_historicas = database.execute("SELECT COUNT(*),SUM(CONVERT(int,ACTIVO)) FROM dbo.HORARIO WHERE ID_CLASE=?", borrador).fetchone()
            check("Editar reasigna cancha y conserva el historial", filas_historicas[0] == 2 and filas_historicas[1] == 1)
            modificada = {"nombre": central["nombre"], "idDeporte": tenis, "ubicacion": "Zona norte", "activo": False, "horarios": central["horarios"]}
            api(admin, "PUT", "/api/Cancha/" + str(central_id), modificada, esperado=409)
            modificada["activo"] = True
            modificada["horarios"] = [{"diaSemana": 1, "horaInicio": "11:00", "horaFin": "18:00"}]
            api(admin, "PUT", "/api/Cancha/" + str(central_id), modificada, esperado=409)
            check("No se puede cerrar una cancha ni recortar aperturas con clases publicadas")

            teacher_slots = api(profe1, "GET", "/api/Cancha/" + str(secundaria) + "/disponibilidad?diaSemana=1")
            check("Disponibilidad del profesor también descuenta sus clases en otras canchas",
                not any(h["horaInicio"] <= "09:30" < h["horaFin"] for h in teacher_slots["disponibles"]))
            trainer_page.locator("#btnNuevaClase").click()
            trainer_page.locator("#claseDeporte").select_option(str(tenis))
            trainer_page.locator("#claseCancha").select_option(str(central_id))
            expect(trainer_page.locator("#avisoCanchaClase")).to_contain_text("Estas franjas")
            opcion_ocupada = trainer_page.locator('#horariosEditor [data-campo="inicio"] option[value="09:30"]')
            check("La interfaz no ofrece horas ocupadas", opcion_ocupada.count() == 0)
            trainer_page.locator('[data-cerrar-dialog="modalNuevaClase"]').first.click()

            # Dos peticiones reales compiten por el mismo espacio con cuentas diferentes.
            concurrentes = []
            for ctx in (profe1, profe2):
                token = ctx.request.get(base + "/api/Entrenador/csrf").json()["token"]
                cookies = "; ".join(c["name"] + "=" + c["value"] for c in ctx.cookies())
                concurrentes.append((token,cookies))
            def competir(indice):
                token,cookies = concurrentes[indice]
                data = json.dumps(datos_clase("Simultánea " + str(indice), secundaria, "12:00", "13:00")).encode()
                request = urllib.request.Request(base + "/api/Entrenador/clases", data=data,
                    headers={"Content-Type":"application/json","X-CSRF-TOKEN":token,"Cookie":cookies},method="POST")
                try:
                    with urllib.request.urlopen(request,timeout=20) as respuesta:
                        return respuesta.status
                except urllib.error.HTTPError as error:
                    return error.code
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
                estados = list(pool.map(competir, (0,1)))
            check("Dos altas simultáneas no pueden ocupar la misma cancha", sorted(estados) == [200,409], estados)

            cronograma = api(admin, "GET", "/api/Administracion/cronograma")
            filtrado = api(admin, "GET", "/api/Administracion/cronograma?idEntrenador=" + str(ana["idUsuario"]))
            check("Cronograma general y filtros por profesor", bool(cronograma) and all(s["idEntrenador"] == ana["idUsuario"] for s in filtrado))
            clases_profesor = api(admin, "GET", "/api/Usuario/" + str(ana["idUsuario"]) + "/clases")
            check("El administrador puede consultar las clases del profesor", any(c["idClase"] == clase1["idClase"] for c in clases_profesor))
            page.goto(base + "/empleados.html", wait_until="domcontentloaded")
            expect(page.locator("#listaUsuarios tr")).to_have_count(2)
            page.locator("#listaUsuarios tr").filter(has_text="ana@example.test").get_by_role("button",name="Clases",exact=True).click()
            expect(page.locator("#dialogClases")).to_be_visible()
            expect(page.locator("#clasesProfesor")).to_contain_text("Tenis inicial")
            expect(page.locator("#clasesProfesor")).to_contain_text("Cancha central")
            check("Detalle de clases del profesor accesible desde su directorio")
            page.locator('[data-cerrar="dialogClases"]').click()
            page.goto(base + "/cronograma.html?idEntrenador=" + str(ana["idUsuario"]), wait_until="domcontentloaded")
            expect(page.locator("#semanaAgenda .admin-day")).to_have_count(7)
            expect(page.locator("#semanaAgenda")).to_contain_text("Tenis inicial")
            check("Los siete días quedan en una fila en escritorio",
                len({round(b["y"]) for b in page.locator("#semanaAgenda .admin-day").evaluate_all("items => items.map(e => ({y:e.getBoundingClientRect().y}))")}) == 1)
            page.screenshot(path=str(ARTIFACTS / "cronograma.png"), full_page=True)
            page.set_viewport_size({"width":390,"height":844})
            page.screenshot(path=str(ARTIFACTS / "cronograma-movil.png"), full_page=True)
            check("Cronograma visible y adaptable en escritorio y móvil",
                page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"))
            page.set_viewport_size({"width":1440,"height":1050})
            page.goto(base + "/canchas.html?idCancha=" + str(central_id), wait_until="domcontentloaded")
            expect(page.locator("#franjasOcupadas")).to_contain_text("Tenis inicial")
            page.screenshot(path=str(ARTIFACTS / "canchas.png"), full_page=True)

            public_page = anon.new_page()
            public_page.on("pageerror", lambda error: PAGE_ERRORS.append(str(error)))
            public_page.goto(base + "/tenis.html?idDeporte=" + str(tenis) + "&deporte=Tenis", wait_until="domcontentloaded")
            expect(public_page.locator("#catalogoClases")).to_contain_text("Tenis inicial")
            expect(public_page.locator("#catalogoClases")).to_contain_text("Cancha central")
            check("Catálogo público usa la API existente y muestra la cancha")
            public_page.goto(base + "/instalaciones.html",wait_until="domcontentloaded")
            expect(public_page.locator("#galeriaInstalaciones .instalacion-tarjeta")).to_have_count(3)
            expect(public_page.locator('.profile-nav a[data-nav="instalaciones"]')).to_have_attribute("aria-current","page")
            public_page.locator("#deporteInstalaciones").select_option(str(tenis))
            expect(public_page.locator("#galeriaInstalaciones .instalacion-tarjeta")).to_have_count(2)
            public_page.get_by_role("button",name="Ampliar fotografía").first.click()
            expect(public_page.locator("#visorInstalacion")).to_be_visible()
            expect(public_page.locator("#tituloVisorInstalacion")).to_have_text("Cancha central")
            public_page.locator("#cerrarVisorInstalacion").click()
            public_page.locator("#deporteInstalaciones").select_option(str(futbol))
            expect(public_page.locator("#galeriaInstalaciones .instalacion-tarjeta")).to_have_count(1)
            expect(public_page.locator("#galeriaInstalaciones")).to_contain_text("Imagen no disponible")
            check("Pestaña Instalaciones con filtros, ampliación de foto y estado sin fotografía")
            public_page.locator("#deporteInstalaciones").select_option("")
            public_page.set_viewport_size({"width":1440,"height":1050})
            public_page.screenshot(path=str(ARTIFACTS / "instalaciones.png"),full_page=True)
            public_page.set_viewport_size({"width":390,"height":844})
            public_page.screenshot(path=str(ARTIFACTS / "instalaciones-movil.png"),full_page=True)
            check("Galería pública adaptable a móvil", public_page.evaluate("document.documentElement.scrollWidth <= innerWidth"))

            # El registro público también debe generar QR, conservando su validación por correo.
            database.execute("""INSERT dbo.CODIGO_VERIFICACION(CORREO,CODIGO_HASH,FECHA_CREACION,FECHA_EXPIRACION,
                UTILIZADO,INTENTOS,FECHA_UTIMA_MODIFICACION,VERIFICADO)
                VALUES(?,?,GETDATE(),DATEADD(minute,10,GETDATE()),1,0,GETDATE(),1)""","registro@example.test","A"*64)
            registro = api(anon, "POST", "/api/Verificacion/registrar",
                {"nombre":"Registro","apellidoPaterno":"Web","correo":"registro@example.test","password":PASSWORD},csrf=False)
            check("Registro público conserva verificación y genera QR",
                registro["numeroError"] == 201 and database.execute("SELECT CODIGO_QR FROM dbo.USUARIO WHERE CORREO='registro@example.test'").fetchone()[0].startswith("ADS:"), registro)

            qr_antes = database.execute("SELECT CODIGO_QR FROM dbo.USUARIO WHERE ID_USUARIO=?",ana["idUsuario"]).fetchone()[0]
            aplicar(database, ROOT / "database/005_usuarios_canchas_cronograma.sql")
            aplicar(database, ROOT / "database/006_imagenes_instalaciones.sql")
            aplicar(database, ROOT / "database/008_eliminar_deportes_clases_roles.sql")
            aplicar(database, ROOT / "database/009_recuperacion_password.sql")
            qr_despues = database.execute("SELECT CODIGO_QR FROM dbo.USUARIO WHERE ID_USUARIO=?",ana["idUsuario"]).fetchone()[0]
            check("Reejecutar la migración conserva datos y códigos QR", qr_antes == qr_despues and database.execute("SELECT COUNT(*) FROM dbo.CANCHA").fetchone()[0] == 3)
            check("Reejecutar las migraciones también conserva las fotografías",
                anon.request.get(base+"/api/Cancha/"+str(central["idCancha"])+"/imagen").body() == foto_png)
            api(admin,"POST","/api/Usuario/"+str(luis["idUsuario"])+"/desactivar")
            api(profe2,"GET","/api/Entrenador/perfil",esperado=403)
            check("Desactivar un profesor revoca su acceso y libera sus clases",
                database.execute("SELECT COUNT(*) FROM dbo.CLASE WHERE ID_ENTRENADOR=? AND DISPONIBLE=1",luis["idUsuario"]).fetchone()[0] == 0)
            # Borrado físico con relaciones reales: conserva reservas, pagos y accesos.
            reserva_id = database.execute("""INSERT dbo.RESERVA(ID_USUARIO,ID_CLASE,FECHA_RESERVA,ESTATUS_RESERVA,FECHA_UTIMA_MODIFICACION)
                OUTPUT INSERTED.ID_RESERVA VALUES(?,?,GETUTCDATE(),'CONFIRMADA',GETUTCDATE())""",cliente["idUsuario"],clase1["idClase"]).fetchone()[0]
            pago_id = database.execute("""INSERT dbo.PAGO(ID_RESERVA,SUBTOTAL,IVA,MONTO_TOTAL,FECHA_PAGO,METODO_PAGO,FECHA_UTIMA_MODIFICACION)
                OUTPUT INSERTED.ID_PAGO VALUES(?,100,16,116,GETUTCDATE(),'EFECTIVO',GETUTCDATE())""",reserva_id).fetchone()[0]
            acceso_id = database.execute("""INSERT dbo.REGISTRO_ACCESO(ID_PASE,ID_STAFF,FECHA_ESCANEO,FECHA_ULTIMA_MODIFICACION)
                OUTPUT INSERTED.ID_REGISTRO VALUES(?,?,GETUTCDATE(),GETUTCDATE())""",clase1["idClase"],ana["idUsuario"]).fetchone()[0]
            database.execute("""INSERT dbo.CODIGO_VERIFICACION(ID_USUARIO,CORREO,CODIGO_HASH,FECHA_CREACION,FECHA_EXPIRACION,
                UTILIZADO,INTENTOS,FECHA_UTIMA_MODIFICACION,VERIFICADO)
                VALUES(?,?,?,GETUTCDATE(),DATEADD(minute,10,GETUTCDATE()),1,0,GETUTCDATE(),1)""",cliente["idUsuario"],cliente["correo"],"B"*64)
            api(anon,"DELETE","/api/Cancha/"+str(central_id),esperado=401)
            api(profe1,"DELETE","/api/Cancha/"+str(central_id),esperado=403)
            api(admin,"DELETE","/api/Cancha/"+str(central_id),esperado=400,csrf=False)
            api(profe1,"DELETE","/api/Usuario/"+str(cliente["idUsuario"]),esperado=403)
            api(admin,"DELETE","/api/Usuario/"+str(cliente["idUsuario"]),esperado=400,csrf=False)
            check("Borrado definitivo protegido por administrador y CSRF")
            page.goto(base+"/canchas.html",wait_until="domcontentloaded")
            expect(page.locator("#actualizarCanchas")).to_be_enabled()
            cancha_a_borrar = page.locator("#listaCanchas .admin-court-card").filter(has=page.get_by_role("heading",name="Cancha central",exact=True))
            expect(cancha_a_borrar.get_by_role("button",name="Eliminar",exact=True)).to_be_enabled()
            page.once("dialog",lambda dialog: dialog.dismiss())
            cancha_a_borrar.get_by_role("button",name="Eliminar",exact=True).click()
            check("Cancelar la confirmación conserva la cancha",database.execute("SELECT COUNT(*) FROM dbo.CANCHA WHERE ID_CANCHA=?",central_id).fetchone()[0] == 1)
            page.once("dialog",lambda dialog: dialog.accept())
            cancha_a_borrar.get_by_role("button",name="Eliminar",exact=True).click()
            expect(page.locator("#avisoCanchas")).to_contain_text("Cancha eliminada definitivamente")
            expect(page.locator("#listaCanchas")).not_to_contain_text("Cancha central")
            check("Eliminar desde Canchas borra el registro, la apertura y la imagen de SQL",
                database.execute("SELECT COUNT(*) FROM dbo.CANCHA WHERE ID_CANCHA=?",central_id).fetchone()[0] == 0
                and database.execute("SELECT COUNT(*) FROM dbo.CANCHA_APERTURA WHERE ID_CANCHA=?",central_id).fetchone()[0] == 0
                and anon.request.get(base+"/api/Cancha/"+str(central_id)+"/imagen").status == 404)
            check("Eliminar cancha desvincula sus horarios y despublica solo sus clases actuales",
                database.execute("SELECT COUNT(*) FROM dbo.HORARIO WHERE ID_CANCHA=?",central_id).fetchone()[0] == 0
                and database.execute("SELECT DISPONIBLE FROM dbo.CLASE WHERE ID_CLASE=?",clase1["idClase"]).fetchone()[0] == 0
                and database.execute("SELECT DISPONIBLE FROM dbo.CLASE WHERE ID_CLASE=?",borrador).fetchone()[0] == 1)
            check("Reservas y pagos se conservan después de eliminar la cancha",
                database.execute("SELECT COUNT(*) FROM dbo.RESERVA WHERE ID_RESERVA=?",reserva_id).fetchone()[0] == 1
                and database.execute("SELECT COUNT(*) FROM dbo.PAGO WHERE ID_PAGO=?",pago_id).fetchone()[0] == 1)
            page.goto(base+"/usuarios.html",wait_until="domcontentloaded")
            expect(page.locator("#listaUsuarios tr").filter(has_text="cliente@example.test")).to_be_visible()
            cliente_fila = page.locator("#listaUsuarios tr").filter(has_text="cliente@example.test")
            page.once("dialog",lambda dialog: dialog.accept())
            cliente_fila.get_by_role("button",name="Eliminar",exact=True).click()
            expect(page.locator("#avisoUsuarios")).to_contain_text("Usuario eliminado definitivamente")
            expect(page.locator("#listaUsuarios")).not_to_contain_text("cliente@example.test")
            check("Eliminar desde Usuarios borra cuenta, credenciales y verificación de SQL",
                database.execute("SELECT COUNT(*) FROM dbo.USUARIO WHERE ID_USUARIO=?",cliente["idUsuario"]).fetchone()[0] == 0
                and database.execute("SELECT COUNT(*) FROM dbo.[PASSWORD] WHERE ID_USUARIO=?",cliente["idUsuario"]).fetchone()[0] == 0
                and database.execute("SELECT COUNT(*) FROM dbo.CODIGO_VERIFICACION WHERE CORREO=?",cliente["correo"]).fetchone()[0] == 0)
            check("Eliminar cliente conserva su reserva y pago, desvinculando el usuario",
                database.execute("SELECT ID_USUARIO FROM dbo.RESERVA WHERE ID_RESERVA=?",reserva_id).fetchone()[0] is None
                and database.execute("SELECT ID_RESERVA FROM dbo.PAGO WHERE ID_PAGO=?",pago_id).fetchone()[0] == reserva_id)
            nuevo_cliente = api(admin,"POST","/api/Usuario",datos_usuario("Cliente nuevo","cliente@example.test",usuario_rol),esperado=201)
            check("Un correo de un usuario eliminado se puede registrar otra vez",nuevo_cliente["idUsuario"] != cliente["idUsuario"])
            api(admin,"DELETE","/api/Usuario/"+str(nuevo_cliente["idUsuario"]))
            api(admin,"DELETE","/api/Usuario/"+str(nuevo_cliente["idUsuario"]),esperado=404)
            check("Eliminar un usuario sin relaciones funciona y repetirlo informa que ya no existe")
            page.goto(base+"/empleados.html",wait_until="domcontentloaded")
            expect(page.locator("#listaUsuarios tr").filter(has_text="ana@example.test")).to_be_visible()
            page.once("dialog",lambda dialog: dialog.accept())
            page.locator("#listaUsuarios tr").filter(has_text="ana@example.test").get_by_role("button",name="Eliminar",exact=True).click()
            expect(page.locator("#avisoUsuarios")).to_contain_text("Usuario eliminado definitivamente")
            expect(page.locator("#listaUsuarios")).not_to_contain_text("ana@example.test")
            api(profe1,"GET","/api/Entrenador/perfil",esperado=403)
            check("Eliminar entrenador desde Profesores borra la cuenta y revoca su acceso",
                database.execute("SELECT COUNT(*) FROM dbo.USUARIO WHERE ID_USUARIO=?",ana["idUsuario"]).fetchone()[0] == 0)
            check("Las clases y accesos del entrenador eliminado conservan su historial",
                database.execute("SELECT ID_ENTRENADOR FROM dbo.CLASE WHERE ID_CLASE=?",borrador).fetchone()[0] is None
                and database.execute("SELECT ID_STAFF FROM dbo.REGISTRO_ACCESO WHERE ID_REGISTRO=?",acceso_id).fetchone()[0] is None
                and database.execute("SELECT COUNT(*) FROM dbo.PAGO WHERE ID_PAGO=?",pago_id).fetchone()[0] == 1)
            api(admin,"DELETE","/api/Usuario/"+str(luis["idUsuario"]))
            page.locator("#actualizarUsuarios").click()
            expect(page.locator("#sinUsuarios")).to_be_visible()
            check("También se pueden eliminar entrenadores inactivos")
            aplicar(database,ROOT/"database/007_eliminar_canchas_usuarios.sql")

            # Deportes: desactivar conserva el registro; eliminar lo borra y permite reasignar canchas.
            marta_id = api(admin,"POST","/api/Usuario",datos_usuario("Marta","marta@example.test",profesor_rol),esperado=201)["idUsuario"]
            nora_id = api(admin,"POST","/api/Usuario",datos_usuario("Nora","nora@example.test",profesor_rol),esperado=201)["idUsuario"]
            marta_ctx, nora_ctx = login_profesor("marta@example.test"), login_profesor("nora@example.test")
            datos_futbol = datos_clase("Clase a retirar",futbol_cancha,"11:00","12:00")
            datos_futbol["idDeporte"] = futbol
            clase_retirar = api(marta_ctx,"POST","/api/Entrenador/clases",datos_futbol)["idClase"]
            clase_ajena = api(nora_ctx,"POST","/api/Entrenador/clases",datos_clase("Clase ajena",secundaria,"15:00","16:00"))["idClase"]
            api(anon,"DELETE","/api/Deporte/"+str(futbol),esperado=401)
            api(marta_ctx,"DELETE","/api/Deporte/"+str(futbol),esperado=403)
            api(admin,"DELETE","/api/Deporte/"+str(futbol),esperado=400,csrf=False)
            check("Eliminar deportes exige permisos administrativos y CSRF")
            database.execute("UPDATE dbo.DEPORTE SET IMAGEN=?,IMAGEN_TIPO='image/png' WHERE ID_DEPORTE=?",foto_png,futbol)
            database.execute("UPDATE dbo.CANCHA SET IMAGEN=?,IMAGEN_TIPO='image/png' WHERE ID_CANCHA=?",foto_png,futbol_cancha)
            page.evaluate("sessionStorage.setItem('empleados_usuario',JSON.stringify({nombre:'Administración de prueba'}))")
            page.goto(base+"/deportes.html",wait_until="domcontentloaded")
            fila_tenis = page.locator("#tablaDeportesBody tr").filter(has_text="Clases de tenis")
            expect(fila_tenis.get_by_role("button",name="Desactivar",exact=True)).to_be_enabled()
            page.once("dialog",lambda dialog: dialog.accept())
            fila_tenis.get_by_role("button",name="Desactivar",exact=True).click()
            expect(page.locator("#alertaApi")).to_contain_text("desactivado")
            check("Desactivar un deporte desde su pantalla conserva su registro",
                database.execute("SELECT ACTIVO FROM dbo.DEPORTE WHERE ID_DEPORTE=?",tenis).fetchone()[0] == 0)
            fila_tenis.get_by_role("button",name="Reactivar",exact=True).click()
            expect(page.locator("#alertaApi")).to_contain_text("reactivado")
            fila_futbol = page.locator("#tablaDeportesBody tr").filter(has_text="Clases de fútbol")
            page.once("dialog",lambda dialog: dialog.dismiss())
            fila_futbol.get_by_role("button",name="Eliminar",exact=True).click()
            check("Cancelar la eliminación conserva el deporte",database.execute("SELECT COUNT(*) FROM dbo.DEPORTE WHERE ID_DEPORTE=?",futbol).fetchone()[0] == 1)
            page.once("dialog",lambda dialog: dialog.accept())
            fila_futbol.get_by_role("button",name="Eliminar",exact=True).click()
            expect(page.locator("#alertaApi")).to_contain_text("Deporte eliminado definitivamente")
            expect(page.locator("#tablaDeportesBody")).not_to_contain_text("Clases de fútbol")
            check("Eliminar desde Deportes borra físicamente el deporte y su imagen",
                database.execute("SELECT COUNT(*) FROM dbo.DEPORTE WHERE ID_DEPORTE=?",futbol).fetchone()[0] == 0
                and admin.request.get(base+"/api/Deporte/"+str(futbol)+"/imagen").status == 404)
            cancha_sin_deporte = next(c for c in api(admin,"GET","/api/Cancha?incluirInactivas=true") if c["idCancha"] == futbol_cancha)
            check("La cancha de un deporte eliminado se conserva inactiva y puede reasignarse",
                cancha_sin_deporte["idDeporte"] is None and not cancha_sin_deporte["activo"] and cancha_sin_deporte["nombreDeporte"] == "Sin deporte asignado")
            check("Las fotos de canchas sin deporte siguen disponibles solo para el administrador",
                admin.request.get(base+"/api/Cancha/"+str(futbol_cancha)+"/imagen").status == 200
                and anon.request.get(base+"/api/Cancha/"+str(futbol_cancha)+"/imagen").status == 404)
            check("Las clases de un deporte eliminado se conservan sin publicarse",
                tuple(database.execute("SELECT ID_DEPORTE,DISPONIBLE FROM dbo.CLASE WHERE ID_CLASE=?",clase_retirar).fetchone()) == (None,False))

            # Clases: el profesor solo puede borrar las propias y el administrador puede borrar cualquiera.
            api(marta_ctx,"DELETE","/api/Entrenador/clases/"+str(clase_ajena),esperado=404)
            api(anon,"DELETE","/api/Entrenador/clases/"+str(clase_retirar),esperado=401)
            api(marta_ctx,"DELETE","/api/Entrenador/clases/"+str(clase_retirar),esperado=400,csrf=False)
            api(marta_ctx,"DELETE","/api/Administracion/clases/"+str(clase_ajena),esperado=403)
            check("El profesor no puede eliminar clases ajenas ni saltar la protección CSRF")
            marta_page = marta_ctx.new_page()
            marta_page.on("pageerror",lambda error: PAGE_ERRORS.append(str(error)))
            marta_page.goto(base+"/perfilEntrenador.html",wait_until="domcontentloaded")
            clase_card = marta_page.locator(".trainer-class").filter(has=marta_page.get_by_role("heading",name="Clase a retirar",exact=True))
            expect(clase_card.get_by_role("button",name="Eliminar clase",exact=True)).to_be_enabled()
            marta_page.once("dialog",lambda dialog: dialog.accept())
            clase_card.get_by_role("button",name="Eliminar clase",exact=True).click()
            expect(marta_page.locator("#avisoEntrenador")).to_contain_text("Clase eliminada definitivamente")
            check("El entrenador puede eliminar una clase aunque su deporte ya no exista",
                database.execute("SELECT COUNT(*) FROM dbo.CLASE WHERE ID_CLASE=?",clase_retirar).fetchone()[0] == 0
                and database.execute("SELECT COUNT(*) FROM dbo.HORARIO WHERE ID_CLASE=?",clase_retirar).fetchone()[0] == 0)
            clases_admin = api(admin,"GET","/api/Administracion/clases")
            check("Administración incluye clases de profesores eliminados",
                any(c["idClase"] == clase1["idClase"] and c["entrenadorNombre"] == "Profesor eliminado" for c in clases_admin))
            historico = api(admin,"GET","/api/Administracion/cronograma?incluirNoDisponibles=true")
            check("Cronograma conserva las sesiones de profesores eliminados",
                any(c["idClase"] == clase1["idClase"] and c["idEntrenador"] is None for c in historico))
            api(admin,"DELETE","/api/Administracion/clases/"+str(clase1["idClase"]),esperado=400,csrf=False)
            page.goto(base+"/cronograma.html",wait_until="domcontentloaded")
            page.locator("#abrirClasesAgenda").click()
            clase_historica = page.locator("#listaClasesAgenda .admin-class-card").filter(has=page.get_by_role("heading",name="Tenis inicial",exact=True))
            expect(clase_historica.get_by_role("button",name="Eliminar clase",exact=True)).to_be_visible()
            page.once("dialog",lambda dialog: dialog.accept())
            clase_historica.get_by_role("button",name="Eliminar clase",exact=True).click()
            expect(page.locator("#avisoListaClases")).to_contain_text("Clase eliminada definitivamente")
            check("El administrador elimina clases desde Cronograma sin borrar reservas ni pagos",
                database.execute("SELECT COUNT(*) FROM dbo.CLASE WHERE ID_CLASE=?",clase1["idClase"]).fetchone()[0] == 0
                and database.execute("SELECT ID_CLASE FROM dbo.RESERVA WHERE ID_RESERVA=?",reserva_id).fetchone()[0] is None
                and database.execute("SELECT ID_PASE FROM dbo.REGISTRO_ACCESO WHERE ID_REGISTRO=?",acceso_id).fetchone()[0] is None
                and database.execute("SELECT COUNT(*) FROM dbo.PAGO WHERE ID_PAGO=?",pago_id).fetchone()[0] == 1)
            page.goto(base+"/empleados.html",wait_until="domcontentloaded")
            nora_fila = page.locator("#listaUsuarios tr").filter(has_text="nora@example.test")
            expect(nora_fila).to_be_visible()
            nora_fila.get_by_role("button",name="Clases",exact=True).click()
            clase_detalle = page.locator("#clasesProfesor .admin-class-card").filter(has=page.get_by_role("heading",name="Clase ajena",exact=True))
            expect(clase_detalle.get_by_role("button",name="Eliminar clase",exact=True)).to_be_visible()
            page.once("dialog",lambda dialog: dialog.accept())
            clase_detalle.get_by_role("button",name="Eliminar clase",exact=True).click()
            expect(page.locator("#clasesProfesor")).to_contain_text("todavía no tiene clases")
            check("También se eliminan clases desde el detalle del profesor",
                database.execute("SELECT COUNT(*) FROM dbo.CLASE WHERE ID_CLASE=?",clase_ajena).fetchone()[0] == 0)

            # Roles: quitar un rol conserva las cuentas asociadas y el registro público sigue funcionando.
            clase_rol = api(nora_ctx,"POST","/api/Entrenador/clases",datos_clase("Clase rol",secundaria,"16:00","17:00"))["idClase"]
            api(anon,"DELETE","/api/Rol/"+str(profesor_rol),esperado=401)
            api(marta_ctx,"DELETE","/api/Rol/"+str(profesor_rol),esperado=403)
            api(admin,"DELETE","/api/Rol/"+str(profesor_rol),esperado=400,csrf=False)
            check("Eliminar roles exige administrador y CSRF")
            page.goto(base+"/usuarios.html",wait_until="domcontentloaded")
            expect(page.locator("#abrirGestionRoles")).to_be_visible()
            page.locator("#abrirGestionRoles").click()
            card_rol = page.locator("#listaGestionRoles .admin-class-card").filter(has=page.get_by_role("heading",name="FISIOTERAPEUTA",exact=True))
            expect(card_rol.get_by_role("button",name="Eliminar",exact=True)).to_be_visible()
            page.once("dialog",lambda dialog: dialog.accept())
            card_rol.get_by_role("button",name="Eliminar",exact=True).click()
            expect(page.locator("#avisoGestionRoles")).to_contain_text("Rol eliminado definitivamente")
            check("Se pueden eliminar roles desde Usuarios",
                database.execute("SELECT COUNT(*) FROM dbo.ROL WHERE NOMBRE_ROL='FISIOTERAPEUTA'").fetchone()[0] == 0)
            card_entrenador = page.locator("#listaGestionRoles .admin-class-card").filter(has=page.get_by_role("heading",name="ENTRENADOR",exact=True))
            expect(card_entrenador.get_by_role("button",name="Eliminar",exact=True)).to_be_enabled()
            page.once("dialog",lambda dialog: dialog.accept())
            card_entrenador.get_by_role("button",name="Eliminar",exact=True).click()
            expect(card_entrenador).to_have_count(0)
            check("Eliminar un rol con usuarios reasigna sus cuentas sin borrarlas",
                database.execute("SELECT COUNT(*) FROM dbo.ROL WHERE ID_ROL=?",profesor_rol).fetchone()[0] == 0
                and database.execute("SELECT COUNT(*) FROM dbo.USUARIO WHERE ID_USUARIO IN (?,?) AND ID_ROL=?",marta_id,nora_id,usuario_rol).fetchone()[0] == 2)
            api(nora_ctx,"GET","/api/Entrenador/perfil",esperado=403)
            check("Quitar el rol de entrenador revoca su acceso y despublica sus clases",
                database.execute("SELECT DISPONIBLE FROM dbo.CLASE WHERE ID_CLASE=?",clase_rol).fetchone()[0] == 0)
            card_usuario = page.locator("#listaGestionRoles .admin-class-card").filter(has=page.get_by_role("heading",name="USUARIO",exact=True))
            expect(card_usuario.get_by_role("button",name="Eliminar",exact=True)).to_be_enabled()
            page.once("dialog",lambda dialog: dialog.accept())
            card_usuario.get_by_role("button",name="Eliminar",exact=True).click()
            expect(card_usuario).to_have_count(0)
            check("Incluso al eliminar el rol básico, los usuarios mantienen un rol válido",
                database.execute("SELECT COUNT(*) FROM dbo.ROL WHERE ID_ROL=?",usuario_rol).fetchone()[0] == 0
                and database.execute("SELECT COUNT(*) FROM dbo.USUARIO u LEFT JOIN dbo.ROL r ON r.ID_ROL=u.ID_ROL WHERE r.ID_ROL IS NULL").fetchone()[0] == 0)
            database.execute("""INSERT dbo.CODIGO_VERIFICACION(CORREO,CODIGO_HASH,FECHA_CREACION,FECHA_EXPIRACION,
                UTILIZADO,INTENTOS,FECHA_UTIMA_MODIFICACION,VERIFICADO)
                VALUES('registro.basico@example.test',?,GETUTCDATE(),DATEADD(minute,10,GETUTCDATE()),1,0,GETUTCDATE(),1)""","C"*64)
            resultado_basico = api(anon,"POST","/api/Verificacion/registrar",
                {"nombre":"Registro básico","apellidoPaterno":"Prueba","correo":"registro.basico@example.test","password":PASSWORD},csrf=False)
            check("El registro público continúa funcionando después de eliminar el rol USUARIO",resultado_basico["numeroError"] == 201)
            aplicar(database,ROOT/"database/008_eliminar_deportes_clases_roles.sql")
            aplicar(database, ROOT / "database/009_recuperacion_password.sql")
            check("Repetir la actualización no restaura deportes ni roles eliminados",
                database.execute("SELECT COUNT(*) FROM dbo.DEPORTE WHERE ID_DEPORTE=?",futbol).fetchone()[0] == 0
                and database.execute("SELECT COUNT(*) FROM dbo.ROL WHERE ID_ROL=?",profesor_rol).fetchone()[0] == 0)

            probar_recuperacion(database,browser,admin,anon,api,base,check,smtp,clave_verificacion,PASSWORD,ARTIFACTS,PAGE_ERRORS)
            aplicar(database, ROOT / "database/009_recuperacion_password.sql")
            check("Repetir la migración conserva las contraseñas recuperadas y sus códigos consumidos",
                database.execute("SELECT COUNT(*) FROM dbo.CODIGO_VERIFICACION WHERE PROPOSITO='RECUPERACION' AND VERIFICADO=1 AND UTILIZADO=1").fetchone()[0] >= 2)
            check("Sin errores JavaScript en las pantallas recorridas", not PAGE_ERRORS, PAGE_ERRORS)
            browser.close()
        (ARTIFACTS / "integration-results.json").write_text(json.dumps({"passed":len(CHECKS),"checks":CHECKS},ensure_ascii=False,indent=2),encoding="utf-8")
        print("RESULTADO:",len(CHECKS),"comprobaciones correctas.",flush=True)
    finally:
        if app:
            app.terminate()
            try:
                app.wait(timeout=10)
            except subprocess.TimeoutExpired:
                app.kill()
                app.wait(timeout=5)
        if log:
            log.close()
        if smtp:
            smtp.cerrar()
        if database:
            database.close()
        try:
            master.execute("IF DB_ID(?) IS NOT NULL BEGIN ALTER DATABASE [" + DB + "] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [" + DB + "]; END",DB)
            print("Base temporal eliminada:", DB, flush=True)
        finally:
            master.close()


if __name__ == "__main__":
    main()
