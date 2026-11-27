"""Compra con IVA, consentimiento, SMTP y asistencia semanal en una base temporal."""
import io
import base64
import json
import re
import time
from datetime import timedelta
from PIL import Image
from playwright.sync_api import expect
import zxingcpp


def preparar_camara(pagina, contenido):
    """Vídeo real de canvas; solo se simula el dispositivo, no la lectura QR ni las APIs."""
    pagina.add_init_script("""(() => {
        const fuente = __IMAGEN__;
        window.__qrVisible = true; window.__solicitudesCamara = []; window.__pistasPrueba = [];
        Object.defineProperty(navigator.mediaDevices, 'enumerateDevices', { value: async () => [
            { kind: 'videoinput', deviceId: 'cam-pc', label: 'Cámara PC / frontal' },
            { kind: 'videoinput', deviceId: 'cam-trasera', label: 'Cámara trasera' }
        ]});
        Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async opciones => {
            window.__solicitudesCamara.push(opciones);
            if (window.__denegarCamara) throw new DOMException('Permiso denegado', 'NotAllowedError');
            if (window.__rechazarPreferencias && typeof opciones.video === 'object') {
                window.__rechazarPreferencias = false;
                throw new DOMException('Preferencias no disponibles', 'OverconstrainedError');
            }
            if (window.__esperarPermiso) await new Promise(resolve => window.__resolverPermiso = resolve);
            const imagen = new Image(); imagen.src = fuente; await imagen.decode();
            const canvas = document.createElement('canvas'); canvas.width = imagen.width; canvas.height = imagen.height;
            const ctx = canvas.getContext('2d');
            function dibujar() { ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height); if (window.__qrVisible) ctx.drawImage(imagen, 0, 0); }
            dibujar(); const stream = canvas.captureStream(8); const pistas = stream.getTracks();
            window.__pistasPrueba.push(...pistas);
            const timer = setInterval(() => { if (pistas.every(t => t.readyState === 'ended')) clearInterval(timer); else dibujar(); }, 125);
            return stream;
        }});
    })();""".replace("__IMAGEN__",json.dumps("data:image/png;base64,"+base64.b64encode(contenido).decode())))


def probar_accesos_asistencia(db, browser, admin, anon, api, base, check, proveedor, password, artifacts, errores, smtp,
    profesor, rol_usuario, rol_entrenador, deporte):
    def cuenta(nombre, correo, rol):
        return api(admin, "POST", "/api/Usuario", {"idRol":rol,"nombre":nombre,"apellidoPaterno":"Pruebas",
            "correo":correo,"telefono":"","estatus":"ACTIVO","passwordInicial":password}, esperado=201)["idUsuario"]
    cuenta("Alumno acceso", "acceso.semanal@example.test", rol_usuario)
    cuenta("Otro entrenador", "otro.entrenador@example.test", rol_entrenador)
    alumno = browser.new_context(reduced_motion="reduce")
    otro = browser.new_context(reduced_motion="reduce")
    api(alumno, "POST", "/api/LoginUsuario/login", {"correo":"acceso.semanal@example.test","password":password}, csrf=False)
    api(otro, "POST", "/api/Entrenador/login", {"correo":"otro.entrenador@example.test","password":password})
    cancha = api(admin, "POST", "/api/Cancha", {"idDeporte":deporte,"nombre":"Accesos y asistencia","ubicacion":"Pruebas",
        "activo":True,"horarios":[{"diaSemana":dia,"horaInicio":"00:00","horaFin":"23:59"} for dia in range(1,8)]}, esperado=201)["idCancha"]
    ahora = db.execute("SELECT CONVERT(datetime2,SYSDATETIMEOFFSET() AT TIME ZONE 'Central Standard Time (Mexico)')").fetchone()[0]
    inicio_sesion = (ahora + timedelta(minutes=3)).replace(second=0, microsecond=0)
    if inicio_sesion.date() != ahora.date():
        raise RuntimeError("Ejecuta la prueba de asistencia antes de los últimos tres minutos del día.")
    fin_sesion = inicio_sesion + timedelta(minutes=10)
    segunda_sesion = fin_sesion + timedelta(minutes=1)
    fin_segunda = segunda_sesion + timedelta(minutes=10)
    if fin_segunda.date() != ahora.date():
        raise RuntimeError("La prueba necesita 25 minutos disponibles antes de terminar el día.")
    hora, fin = inicio_sesion.strftime("%H:%M"), fin_sesion.strftime("%H:%M")
    clase = api(profesor, "POST", "/api/Entrenador/clases", {"idDeporte":deporte,"idCancha":cancha,"nombreClase":"Acceso semanal confirmado",
        "descripcion":"Asistencia por QR y manual","precio":50,"cupoMaximo":5,"disponible":True,
        "horarios":[{"diaSemana":ahora.isoweekday(),"horaInicio":hora,"horaFin":fin},
            {"diaSemana":ahora.isoweekday(),"horaInicio":segunda_sesion.strftime("%H:%M"),"horaFin":fin_segunda.strftime("%H:%M")}]})["idClase"]
    quote = api(anon, "GET", f"/api/Pagos/clases/{clase}/semanas")["semanas"][0]
    policies = api(anon, "GET", "/api/Pagos/politicas")
    check("La cotización de $50 desglosa subtotal 50, IVA 8 y total 58 MXN",
        quote["subtotal"] == 50 and quote["iva"] == 8 and quote["tasaIva"] == .16 and quote["total"] == 58)
    solicitud = {"idClase":clase,"inicioSemana":quote["inicioSemana"],"precioEsperado":50,"totalEsperado":58,
        "aceptaPoliticas":True,"versionPoliticas":policies["version"]}
    reservas_antes = db.execute("SELECT COUNT(*) FROM dbo.RESERVA").fetchone()[0]
    api(alumno,"POST","/api/Pagos",dict(solicitud,aceptaPoliticas=False),esperado=400)
    api(alumno,"POST","/api/Pagos",dict(solicitud,versionPoliticas="antigua"),esperado=400)
    api(alumno,"POST","/api/Pagos",dict(solicitud,totalEsperado=50),esperado=409)
    check("No aceptar políticas, aceptar otra versión o alterar el IVA impide crear una reserva",
        db.execute("SELECT COUNT(*) FROM dbo.RESERVA").fetchone()[0] == reservas_antes)
    pendiente = api(alumno,"POST","/api/Pagos",solicitud)
    cobro, orden = pendiente["idCobro"], pendiente["ordenId"]
    api(alumno,"GET",f"/api/Pagos/{cobro}/acceso/qr",esperado=409)
    api(anon,"GET",f"/api/Pagos/{cobro}/acceso/qr",esperado=401)
    check("Un pago pendiente nunca entrega código ni QR",pendiente["codigoAcceso"] is None)
    aceptacion = db.execute("SELECT SUBTOTAL,IVA,IMPORTE,POLITICAS_VERSION,POLITICAS_ACEPTADAS_UTC FROM dbo.PAGO_MERCADOPAGO WHERE ID_COBRO=?",cobro).fetchone()
    check("La compra conserva el desglose y la fecha y versión de las políticas aceptadas",
        tuple(aceptacion[:4]) == (50,8,58,policies["version"]) and aceptacion[4] is not None)
    # El SMTP falla una vez: la inscripción y el QR deben seguir confirmados.
    smtp.fallar_siguiente = "ACCESO.SEMANAL@EXAMPLE.TEST"
    proveedor.cambiar(orden,"processed","accredited",total_paid_amount="58.00")
    proveedor.notificar(anon,base,orden)
    proveedor.notificar(anon,base,orden)
    pago = api(alumno,"GET",f"/api/Pagos/{cobro}")
    check("La acreditación inscribe automáticamente al alumno y emite pedido y acceso",
        pago["estado"] == "APROBADO" and pago["inscripcionVigente"] and len(pago["codigoAcceso"]) == 48
        and pago["codigoPedido"].startswith("ADS-") and pago["estadoAcceso"] == "VIGENTE")
    fiscal = db.execute("SELECT SUBTOTAL,IVA,MONTO_TOTAL FROM dbo.PAGO WHERE ID_PAGO=?",pago["idPago"]).fetchone()
    check("El registro PAGO conserva subtotal, IVA y total exactos",tuple(fiscal) == (50,8,58))
    qr = api(alumno,"GET",f"/api/Pagos/{cobro}/acceso/qr")
    contenido = qr.body()
    imagen = Image.open(io.BytesIO(contenido))
    decodificado = zxingcpp.read_barcode(imagen)
    check("El PNG contiene un QR legible, exclusivo de la inscripción",decodificado and decodificado.text == "ADSPORT:ACCESO:" + pago["codigoAcceso"])
    ruta_qr = artifacts/"acceso-semanal-qr.png"; ruta_qr.write_bytes(contenido)
    api(admin,"GET",f"/api/Pagos/{cobro}/acceso/qr",esperado=403)
    api(otro,"GET",f"/api/Pagos/{cobro}/acceso/qr",esperado=403)
    api(anon,"GET",f"/api/Entrenador/clases/{clase}/asistencias",esperado=401)
    api(alumno,"GET",f"/api/Entrenador/clases/{clase}/asistencias",esperado=403)
    api(otro,"GET",f"/api/Entrenador/clases/{clase}/asistencias",esperado=404)
    check("Solo el alumno propietario ve su QR y solo el entrenador asignado ve la lista")
    for _ in range(240):
        envio = db.execute("SELECT INTENTOS,ENVIADO_UTC,LEASE_ID FROM dbo.PAGO_CONFIRMACION_CORREO WHERE ID_COBRO=?",cobro).fetchone()
        if envio and envio[0] >= 1 and envio[2] is None:
            break
        time.sleep(.05)
    check("Un fallo de SMTP deja el correo pendiente sin revertir la inscripción",
        envio[0] >= 1 and envio[1] is None and api(alumno,"GET",f"/api/Pagos/{cobro}")["estado"] == "APROBADO")
    db.execute("UPDATE dbo.PAGO_CONFIRMACION_CORREO SET PROXIMO_INTENTO_UTC=SYSUTCDATETIME() WHERE ID_COBRO=?",cobro)
    for _ in range(240):
        mensajes = [m for m in smtp.mensajes if pago["codigoPedido"] in m["texto"]]
        if mensajes:
            break
        time.sleep(.05)
    check("El correo reintentado incluye pedido, clase, semana, IVA y el QR adjunto",
        len(mensajes) == 1 and pago["codigoAcceso"] in mensajes[0]["texto"] and "IVA: $8.00" in mensajes[0]["texto"]
        and "58.00" in mensajes[0]["texto"] and "Acceso semanal confirmado" in mensajes[0]["texto"]
        and mensajes[0]["adjuntos"][0]["contenido"] == contenido)
    proveedor.notificar(anon,base,orden)
    check("Avisos repetidos conservan un solo pedido, acceso y envío",
        api(alumno,"GET",f"/api/Pagos/{cobro}")["codigoAcceso"] == pago["codigoAcceso"]
        and db.execute("SELECT COUNT(*) FROM dbo.PAGO_CONFIRMACION_CORREO WHERE ID_COBRO=?",cobro).fetchone()[0] == 1
        and db.execute("SELECT COUNT(*) FROM dbo.PAGO WHERE ID_PAGO=?",pago["idPago"]).fetchone()[0] == 1)
    # Repetir 012 con una compra acreditada debe conservar pedido, fiscalidad y credencial.
    migration = (artifacts.parent / "database/012_iva_accesos_asistencia.sql").read_text(encoding="utf-8-sig")
    for batch in re.split(r"(?im)^\s*GO\s*$", migration):
        if batch.strip():
            cursor = db.cursor()
            try:
                cursor.execute(batch)
                while cursor.nextset():
                    pass
            finally:
                cursor.close()
    conservado = api(alumno,"GET",f"/api/Pagos/{cobro}")
    check("Repetir 012 conserva el total, el IVA, el pedido y el mismo QR sin programar otro correo",
        conservado["importe"] == 58 and conservado["iva"] == 8 and conservado["codigoAcceso"] == pago["codigoAcceso"]
        and conservado["codigoPedido"] == pago["codigoPedido"]
        and db.execute("SELECT COUNT(*) FROM dbo.PAGO_CONFIRMACION_CORREO WHERE ID_COBRO=?",cobro).fetchone()[0] == 1)
    compra = alumno.new_page(); compra.on("pageerror", lambda error: errores.append(str(error)))
    compra.goto(base+f"/pagos.html?cobro={cobro}", wait_until="domcontentloaded")
    expect(compra.locator("#confirmacionPago")).to_be_visible()
    expect(compra.locator("#detalleConfirmacionPago")).to_contain_text("Ya estás inscrito")
    expect(compra.locator("#qrAccesoPago")).to_have_js_property("naturalWidth",imagen.width)
    compra.screenshot(path=str(artifacts/"confirmacion-acceso-escritorio.png"),full_page=True)
    compra.set_viewport_size({"width":390,"height":844})
    check("Confirmación, pedido y QR se muestran sin desbordar en móvil",compra.evaluate("document.documentElement.scrollWidth <= innerWidth"))
    compra.screenshot(path=str(artifacts/"confirmacion-acceso-movil.png"),full_page=True)
    vista = api(profesor,"GET",f"/api/Entrenador/clases/{clase}/asistencias?inicioSemana={quote['inicioSemana']}")
    sesion = vista["sesiones"][0]
    check("El entrenador ve automáticamente al alumno pagado en la sesión correcta",sesion["puedeRegistrar"] and len(sesion["alumnos"]) == 1
        and sesion["alumnos"][0]["idCobro"] == cobro and not sesion["alumnos"][0]["presente"])
    datos_acceso = {"codigoAcceso":decodificado.text,"fecha":sesion["fecha"],"horaInicio":hora}
    api(otro,"POST",f"/api/Entrenador/clases/{clase}/acceso",datos_acceso,esperado=404)
    api(profesor,"POST",f"/api/Entrenador/clases/{clase}/acceso",dict(datos_acceso,codigoAcceso="F"*48),esperado=409)
    api(profesor,"POST",f"/api/Entrenador/clases/{clase}/acceso",dict(datos_acceso,fecha=(ahora.date()+timedelta(days=7)).isoformat()),esperado=409)
    api(profesor,"POST",f"/api/Entrenador/clases/{clase}/acceso",dict(datos_acceso,codigoAcceso="QR-DE-USUARIO"),esperado=400)
    check("Se rechazan otro entrenador, accesos ajenos, otra semana y QR de identidad")
    panel = profesor.new_page(); panel.on("pageerror", lambda error: errores.append(str(error)))
    preparar_camara(panel,contenido)
    panel.goto(base+f"/asistencia.html?idClase={clase}",wait_until="domcontentloaded")
    expect(panel.locator("#abrirCamara")).to_be_enabled()
    check("El acceso solo ofrece captura por cámara, sin archivos ni códigos escritos",
        panel.locator('input[type="file"]').count()==0 and panel.locator("#codigoQrAsistencia").count()==0)
    panel.evaluate("window.__rechazarPreferencias = true")
    panel.locator("#abrirCamara").click()
    expect(panel.locator("#resultadoAccesoAsistencia")).to_be_visible()
    expect(panel.locator("#tituloResultadoAcceso")).to_have_text("ASISTENCIA REGISTRADA")
    expect(panel.locator("#presentesAsistencia")).to_have_text("1")
    expect(panel.locator(".asistencia-estado")).to_contain_text("PRESENTE · ACCESO UTILIZADO")
    check("La cámara PC simulada usa el vídeo, lee el QR y registra presente y acceso utilizado",
        panel.evaluate("__solicitudesCamara.length===2 && __solicitudesCamara[1].video===true && __pistasPrueba.every(t=>t.readyState==='ended')"))
    parcial=api(alumno,"GET",f"/api/Pagos/{cobro}")
    check("Utilizar una sesión conserva el acceso de las otras sesiones pagadas",
        parcial["estadoUsoAcceso"]=="PARCIALMENTE_UTILIZADO" and parcial["sesionesUtilizadas"]==1
        and parcial["sesionesAcceso"][0]["estadoAcceso"]=="UTILIZADO" and not parcial["sesionesAcceso"][1]["presente"]
        and parcial["codigoAcceso"]==pago["codigoAcceso"] and parcial["estado"]=="APROBADO")
    compra.evaluate("window.dispatchEvent(new Event('focus'))")
    expect(compra.locator("#estadoUsoAccesoPago")).to_contain_text("1 de 2 sesiones")
    expect(compra.locator("#detalleQrPago")).to_be_visible()
    perfil=alumno.new_page();perfil.on("pageerror",lambda error:errores.append(str(error)))
    perfil.goto(base+"/perfilCliente.html",wait_until="domcontentloaded")
    expect(perfil.locator("#listaMisClases")).to_contain_text("1 de 2 sesiones")
    expect(perfil.locator("#listaProximasClases article")).to_have_count(1)
    check("Clases y pagos del alumno reflejan la asistencia y retiran la sesión utilizada de su agenda")
    registro_antes=db.execute("SELECT ACTUALIZADO_UTC FROM dbo.CLASE_ASISTENCIA WHERE ID_COBRO=?",cobro).fetchone()[0]
    repetido = api(profesor,"POST",f"/api/Entrenador/clases/{clase}/acceso",datos_acceso)
    check("Reescanear el QR informa acceso utilizado sin duplicar ni cambiar la hora de llegada",repetido["yaEstabaPresente"]
        and repetido["estadoAcceso"]=="UTILIZADO" and repetido["estadoAsistencia"]=="PRESENTE"
        and db.execute("SELECT COUNT(*) FROM dbo.CLASE_ASISTENCIA WHERE ID_COBRO=?",cobro).fetchone()[0] == 1
        and db.execute("SELECT ACTUALIZADO_UTC FROM dbo.CLASE_ASISTENCIA WHERE ID_COBRO=?",cobro).fetchone()[0]==registro_antes)
    panel.locator("#abrirCamara").click()
    expect(panel.locator("#tituloResultadoAcceso")).to_have_text("ACCESO YA UTILIZADO")
    expect(panel.locator("#resultadoAccesoAsistencia")).to_be_visible()
    check("Una segunda captura muestra el aviso profesional de acceso ya utilizado",
        "asistencia-resultado--repetido" in panel.locator("#resultadoAccesoAsistencia").get_attribute("class"))
    panel.once("dialog",lambda dialog:dialog.accept())
    panel.get_by_role("button",name="Retirar presencia de Alumno acceso Pruebas",exact=True).click()
    expect(panel.locator("#presentesAsistencia")).to_have_text("0")
    check("Corregir una asistencia vuelve a habilitar su acceso en SQL",
        api(alumno,"GET",f"/api/Pagos/{cobro}")["estadoUsoAcceso"]=="SIN_UTILIZAR")
    consulta=re.compile(r"/api/Entrenador/clases/"+str(clase)+r"/asistencias\?")
    panel.route(consulta,lambda ruta:ruta.fulfill(status=503,json={"respuesta":"Consulta temporalmente no disponible."}))
    panel.locator("#abrirCamara").click()
    expect(panel.locator("#tituloResultadoAcceso")).to_have_text("ASISTENCIA REGISTRADA")
    expect(panel.locator("#resultadoAccesoAsistencia")).to_be_visible()
    expect(panel.locator("#presentesAsistencia")).to_have_text("1")
    expect(panel.locator("#avisoAsistencia")).to_contain_text("La asistencia se guardó")
    check("Una consulta fallida después de registrar conserva el presente confirmado y permite actualizar")
    panel.unroute(consulta)
    panel.locator("#actualizarAsistencia").click()
    expect(panel.locator("#presentesAsistencia")).to_have_text("1")
    panel.reload(wait_until="domcontentloaded")
    expect(panel.locator("#presentesAsistencia")).to_have_text("1")
    check("La asistencia y el acceso utilizado permanecen al recargar desde SQL",
        db.execute("SELECT COUNT(*) FROM dbo.CLASE_ASISTENCIA WHERE ID_COBRO=?",cobro).fetchone()[0]==1)
    panel.screenshot(path=str(artifacts/"asistencia-escritorio.png"),full_page=True)
    panel.evaluate("window.__denegarCamara=true")
    panel.locator("#abrirCamara").click()
    expect(panel.locator("#avisoAsistencia")).to_contain_text("Permite el acceso a la cámara")
    expect(panel.locator("#abrirCamara")).to_be_enabled()
    check("Un permiso denegado permite reintentar la cámara sin ofrecer archivos")
    panel.evaluate("Object.defineProperty(window,'isSecureContext',{value:false,configurable:true})")
    panel.locator("#abrirCamara").click()
    expect(panel.locator("#avisoAsistencia")).to_contain_text("HTTPS")
    check("La captura explica la conexión segura necesaria para el celular")
    panel.evaluate("Object.defineProperty(window,'isSecureContext',{value:true,configurable:true});window.__denegarCamara=false;window.__esperarPermiso=true")
    panel.locator("#abrirCamara").click()
    panel.wait_for_function("typeof window.__resolverPermiso==='function'")
    panel.locator("#cerrarCamara").click()
    panel.evaluate("window.__resolverPermiso()")
    panel.wait_for_function("window.__pistasPrueba.length>0 && window.__pistasPrueba.every(t=>t.readyState==='ended')")
    check("Cancelar mientras se concede el permiso cierra también la cámara que llega tarde")
    movil=browser.new_context(storage_state=profesor.storage_state(),viewport={"width":390,"height":844},is_mobile=True,has_touch=True,reduced_motion="reduce")
    captura=movil.new_page();captura.on("pageerror",lambda error:errores.append(str(error)))
    preparar_camara(captura,contenido)
    captura.goto(base+f"/asistencia.html?idClase={clase}",wait_until="domcontentloaded")
    expect(captura.locator("#sesionAsistencia")).to_be_enabled()
    captura.locator("#sesionAsistencia").select_option("1")
    captura.evaluate("window.__qrVisible=false")
    captura.locator("#abrirCamara").click()
    expect(captura.locator("#selectorCamaraAsistencia")).to_be_visible()
    captura.locator("#camaraAsistencia").select_option("cam-trasera")
    captura.wait_for_function("__solicitudesCamara.some(s=>s.video?.deviceId?.exact==='cam-trasera') && __pistasPrueba.length>=2")
    expect(captura.locator("#camaraAsistencia")).to_have_value("cam-trasera")
    check("El selector móvil cambia de cámara y libera la anterior",captura.evaluate("__pistasPrueba[0].readyState==='ended'"))
    captura.screenshot(path=str(artifacts/"captura-camara-movil.png"),full_page=True)
    captura.evaluate("window.__qrVisible=true")
    expect(captura.locator("#resultadoAccesoAsistencia")).to_be_visible()
    expect(captura.locator("#presentesAsistencia")).to_have_text("1")
    completo=api(alumno,"GET",f"/api/Pagos/{cobro}")
    check("La cámara simulada en móvil registra la otra sesión y completa el acceso semanal",
        completo["estadoUsoAcceso"]=="UTILIZADO" and completo["sesionesUtilizadas"]==2
        and all(s["presente"] for s in completo["sesionesAcceso"])
        and captura.evaluate("__pistasPrueba.every(t=>t.readyState==='ended')"))
    compra.evaluate("window.dispatchEvent(new Event('focus'))")
    expect(compra.locator("#tituloConfirmacionPago")).to_have_text("ASISTENCIA COMPLETADA")
    expect(compra.locator("#estadoUsoAccesoPago")).to_contain_text("Acceso utilizado")
    expect(compra.locator("#detalleQrPago")).not_to_be_visible()
    perfil.evaluate("window.dispatchEvent(new Event('focus'))")
    expect(perfil.locator("#listaMisClases")).to_contain_text("ACCESO UTILIZADO · ASISTENCIA COMPLETADA")
    check("Al completar las sesiones el alumno ve asistencia completada y deja de mostrar el QR")
    compra.screenshot(path=str(artifacts/"acceso-utilizado-alumno-movil.png"),full_page=True)
    check("La lista, los resultados y el lector de asistencia caben en móvil",captura.evaluate("document.documentElement.scrollWidth <= innerWidth"))
    captura.screenshot(path=str(artifacts/"asistencia-movil.png"),full_page=True)
    movil.close()
    # Caducar la inscripción en la base de pruebas comprueba el límite del servidor.
    semana = ahora.date()-timedelta(days=ahora.weekday())
    db.execute("UPDATE dbo.RESERVA SET SEMANA_INICIO=?,SEMANA_FIN=? WHERE ID_RESERVA=(SELECT ID_RESERVA FROM dbo.PAGO_MERCADOPAGO WHERE ID_COBRO=?)",
        semana-timedelta(days=7),semana-timedelta(days=1),cobro)
    caducado = api(alumno,"GET",f"/api/Pagos/{cobro}")
    api(alumno,"GET",f"/api/Pagos/{cobro}/acceso/qr",esperado=409)
    api(profesor,"POST",f"/api/Entrenador/clases/{clase}/acceso",datos_acceso,esperado=409)
    check("El acceso caduca por semana tanto en la cuenta como al validar el QR",caducado["estadoAcceso"] == "VENCIDO" and caducado["codigoAcceso"] is None)
    db.execute("UPDATE dbo.RESERVA SET SEMANA_INICIO=?,SEMANA_FIN=? WHERE ID_RESERVA=(SELECT ID_RESERVA FROM dbo.PAGO_MERCADOPAGO WHERE ID_COBRO=?)",
        semana,semana+timedelta(days=6),cobro)
    proveedor.cambiar(orden,"refunded","refunded",total_paid_amount="0.00")
    proveedor.notificar(anon,base,orden)
    api(alumno,"GET",f"/api/Pagos/{cobro}/acceso/qr",esperado=409)
    api(profesor,"POST",f"/api/Entrenador/clases/{clase}/acceso",datos_acceso,esperado=409)
    revocado = api(profesor,"GET",f"/api/Entrenador/clases/{clase}/asistencias")["sesiones"][0]["alumnos"][0]
    check("Un reembolso revoca el QR y conserva la asistencia histórica",not revocado["accesoActivo"] and revocado["presente"])
    alumno.close(); otro.close()
