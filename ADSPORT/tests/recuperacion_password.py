"""Recuperación real con SQL y SMTP de captura en loopback; no envía correo a Internet."""
import concurrent.futures
from email import policy
from email.parser import BytesParser
import hashlib
import hmac
import json
import re
import socketserver
import threading
import time
import urllib.error
import urllib.request
from playwright.sync_api import expect


class ServidorCorreoPruebas:
    def __init__(self):
        self.mensajes = []
        self.fallar_siguiente = False
        receptor = self

        class Handler(socketserver.StreamRequestHandler):
            def handle(self):
                self.connection.settimeout(15)
                self.wfile.write(b"220 localhost SMTP de pruebas\r\n")
                while True:
                    linea = self.rfile.readline()
                    if not linea:
                        return
                    comando = linea.decode("utf-8", errors="replace").strip().upper()
                    if comando.startswith(("EHLO", "HELO")):
                        self.wfile.write(b"250-localhost\r\n250 SIZE 10485760\r\n")
                    elif comando.startswith("RCPT") and receptor.fallar_siguiente and str(receptor.fallar_siguiente).upper() in comando:
                        receptor.fallar_siguiente = False
                        self.wfile.write(b"550 Envio rechazado para probar el manejo de errores\r\n")
                    elif comando == "DATA":
                        self.wfile.write(b"354 Enviar contenido\r\n")
                        partes = []
                        while True:
                            parte = self.rfile.readline()
                            if parte in (b".\r\n", b".\n", b""):
                                break
                            partes.append(parte[1:] if parte.startswith(b"..") else parte)
                        mensaje = BytesParser(policy=policy.default).parsebytes(b"".join(partes))
                        texto = mensaje.get_body(preferencelist=("plain",))
                        receptor.mensajes.append({"para": str(mensaje["To"]), "asunto": str(mensaje["Subject"]),
                            "texto": texto.get_content() if texto else ""})
                        self.wfile.write(b"250 Guardado solo en memoria de pruebas\r\n")
                    elif comando == "QUIT":
                        self.wfile.write(b"221 Adios\r\n")
                        return
                    else:
                        self.wfile.write(b"250 OK\r\n")

        self.servidor = socketserver.ThreadingTCPServer(("127.0.0.1", 0), Handler)
        self.servidor.daemon_threads = True
        self.puerto = self.servidor.server_address[1]
        self.hilo = threading.Thread(target=self.servidor.serve_forever, daemon=True)
        self.hilo.start()

    def cerrar(self):
        self.servidor.shutdown()
        self.servidor.server_close()
        self.hilo.join(timeout=2)

    def codigo(self, correo, desde=0):
        for _ in range(200):
            for mensaje in self.mensajes[desde:]:
                if correo in mensaje["para"] and mensaje["asunto"] == "Recupera tu contraseña | ADSPORT":
                    return re.search(r"\b[0-9]{6}\b", mensaje["texto"])[0]
            time.sleep(.025)
        raise AssertionError("No se recibió el correo de recuperación de prueba.")


def probar_recuperacion(database, browser, admin, anon, api, base, check, smtp, clave, password, artifacts, page_errors):
    correo = "recuperar@example.test"
    roles = api(admin, "GET", "/api/Rol")
    rol = next(r["idRol"] for r in roles if r["nombreRol"] in ("USUARIO", "SIN ASIGNAR"))

    def nuevo(nombre, email):
        return api(admin, "POST", "/api/Usuario", {"idRol":rol,"nombre":nombre,"apellidoPaterno":"Prueba",
            "correo":email,"telefono":"","estatus":"ACTIVO","passwordInicial":password},esperado=201)["idUsuario"]

    id_usuario = nuevo("Recuperación", correo)
    original = api(admin,"GET","/api/Usuario/"+str(id_usuario))
    sesion_anterior = browser.new_context()
    api(sesion_anterior,"POST","/api/LoginUsuario/login",{"correo":correo,"password":password},csrf=False)
    check("La sesión previa a la recuperación es válida",api(sesion_anterior,"GET","/api/LoginUsuario/sesion")["autenticado"])

    def hash_codigo(email, codigo, recuperacion=True):
        return hmac.new(clave, (("recuperacion:" if recuperacion else "")+email+":"+codigo).encode(),hashlib.sha256).hexdigest().upper()

    def reset(codigo, nueva="Nueva#2026Segura!", esperado=400, email=correo, confirmar=None):
        return api(anon,"POST","/api/RecuperacionPassword/restablecer",{"correo":email,"codigo":codigo,
            "nuevaPassword":nueva,"confirmarPassword":nueva if confirmar is None else confirmar},esperado=esperado,csrf=False)

    def ultimo():
        return database.execute("""SELECT TOP(1) ID_CODIGO,CODIGO_HASH,INTENTOS,UTILIZADO,VERIFICADO FROM dbo.CODIGO_VERIFICACION
            WHERE CORREO=? AND PROPOSITO='RECUPERACION' ORDER BY FECHA_CREACION DESC,ID_CODIGO DESC""",correo).fetchone()

    def habilitar_reenvio():
        database.execute("UPDATE dbo.CODIGO_VERIFICACION SET FECHA_CREACION=DATEADD(second,-61,GETUTCDATE()) WHERE CORREO=? AND PROPOSITO='RECUPERACION'",correo)

    def solicitar():
        desde = len(smtp.mensajes)
        resultado = api(anon,"POST","/api/RecuperacionPassword/solicitar",{"correo":correo},csrf=False)
        return resultado, smtp.codigo(correo,desde)

    inexistente = api(anon,"POST","/api/RecuperacionPassword/solicitar",{"correo":"desconocido@example.test"},csrf=False)
    check("Recuperar un correo inexistente no crea códigos ni revela si la cuenta existe",
        database.execute("SELECT COUNT(*) FROM dbo.CODIGO_VERIFICACION WHERE CORREO='desconocido@example.test'").fetchone()[0] == 0)
    page = anon.new_page()
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.goto(base+"/LoginUsuario.html",wait_until="domcontentloaded")
    page.get_by_role("link",name="¿Olvidaste tu contraseña?").click()
    expect(page).to_have_url(base+"/recuperarPassword.html")
    page.locator("#correoRecuperacion").fill("RECUPERAR@example.test")
    page.locator("#enviarCodigoRecuperacion").click()
    expect(page.locator("#formRestablecerPassword")).to_be_visible()
    codigo = smtp.codigo(correo)
    codigo_id = ultimo()[0]
    check("El enlace del login envía un código al correo y reutiliza CODIGO_VERIFICACION con hash y propósito",
        ultimo()[1] == hash_codigo(correo,codigo) and ultimo()[1] != codigo
        and database.execute("SELECT ID_USUARIO FROM dbo.CODIGO_VERIFICACION WHERE ID_CODIGO=?",codigo_id).fetchone()[0] == id_usuario)
    expect(page.locator("#reenviarCodigoRecuperacion")).to_be_disabled()
    previo = len(smtp.mensajes)
    repetida = api(anon,"POST","/api/RecuperacionPassword/solicitar",{"correo":correo},csrf=False)
    check("El reenvío exige 60 segundos y da la misma respuesta que un correo desconocido",
        repetida == inexistente and ultimo()[0] == codigo_id and len(smtp.mensajes) == previo)
    page.screenshot(path=str(artifacts/"recuperacion-codigo.png"),full_page=True)
    page.set_viewport_size({"width":390,"height":844})
    expect(page.locator("#restablecerPassword")).to_be_visible()
    check("La recuperación se adapta al móvil sin desbordamiento horizontal",page.evaluate("document.documentElement.scrollWidth <= innerWidth"))
    page.screenshot(path=str(artifacts/"recuperacion-movil.png"),full_page=True)
    page.set_viewport_size({"width":1440,"height":1050})

    inactivo = nuevo("Inactivo","inactivo.recuperacion@example.test")
    api(admin,"POST","/api/Usuario/"+str(inactivo)+"/desactivar")
    sin_envio = api(anon,"POST","/api/RecuperacionPassword/solicitar",{"correo":"inactivo.recuperacion@example.test"},csrf=False)
    check("Una cuenta inactiva no recibe códigos y conserva la misma respuesta pública",sin_envio == inexistente
        and database.execute("SELECT COUNT(*) FROM dbo.CODIGO_VERIFICACION WHERE CORREO='inactivo.recuperacion@example.test'").fetchone()[0] == 0)

    codigo_registro = "000111" if codigo != "000111" else "000112"
    database.execute("""INSERT dbo.CODIGO_VERIFICACION(CORREO,CODIGO_HASH,FECHA_CREACION,FECHA_EXPIRACION,
        UTILIZADO,INTENTOS,FECHA_UTIMA_MODIFICACION,VERIFICADO,PROPOSITO)
        VALUES(?,?,GETUTCDATE(),DATEADD(minute,10,GETUTCDATE()),0,0,GETUTCDATE(),0,'REGISTRO')""",correo,hash_codigo(correo,codigo_registro,False))
    reset(codigo_registro)
    check("Un código de registro no cambia la contraseña y cada intento incorrecto queda registrado",ultimo()[2] == 1)
    intentos = ultimo()[2]
    reset(codigo,"abcdefgh")
    reset(codigo,confirmar="Distinta#2026!")
    reset("12")
    reset(codigo,"Á"*34+"a1!Aa")
    check("Contraseñas débiles, confirmación distinta, códigos mal formados y exceso de bytes se rechazan sin consumir el código",ultimo()[2] == intentos and not ultimo()[3])

    page.locator("#codigoRecuperacion").fill(codigo)
    page.locator("#nuevaPassword").fill("Nueva#2026Segura!")
    page.locator("#confirmarPassword").fill("Distinta#2026!")
    page.locator("#restablecerPassword").click()
    expect(page.locator("#mensajeRecuperacion")).to_contain_text("no coinciden")
    page.locator("#confirmarPassword").fill("Nueva#2026Segura!")
    page.locator("#restablecerPassword").click()
    expect(page.locator("#recuperacionCompletada")).to_be_visible()
    expect(page.locator("#mensajeRecuperacion")).to_contain_text("se actualizó")
    actual = api(admin,"GET","/api/Usuario/"+str(id_usuario))
    guardado = database.execute("SELECT p.[PASSWORD] FROM dbo.USUARIO u JOIN dbo.[PASSWORD] p ON p.ID_PASSWORD=u.ID_PASSWORD WHERE u.ID_USUARIO=?",id_usuario).fetchone()[0]
    check("El formulario guarda BCrypt y consume el código una sola vez sin cambiar el rol ni el QR",
        guardado.startswith("$2") and len(guardado) == 60 and guardado != "Nueva#2026Segura!"
        and actual["codigoQr"] == original["codigoQr"] and actual["idRol"] == original["idRol"] and ultimo()[3] and ultimo()[4])
    check("Recuperar la contraseña no inicia sesión automáticamente",not api(anon,"GET","/api/LoginUsuario/sesion")["autenticado"])
    check("La recuperación invalida las sesiones anteriores",not api(sesion_anterior,"GET","/api/LoginUsuario/sesion")["autenticado"])
    api(anon,"POST","/api/LoginUsuario/login",{"correo":correo,"password":password},esperado=401,csrf=False)
    api(anon,"POST","/api/LoginUsuario/login",{"correo":correo,"password":"Nueva#2026Segura!"},csrf=False)
    check("La contraseña anterior deja de funcionar y la nueva permite iniciar sesión",api(anon,"GET","/api/LoginUsuario/sesion")["autenticado"])
    reset(codigo,"Otra#2026Clave!")
    check("Reutilizar el código consumido no cambia la contraseña",database.execute("SELECT [PASSWORD] FROM dbo.[PASSWORD] WHERE ID_USUARIO=?",id_usuario).fetchone()[0] == guardado)
    for _ in range(100):
        if any(m["asunto"] == "Tu contraseña se actualizó | ADSPORT" for m in smtp.mensajes):
            break
        time.sleep(.025)
    notificacion = next(m for m in smtp.mensajes if m["asunto"] == "Tu contraseña se actualizó | ADSPORT")
    check("Se notifica el cambio por correo sin enviar la contraseña", "Nueva#2026Segura!" not in notificacion["texto"])
    page.screenshot(path=str(artifacts/"recuperacion-completada.png"),full_page=True)

    habilitar_reenvio()
    _, vencido = solicitar()
    id_vencido = ultimo()[0]
    database.execute("UPDATE dbo.CODIGO_VERIFICACION SET FECHA_EXPIRACION=DATEADD(second,-1,GETUTCDATE()) WHERE ID_CODIGO=?",id_vencido)
    reset(vencido)
    check("Los códigos vencidos no pueden usarse y quedan invalidados",ultimo()[3] and not ultimo()[4])
    habilitar_reenvio()
    _, anterior = solicitar()
    id_anterior = ultimo()[0]
    habilitar_reenvio()
    _, vigente = solicitar()
    check("Reenviar invalida el código anterior aunque todavía no haya vencido",
        database.execute("SELECT UTILIZADO FROM dbo.CODIGO_VERIFICACION WHERE ID_CODIGO=?",id_anterior).fetchone()[0]
        and ultimo()[0] != id_anterior)
    reset(anterior if anterior != vigente else ("999999" if vigente != "999999" else "888888"))
    for _ in range(4):
        reset("999999" if vigente != "999999" else "888888")
    reset(vigente)
    check("El quinto intento bloquea el código sin bloquear la cuenta del usuario",ultimo()[2] == 5 and ultimo()[3]
        and database.execute("SELECT ESTATUS FROM dbo.USUARIO WHERE ID_USUARIO=?",id_usuario).fetchone()[0] == "ACTIVO")

    habilitar_reenvio()
    desde = len(smtp.mensajes)
    def post(ruta, datos):
        req = urllib.request.Request(base+ruta,data=json.dumps(datos).encode(),headers={"Content-Type":"application/json"})
        try:
            with urllib.request.urlopen(req,timeout=15) as resp:
                return resp.status
        except urllib.error.HTTPError as error:
            return error.code
    cuenta_antes = database.execute("SELECT COUNT(*) FROM dbo.CODIGO_VERIFICACION WHERE CORREO=? AND PROPOSITO='RECUPERACION'",correo).fetchone()[0]
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        solicitudes = list(pool.map(lambda _:post("/api/RecuperacionPassword/solicitar",{"correo":correo}),range(2)))
    simultaneo = smtp.codigo(correo,desde)
    check("Solicitudes simultáneas generan un solo código y un solo correo",solicitudes == [200,200]
        and database.execute("SELECT COUNT(*) FROM dbo.CODIGO_VERIFICACION WHERE CORREO=? AND PROPOSITO='RECUPERACION'",correo).fetchone()[0] == cuenta_antes+1)
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        cambios = list(pool.map(lambda n:post("/api/RecuperacionPassword/restablecer",{"correo":correo,"codigo":simultaneo,
            "nuevaPassword":n,"confirmarPassword":n}),["Concurrente#2026A!","Concurrente#2026B!"]))
    check("Dos cambios simultáneos no reutilizan el mismo código",sorted(cambios) == [200,400])

    # Los procedimientos del registro deben ignorar los códigos de recuperación.
    registro = "registro.aislado@example.test"
    database.execute("""INSERT dbo.CODIGO_VERIFICACION(CORREO,CODIGO_HASH,FECHA_CREACION,FECHA_EXPIRACION,
        UTILIZADO,INTENTOS,FECHA_UTIMA_MODIFICACION,VERIFICADO,PROPOSITO)
        VALUES(?,?,GETUTCDATE(),DATEADD(minute,10,GETUTCDATE()),1,0,GETUTCDATE(),1,'RECUPERACION')""",registro,hash_codigo(registro,"444555"))
    datos_registro = {"nombre":"Registro aislado","apellidoPaterno":"Prueba","correo":registro,"password":password}
    no_registro = api(anon,"POST","/api/Verificacion/registrar",datos_registro,csrf=False)
    check("Un código de recuperación verificado no autoriza el registro público",no_registro["numeroError"] == 403)
    database.execute("""INSERT dbo.CODIGO_VERIFICACION(CORREO,CODIGO_HASH,FECHA_CREACION,FECHA_EXPIRACION,
        UTILIZADO,INTENTOS,FECHA_UTIMA_MODIFICACION,VERIFICADO,PROPOSITO)
        VALUES(?,?,DATEADD(minute,-2,GETUTCDATE()),DATEADD(minute,10,GETUTCDATE()),0,0,GETUTCDATE(),0,'REGISTRO')""",registro,hash_codigo(registro,"111222",False))
    reenvio = api(anon,"GET","/api/Verificacion/reenviar?correo="+registro)
    invalida = api(anon,"POST","/api/Verificacion/validar",{"correo":registro,"codigo":"444555"},csrf=False)
    valida = api(anon,"POST","/api/Verificacion/validar",{"correo":registro,"codigo":"111222"},csrf=False)
    consulta = api(anon,"GET","/api/Verificacion/consultar?correo="+registro)
    registrado = api(anon,"POST","/api/Verificacion/registrar",datos_registro,csrf=False)
    check("Verificación, reenvío, consulta y alta pública siguen usando exclusivamente códigos de registro",
        reenvio["numeroError"] == 200 and invalida["numeroError"] == 401 and valida["numeroError"] == 200
        and consulta["numeroError"] == 200 and registrado["numeroError"] == 201)

    fallo_email = "fallo.smtp@example.test"
    nuevo("Fallo SMTP",fallo_email)
    smtp.fallar_siguiente = fallo_email
    fallo = api(anon,"POST","/api/RecuperacionPassword/solicitar",{"correo":fallo_email},csrf=False)
    for _ in range(100):
        fila = database.execute("SELECT UTILIZADO FROM dbo.CODIGO_VERIFICACION WHERE CORREO=? AND PROPOSITO='RECUPERACION'",fallo_email).fetchone()
        if fila and fila[0]:
            break
        time.sleep(.025)
    check("Si falla SMTP, se invalida el código y la respuesta sigue sin revelar la cuenta",fila and fila[0] and fallo == inexistente)
    for _ in range(12):
        limitada = anon.request.post(base+"/api/RecuperacionPassword/solicitar",data={"correo":"limite@example.test"})
        if limitada.status == 429:
            break
    check("La API limita las solicitudes de correo por dirección IP",limitada.status == 429 and limitada.headers.get("retry-after") == "60")
    for _ in range(32):
        limitada_cambio = anon.request.post(base+"/api/RecuperacionPassword/restablecer",data={"correo":correo,"codigo":"x"})
        if limitada_cambio.status == 429:
            break
    check("La API limita los intentos de recuperación por dirección IP",limitada_cambio.status == 429)
    sesion_anterior.close()
    page.close()
