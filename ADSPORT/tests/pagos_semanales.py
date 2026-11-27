"""Orders API simulada en loopback. Se ejecuta desde integracion_club.py, sin cobros externos."""
from __future__ import annotations
import copy
import concurrent.futures
import hashlib
import hmac
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import re
import threading
import time
import uuid
import urllib.request
import urllib.error
from pathlib import Path
from datetime import datetime, timedelta, timezone
from urllib.parse import quote
from playwright.sync_api import expect
from accesos_asistencia import probar_accesos_asistencia


class ServidorMercadoPagoPruebas:
    token = "APP_USR-SOLO-LOCAL-FICTICIO"
    secreto = "firma-ficticia-exclusiva-de-pruebas-locales"
    vendedor = "987654321"

    def __init__(self):
        self.lock = threading.Lock()
        self.ordenes = {}
        self.claves = {}
        self.peticiones = []
        self.fallar_despues_crear = False
        proveedor = self

        class Handler(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"
            def handle(self):
                try:
                    super().handle()
                except (ConnectionResetError, BrokenPipeError):
                    pass  # Cierre normal de conexiones HTTP al detener la API temporal.
            def log_message(self, *_):
                pass

            def responder(self, estado, datos):
                cuerpo = json.dumps(datos).encode()
                self.send_response(estado)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(cuerpo)))
                self.end_headers()
                self.wfile.write(cuerpo)

            def autorizado(self):
                if self.headers.get("Authorization") != "Bearer " + proveedor.token:
                    self.responder(401, {})
                    return False
                return True

            def do_POST(self):
                if not self.autorizado():
                    return
                if self.path != "/v1/orders":
                    self.responder(404, {})
                    return
                if self.headers.get("Transfer-Encoding", "").lower() == "chunked":
                    partes = []
                    while True:
                        longitud = int(self.rfile.readline().split(b";",1)[0].strip(),16)
                        if not longitud:
                            self.rfile.readline()
                            break
                        partes.append(self.rfile.read(longitud)); self.rfile.read(2)
                    cuerpo = b"".join(partes)
                else:
                    cuerpo = self.rfile.read(int(self.headers.get("Content-Length", "0")))
                datos = json.loads(cuerpo)
                clave = self.headers.get("X-Idempotency-Key", "")
                uuid.UUID(clave)
                assert datos["type"] == "online" and datos["processing_mode"] == "manual"
                assert isinstance(datos["total_amount"], str)
                assert datos["total_amount"] == datos["items"][0]["unit_price"]
                with proveedor.lock:
                    proveedor.peticiones.append((clave, copy.deepcopy(datos)))
                    if clave in proveedor.claves:
                        identificador, anterior = proveedor.claves[clave]
                        if anterior != datos:
                            self.responder(409, {"message": "Cuerpo distinto con la misma clave"})
                            return
                    else:
                        identificador = "ORDTST" + uuid.uuid4().hex.upper()
                        proveedor.claves[clave] = (identificador, copy.deepcopy(datos))
                        proveedor.ordenes[identificador] = {
                            "id": identificador, "type": "online", "processing_mode": "manual",
                            # La respuesta real de una orden recién creada puede omitir ambos campos:
                            # status_detail y total_paid_amount todavía no tienen un pago que describir.
                            "status": "created", "external_reference": datos["external_reference"],
                            "total_amount": datos["total_amount"], "currency": "MXN", "country_code": "MEX",
                            "user_id": proveedor.vendedor, "live_mode": False,
                            "checkout_url": "https://www.mercadopago.com.mx/checkout/v1/redirect?order_id=" + identificador,
                            "last_updated_date": proveedor.fecha(),
                        }
                    orden = copy.deepcopy(proveedor.ordenes[identificador])
                    fallo = proveedor.fallar_despues_crear
                    proveedor.fallar_despues_crear = False
                self.responder(503 if fallo else 201, {} if fallo else orden)

            def do_GET(self):
                if not self.autorizado():
                    return
                with proveedor.lock:
                    orden = copy.deepcopy(proveedor.ordenes.get(self.path.removeprefix("/v1/orders/")))
                self.responder(200 if orden else 404, orden or {})

        self.servidor = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.url = "http://127.0.0.1:" + str(self.servidor.server_port)
        self.hilo = threading.Thread(target=self.servidor.serve_forever, daemon=True)
        self.hilo.start()

    @staticmethod
    def fecha():
        # La API real puede devolver nueve cifras decimales de segundo.
        return datetime.now(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "000Z")

    def cambiar(self, identificador, estado, detalle, **otros):
        with self.lock:
            orden = self.ordenes[identificador]
            orden.update(status=estado, status_detail=detalle, last_updated_date=self.fecha(), **otros)

    def notificar(self, ctx, base, identificador, valida=True, cuerpo=None, esperado=200):
        marca = str(int(time.time() * 1000))
        solicitud = uuid.uuid4().hex
        manifest = f"id:{identificador};request-id:{solicitud};ts:{marca};"
        firma = hmac.new(self.secreto.encode(), manifest.encode(), hashlib.sha256).hexdigest() if valida else "0" * 64
        respuesta = ctx.request.post(base + "/api/Pagos/mercadopago/webhook?type=order&data.id=" + quote(identificador),
            headers={"x-request-id": solicitud, "x-signature": "ts=" + marca + ",v1=" + firma},
            data=cuerpo or {"type": "order", "data": {"id": identificador}})
        assert respuesta.status == esperado, (respuesta.status, respuesta.text()[:600])
        return respuesta

    def cerrar(self):
        self.servidor.shutdown()
        self.servidor.server_close()
        self.hilo.join(timeout=3)


def probar_pagos(db, browser, admin, anon, api, base, check, proveedor, password, artifacts, errores, smtp):
    def simultaneos(contextos, solicitud):
        preparados=[]
        for ctx in contextos:
            token=ctx.request.get(base+"/api/Auth/csrf").json()["token"]
            cookies="; ".join(k["name"]+"="+k["value"] for k in ctx.cookies([base]))
            preparados.append({"Cookie":cookies,"X-CSRF-TOKEN":token,"Content-Type":"application/json"})
        def ejecutar(headers):
            request=urllib.request.Request(base+"/api/Pagos",data=json.dumps(solicitud).encode(),headers=headers,method="POST")
            try:
                with urllib.request.urlopen(request,timeout=20) as r: return r.status,json.load(r)
            except urllib.error.HTTPError as e: return e.code,json.load(e)
        with concurrent.futures.ThreadPoolExecutor(max_workers=len(preparados)) as pool:
            return list(pool.map(ejecutar,preparados))
    # Datos propios: la suite previa puede haber eliminado los roles originales.
    def rol(nombre):
        fila = db.execute("SELECT TOP(1) ID_ROL FROM dbo.ROL WHERE NOMBRE_ROL=?", nombre).fetchone()
        return fila[0] if fila else db.execute("INSERT dbo.ROL(NOMBRE_ROL) OUTPUT INSERTED.ID_ROL VALUES(?)", nombre).fetchone()[0]
    entrenador_rol, usuario_rol = rol("ENTRENADOR"), rol("USUARIO")
    deporte = db.execute("INSERT dbo.DEPORTE(NOMBRE_DEPORTE,ACTIVO) OUTPUT INSERTED.ID_DEPORTE VALUES('Pagos semanales',1)").fetchone()[0]
    usuarios = []
    contextos = []
    for i, nombre in enumerate(("Profesor pagos", "Comprador A", "Comprador B", "Comprador C")):
        correo = "pago" + str(i) + "@example.test"
        usuario = api(admin, "POST", "/api/Usuario", {"idRol": entrenador_rol if i == 0 else usuario_rol,
            "nombre": nombre, "apellidoPaterno": "Pruebas", "apellidoMaterno": "", "correo": correo,
            "telefono": "", "estatus": "ACTIVO", "passwordInicial": password}, esperado=201)["idUsuario"]
        ctx = browser.new_context(reduced_motion="reduce", viewport={"width":1440,"height":1050})
        api(ctx, "POST", "/api/Entrenador/login" if i == 0 else "/api/LoginUsuario/login",
            {"correo":correo,"password":password}, csrf=i == 0)
        usuarios.append(usuario); contextos.append(ctx)
    profesor, a, b, c = contextos
    cancha = api(admin, "POST", "/api/Cancha", {"idDeporte":deporte,"nombre":"Cancha pagos","ubicacion":"Club de prueba","activo":True,
        "horarios":[{"diaSemana":1,"horaInicio":"08:00","horaFin":"20:00"},{"diaSemana":5,"horaInicio":"08:00","horaFin":"20:00"}]},esperado=201)["idCancha"]
    clase_datos = {"idDeporte":deporte,"idCancha":cancha,"nombreClase":"Clase semanal de prueba","descripcion":"Dos sesiones por semana",
        "precio":100,"cupoMaximo":2,"disponible":True,"horarios":[{"diaSemana":1,"horaInicio":"09:00","horaFin":"10:00"},{"diaSemana":5,"horaInicio":"09:00","horaFin":"10:00"}]}
    clase = api(profesor, "POST", "/api/Entrenador/clases", clase_datos)["idClase"]
    cruzado=browser.new_context(reduced_motion="reduce")
    api(cruzado,"POST","/api/LoginUsuario/login",{"correo":"pago0@example.test","password":password},esperado=403,csrf=False)
    check("Un profesor no puede autenticarse en el login de usuarios",not api(cruzado,"GET","/api/LoginUsuario/sesion")["autenticado"]
        and not any(k["name"]=="ADSPORT.Auth" for k in cruzado.cookies()))
    api(cruzado,"POST","/api/Entrenador/login",{"correo":"pago1@example.test","password":password},esperado=403)
    check("Un usuario no puede autenticarse en el login de profesores",not api(cruzado,"GET","/api/LoginUsuario/sesion")["autenticado"])
    api(a,"GET","/api/Entrenador/clases",esperado=403)
    api(profesor,"GET","/api/Pagos",esperado=403)
    check("Los paneles y pagos respetan la separación de usuario y profesor",api(a,"GET","/api/LoginUsuario/sesion")["esUsuario"]
        and api(profesor,"GET","/api/LoginUsuario/sesion")["esEntrenador"])
    acceso=cruzado.new_page(); acceso.on("pageerror",lambda e: errores.append(str(e)))
    acceso.goto(base+"/LoginUsuario.html",wait_until="domcontentloaded")
    acceso.locator("#correo").fill("pago0@example.test"); acceso.locator("#password").fill(password); acceso.locator("#btnLogin").click()
    expect(acceso.locator("#mensajeLogin")).to_contain_text("cuenta es de profesor")
    expect(acceso).to_have_url(base+"/LoginUsuario.html")
    acceso.goto(base+"/loginEntrenador.html",wait_until="domcontentloaded")
    acceso.locator("#correoEntrenador").fill("pago1@example.test"); acceso.locator("#passwordEntrenador").fill(password); acceso.locator("#btnLoginEntrenador").click()
    expect(acceso.locator("#mensajeLoginEntrenador")).to_contain_text("cuenta de entrenador")
    expect(acceso).to_have_url(base+"/loginEntrenador.html")
    check("Ambos formularios muestran el error de rol y permanecen en su login")
    # Reproduce el 503: una base actualizada hasta 008/009 no admite @ModoPrueba.
    vigente=db.execute("SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.ENTRENADOR_CLASES_CONSULTAR'))").fetchone()[0]
    vigente=re.sub(r"\bCREATE(?:\s+OR\s+ALTER)?\s+PROC(?:EDURE)?\b","CREATE OR ALTER PROCEDURE",vigente,count=1,flags=re.I)
    anterior=re.search(r"CREATE OR ALTER PROCEDURE dbo\.ENTRENADOR_CLASES_CONSULTAR\b.*?(?=^GO\s*$)",
        (Path(__file__).resolve().parents[1]/"database/008_eliminar_deportes_clases_roles.sql").read_text(encoding="utf-8-sig"),re.S|re.M).group(0)
    try:
        db.execute(anterior).close()
        check("Consultar clases funciona con el procedimiento anterior a pagos sin devolver 503",
            any(x["idClase"]==clase for x in api(profesor,"GET","/api/Entrenador/clases"))
            and any(x["idClase"]==clase for x in api(anon,"GET","/api/Clases")))
        acceso.locator("#correoEntrenador").fill("pago0@example.test"); acceso.locator("#passwordEntrenador").fill(password); acceso.locator("#btnLoginEntrenador").click()
        expect(acceso).to_have_url(base+"/perfilEntrenador.html")
        expect(acceso.locator("#listaClasesEntrenador")).to_contain_text("Clase semanal de prueba")
        check("El profesor entra por su formulario y carga clases con la firma SQL anterior")
    finally:
        db.execute(vigente).close()
    cruzado.close()
    cotizacion = api(anon, "GET", f"/api/Pagos/clases/{clase}/semanas")
    estado = api(anon, "GET", "/api/Pagos/estado")
    check("Checkout Pro habilitado en pruebas con credenciales APP_USR",
        estado["habilitado"] and estado["modoPrueba"] and not estado["mensaje"])
    semanas = cotizacion["semanas"]
    inicio = semanas[1]["inicioSemana"]
    politicas = api(anon, "GET", "/api/Pagos/politicas")
    solicitud = {"idClase":clase,"inicioSemana":inicio,"precioEsperado":100,"totalEsperado":116,
        "aceptaPoliticas":True,"versionPoliticas":politicas["version"],"importe":1,"idUsuario":usuarios[3]}
    check("Cotización semanal de cuatro lunes a domingo, MXN y prueba",cotizacion["habilitado"] and cotizacion["modoPrueba"]
        and len(semanas) == 4 and len(semanas[1]["horarios"]) == 2 and semanas[1]["cuposDisponibles"] == 2
        and (datetime.fromisoformat(semanas[1]["finSemana"])-datetime.fromisoformat(inicio)).days == 6)
    api(anon,"GET","/api/Pagos",esperado=401)
    api(admin,"POST","/api/Pagos",solicitud,esperado=403)
    api(a,"POST","/api/Pagos",solicitud,esperado=400,csrf=False)
    api(a,"POST","/api/Pagos",dict(solicitud,precioEsperado=.01),esperado=409)
    api(a,"POST","/api/Pagos",dict(solicitud,inicioSemana=(datetime.fromisoformat(inicio)+timedelta(days=1)).date().isoformat()),esperado=400)
    api(a,"POST","/api/Pagos",dict(solicitud,inicioSemana=(datetime.fromisoformat(inicio)+timedelta(days=28)).date().isoformat()),esperado=400)
    check("Crear pagos exige usuario SQL, sesión, CSRF, tarifa vigente y una semana válida")
    paralelos=simultaneos([a,a],solicitud)
    assert all(r[0]==200 for r in paralelos),paralelos
    pago_a=paralelos[0][1]
    check("Dos inicios simultáneos del mismo comprador comparten cobro y orden",paralelos[0][1]["idCobro"]==paralelos[1][1]["idCobro"]
        and paralelos[0][1]["ordenId"]==paralelos[1][1]["ordenId"] and len(proveedor.claves)==1)
    cobro_a, orden_a = pago_a["idCobro"], pago_a["ordenId"]
    check("Una orden creada sin total_paid_amount guarda el checkout pendiente y cero pagado",
        pago_a["estado"] == "PENDIENTE" and pago_a["puedeContinuar"] and pago_a["idPago"] is None
        and db.execute("SELECT TOTAL_PAGADO FROM dbo.PAGO_MERCADOPAGO WHERE ID_COBRO=?", cobro_a).fetchone()[0] == 0)
    with proveedor.lock:
        proveedor.ordenes[orden_a]["total_paid_amount"] = None
    actualizado = api(a, "POST", "/api/Pagos/" + cobro_a + "/actualizar")
    check("Una orden creada con total_paid_amount nulo también conserva su enlace sin aprobarse",
        actualizado["estado"] == "PENDIENTE" and actualizado["urlCheckout"] == pago_a["urlCheckout"] and actualizado["idPago"] is None)
    with proveedor.lock:
        proveedor.ordenes[orden_a].pop("total_paid_amount")
    for cambio in ({"total_amount": None}, {"total_amount": ""}, {"total_paid_amount": ""},
        {"total_paid_amount": "-0.01"}, {"total_paid_amount": "0.001"},
        {"status": "processed", "status_detail": "accredited"},
        {"status": "processed", "status_detail": "accredited", "total_paid_amount": None}):
        with proveedor.lock:
            guardado = copy.deepcopy(proveedor.ordenes[orden_a]); proveedor.ordenes[orden_a].update(cambio)
        proveedor.notificar(anon, base, orden_a, esperado=503)
        with proveedor.lock:
            proveedor.ordenes[orden_a] = guardado
    check("Importes inválidos y aprobaciones sin importe pagado se rechazan sin registrar un PAGO",
        api(a, "GET", "/api/Pagos/" + cobro_a)["estado"] == "PENDIENTE"
        and db.execute("SELECT COUNT(*) FROM dbo.PAGO WHERE ID_RESERVA=(SELECT ID_RESERVA FROM dbo.PAGO_MERCADOPAGO WHERE ID_COBRO=?)", cobro_a).fetchone()[0] == 0)
    repetido = api(a,"POST","/api/Pagos",solicitud)
    check("Repetir la compra reutiliza orden y reserva; el importe y comprador los decide SQL",repetido["idCobro"]==cobro_a
        and pago_a["importe"] == 116 and db.execute("SELECT ID_USUARIO FROM dbo.RESERVA r JOIN dbo.PAGO_MERCADOPAGO p ON p.ID_RESERVA=r.ID_RESERVA WHERE ID_COBRO=?",cobro_a).fetchone()[0]==usuarios[1]
        and len(proveedor.claves)==1 and pago_a["idPago"] is None)
    api(b,"GET","/api/Pagos/"+cobro_a,esperado=404)
    api(b,"POST","/api/Pagos/"+cobro_a+"/actualizar",esperado=404)
    check("Historial y actualización de un pago están aislados por usuario",api(b,"GET","/api/Pagos")==[]
        and "correo" not in pago_a and "urlRetorno" not in pago_a and "vigenciaSegundos" not in pago_a)
    proveedor.notificar(anon,base,orden_a,valida=False,esperado=401)
    proveedor.notificar(anon,base,orden_a,cuerpo={"status":"processed","status_detail":"accredited","total_amount":"1.00"})
    check("Firma falsa rechazada y cuerpo de webhook ignorado; manda la consulta canónica",api(a,"GET","/api/Pagos/"+cobro_a)["estado"]=="PENDIENTE"
        and db.execute("SELECT COUNT(*) FROM dbo.PAGO_MERCADOPAGO WHERE ID_COBRO=? AND ID_PAGO IS NOT NULL",cobro_a).fetchone()[0]==0)
    pagina = a.new_page(); pagina.on("pageerror",lambda e: errores.append(str(e)))
    pagina.goto(base+"/pagos.html?cobro="+cobro_a+"&status=approved",wait_until="domcontentloaded")
    expect(pagina.locator(".pago-estado")).to_contain_text("Pendiente")
    check("Un retorno manipulado con status=approved no confirma la inscripción",api(a,"GET","/api/Pagos/"+cobro_a)["idPago"] is None)
    proveedor.cambiar(orden_a,"processed","accredited",total_paid_amount="116.00")
    proveedor.notificar(anon,base,orden_a)
    proveedor.notificar(anon,base,orden_a)
    aprobado = api(a,"GET","/api/Pagos/"+cobro_a)
    check("Aprobación firmada e idempotente crea un solo PAGO y confirma la semana",aprobado["estado"]=="APROBADO" and aprobado["inscripcionVigente"]
        and db.execute("SELECT COUNT(*) FROM dbo.PAGO WHERE ID_RESERVA=(SELECT ID_RESERVA FROM dbo.PAGO_MERCADOPAGO WHERE ID_COBRO=?)",cobro_a).fetchone()[0]==1)
    with proveedor.lock:
        anterior=copy.deepcopy(proveedor.ordenes[orden_a])
        proveedor.ordenes[orden_a].update(status="created",status_detail="created",last_updated_date="2020-01-01T00:00:00Z",total_paid_amount="0.00")
    proveedor.notificar(anon,base,orden_a)
    check("Una notificación antigua no revierte una aprobación",api(a,"GET","/api/Pagos/"+cobro_a)["estado"]=="APROBADO")
    with proveedor.lock: proveedor.ordenes[orden_a]=anterior
    pagina.goto(base+"/perfilCliente.html",wait_until="domcontentloaded")
    expect(pagina.locator("#listaMisClases")).to_contain_text("Clase semanal de prueba")
    expect(pagina.locator("#listaProximasClases")).to_contain_text("Cancha pagos")
    check("Perfil muestra inscripciones verificadas y agenda con cancha")
    pagina.goto(base+f"/pagos.html?idClase={clase}",wait_until="domcontentloaded")
    expect(pagina.locator("#totalPago")).to_contain_text("116.00")
    expect(pagina.locator("#subtotalPago")).to_contain_text("100.00")
    expect(pagina.locator("#ivaPago")).to_contain_text("16.00")
    expect(pagina.locator("#modoPago")).to_have_count(0)
    expect(pagina.locator(".pago-estado")).to_contain_text("aprobado")
    check("Pantalla de compra muestra tarifa, semana y dos sesiones sin pedir tarjeta",pagina.locator("#sesionesPago li").count()==2
        and pagina.locator('input[type="password"],input[autocomplete="cc-number"]').count()==0)
    pagina.screenshot(path=str(artifacts/"pagos-escritorio.png"),full_page=True)
    pagina.set_viewport_size({"width":390,"height":844})
    check("Compra e historial caben en pantalla móvil",pagina.evaluate("document.documentElement.scrollWidth <= innerWidth"))
    pagina.screenshot(path=str(artifacts/"pagos-movil.png"),full_page=True)

    # El estado del proveedor debe explicarse; una semana válida no queda con un botón inerte.
    indisponible=a.new_page(); indisponible.on("pageerror",lambda e: errores.append(str(e)))
    def sin_configurar(route):
        respuesta=route.fetch(); datos=respuesta.json(); datos["habilitado"]=False
        datos["mensaje"]="El club todavía no ha habilitado los pagos con Mercado Pago."
        route.fulfill(response=respuesta,json=datos)
    indisponible.route("**/api/Pagos/clases/*/semanas",sin_configurar)
    indisponible.route("**/api/Pagos/estado",lambda route:route.fulfill(json={"habilitado":False,"modoPrueba":True,
        "mensaje":"El club todavía no ha habilitado los pagos con Mercado Pago."}))
    indisponible.goto(base+f"/pagos.html?idClase={clase}",wait_until="domcontentloaded")
    expect(indisponible.locator("#semanaPago")).to_be_enabled()
    indisponible.locator("#semanaPago").select_option(semanas[2]["inicioSemana"])
    expect(indisponible.locator("#btnPagarClase")).to_be_enabled()
    ordenes_antes=len(proveedor.claves)
    indisponible.locator("#btnPagarClase").click()
    expect(indisponible.locator("#avisoPagos")).to_contain_text("todavía no ha habilitado")
    check("Elegir una semana permite consultar el bloqueo de Mercado Pago sin crear cobros",len(proveedor.claves)==ordenes_antes)
    indisponible.close()

    pago_b = api(b,"POST","/api/Pagos",solicitud)
    cobro_b, orden_b = pago_b["idCobro"],pago_b["ordenId"]
    api(c,"POST","/api/Pagos",solicitud,esperado=409)
    check("Pagos pendientes reservan cupo en su semana y evitan sobreventa",api(anon,"GET",f"/api/Pagos/clases/{clase}/semanas")["semanas"][1]["cuposDisponibles"]==0
        and api(anon,"GET",f"/api/Pagos/clases/{clase}/semanas")["semanas"][2]["cuposDisponibles"]==2)
    api(profesor,"PUT",f"/api/Entrenador/clases/{clase}",dict(clase_datos,cupoMaximo=1),esperado=409)
    check("Editar una clase respeta los cupos comprometidos de semanas futuras")
    for cambio in ({"total_amount":"0.01"},{"currency":"USD"},{"live_mode":True},{"user_id":"otro-vendedor"}):
        with proveedor.lock:
            guardado=copy.deepcopy(proveedor.ordenes[orden_b]); proveedor.ordenes[orden_b].update(cambio)
        proveedor.notificar(anon,base,orden_b,esperado=503)
        with proveedor.lock: proveedor.ordenes[orden_b]=guardado
    check("Se rechazan importes, moneda, entorno y vendedor incompatibles",api(b,"GET","/api/Pagos/"+cobro_b)["idPago"] is None)
    proveedor.cambiar(orden_b,"failed","rejected_by_issuer",total_paid_amount="0.00")
    proveedor.notificar(anon,base,orden_b)
    check("Rechazo libera el cupo y conserva el intento",api(b,"GET","/api/Pagos/"+cobro_b)["estado"]=="RECHAZADO"
        and api(anon,"GET",f"/api/Pagos/clases/{clase}/semanas")["semanas"][1]["cuposDisponibles"]==1)
    pago_c=api(c,"POST","/api/Pagos",solicitud)
    proveedor.cambiar(pago_c["ordenId"],"canceled","canceled",total_paid_amount="0.00")
    proveedor.notificar(anon,base,pago_c["ordenId"])
    check("Cancelación verificada también libera cupo",api(c,"GET","/api/Pagos/"+pago_c["idCobro"])["estado"]=="CANCELADO")
    proveedor.cambiar(orden_a,"processed","partially_refunded")
    proveedor.notificar(anon,base,orden_a)
    check("Reembolso parcial conserva el pago original y deja inscripción por revisar",api(a,"GET","/api/Pagos/"+cobro_a)["estado"]=="REEMBOLSO_PARCIAL"
        and api(a,"GET","/api/Pagos/"+cobro_a)["idPago"]==aprobado["idPago"])
    proveedor.cambiar(orden_a,"refunded","refunded",total_paid_amount="0.00")
    proveedor.notificar(anon,base,orden_a)
    check("Reembolso completo revoca inscripción sin duplicar ni borrar el historial",api(a,"GET","/api/Pagos/"+cobro_a)["estado"]=="REEMBOLSADO"
        and not api(a,"GET","/api/Pagos/"+cobro_a)["inscripcionVigente"])

    # Respuesta perdida después de crear la orden: el reintento debe conservar cuerpo y clave.
    nueva=dict(solicitud,inicioSemana=semanas[2]["inicioSemana"])
    proveedor.fallar_despues_crear=True
    api(b,"POST","/api/Pagos",nueva,esperado=503)
    inicio_incompleto=next(p for p in api(b,"GET","/api/Pagos") if p["inicioSemana"]==nueva["inicioSemana"])
    recuperado=api(b,"POST","/api/Pagos/"+inicio_incompleto["idCobro"]+"/actualizar")
    ultimas=proveedor.peticiones[-2:]
    check("Una respuesta perdida se recupera con igual clave, cuerpo, reserva y orden",ultimas[0]==ultimas[1]
        and recuperado["idCobro"]==inicio_incompleto["idCobro"] and recuperado["ordenId"] is not None)
    # El usuario inicia desde el catálogo, se autentica y regresa a la clase elegida.
    invitado=browser.new_context(reduced_motion="reduce",viewport={"width":390,"height":844})
    ui=invitado.new_page(); ui.on("pageerror",lambda e: errores.append(str(e)))
    invitado.route("https://www.mercadopago.com.mx/checkout/**",lambda route: route.fulfill(status=200,content_type="text/html",body="<p>Checkout simulado localmente</p>"))
    ui.goto(base+f"/tenis.html?idDeporte={deporte}",wait_until="domcontentloaded")
    expect(ui.locator(".catalogo-precio")).to_contain_text("por semana")
    ui.get_by_role("link",name="ELEGIR SEMANA Y PAGAR").click()
    expect(ui.locator("#avisoSesionPago")).to_be_visible()
    ui.locator("#enlaceLoginPago").click()
    ui.locator("#correo").fill("pago3@example.test"); ui.locator("#password").fill(password); ui.locator("#btnLogin").click()
    expect(ui).to_have_url(base+f"/pagos.html?idClase={clase}")
    expect(ui.locator("#semanaPago")).to_be_enabled()
    ui.locator("#semanaPago").select_option(semanas[3]["inicioSemana"])
    expect(ui.locator("#btnPagarClase")).to_be_disabled()
    ui.locator("#aceptarPoliticas").check()
    with invitado.expect_page() as nueva_pestana:
        ui.locator("#btnPagarClase").click()
    checkout=nueva_pestana.value
    expect(checkout).to_have_url(re.compile(r"^https://www\.mercadopago\.com\.mx/checkout/"))
    expect(ui).to_have_url(base+f"/pagos.html?idClase={clase}")
    expect(ui.locator("#continuarPagoLocal")).to_be_visible()
    check("Catálogo, login y compra local abren Mercado Pago en otra pestaña conservando la clase elegida")
    check("El pago local no envía URLs de localhost a Mercado Pago",all(k not in proveedor.peticiones[-1][1]["config"]["online"] for k in ["success_url","failure_url","pending_url","auto_return"]))
    checkout.close()
    pago_ui=next(p for p in api(c,"GET","/api/Pagos") if p["inicioSemana"]==semanas[3]["inicioSemana"])
    competencia=simultaneos([a,b],dict(solicitud,inicioSemana=semanas[3]["inicioSemana"]))
    check("Dos compradores simultáneos no pueden tomar el último cupo",sorted(r[0] for r in competencia)==[200,409]
        and api(anon,"GET",f"/api/Pagos/clases/{clase}/semanas")["semanas"][3]["cuposDisponibles"]==0)
    # Un inicio sin enlace que venció libera cupo; no se puede reanudar a escondidas.
    proveedor.fallar_despues_crear=True
    api(a,"POST","/api/Pagos",dict(solicitud,inicioSemana=semanas[2]["inicioSemana"]),esperado=503)
    vencido=next(p for p in api(a,"GET","/api/Pagos") if p["estado"]=="CREANDO")
    db.execute("UPDATE dbo.PAGO_MERCADOPAGO SET CREADO_UTC=DATEADD(hour,-2,SYSUTCDATETIME()) WHERE ID_COBRO=?",vencido["idCobro"])
    api(a,"POST","/api/Pagos/"+vencido["idCobro"]+"/actualizar",esperado=409)
    check("Un inicio vencido sin enlace no puede abrir otro checkout ni bloquear cupo indefinidamente",
        api(anon,"GET",f"/api/Pagos/clases/{clase}/semanas")["semanas"][2]["cuposDisponibles"]==1)
    # Los registros semanales antiguos y los de otro entorno no consumen cupos de esta semana.
    antigua=(datetime.fromisoformat(semanas[0]["inicioSemana"])-timedelta(days=7)).date()
    db.execute("INSERT dbo.RESERVA(ID_USUARIO,ID_CLASE,ESTATUS_RESERVA,SEMANA_INICIO,SEMANA_FIN,MODO_PRUEBA) VALUES(?,?,'CONFIRMADA',?,?,1)",usuarios[1],clase,antigua,antigua+timedelta(days=6))
    db.execute("INSERT dbo.RESERVA(ID_USUARIO,ID_CLASE,ESTATUS_RESERVA,SEMANA_INICIO,SEMANA_FIN,MODO_PRUEBA) VALUES(?,?,'CONFIRMADA',?,?,0)",usuarios[2],clase,inicio,semanas[1]["finSemana"])
    check("Semanas pasadas y reservas de otro entorno no ocupan cupos de prueba",api(anon,"GET",f"/api/Pagos/clases/{clase}/semanas")["semanas"][1]["cuposDisponibles"]==2)
    # En el equipo local la página obtiene la aprobación directamente; no necesita recibir un webhook.
    a.route("https://www.mercadopago.com.mx/checkout/**",lambda route:route.fulfill(status=200,content_type="text/html",body="<p>Pago local simulado</p>"))
    pagina.goto(base+f"/pagos.html?idClase={clase}",wait_until="domcontentloaded")
    expect(pagina.locator("#semanaPago")).to_be_enabled()
    pagina.locator("#semanaPago").select_option(semanas[2]["inicioSemana"])
    pagina.locator("#aceptarPoliticas").check()
    with a.expect_page() as pestana_pago_local:
        pagina.locator("#btnPagarClase").click()
    pestaña=pestana_pago_local.value
    expect(pestaña).to_have_url(re.compile(r"^https://www\.mercadopago\.com\.mx/checkout/"))
    compra_local=next(p for p in api(a,"GET","/api/Pagos") if p["inicioSemana"]==semanas[2]["inicioSemana"] and p["estado"]=="PENDIENTE")
    proveedor.cambiar(compra_local["ordenId"],"processed","accredited",total_paid_amount="116.00")
    pestaña.close()
    pagina.bring_to_front()
    pagina.evaluate("window.dispatchEvent(new Event('focus'))")
    expect(pagina.locator("#confirmacionPago")).to_be_visible(timeout=15000)
    confirmado_local=api(a,"GET","/api/Pagos/"+compra_local["idCobro"])
    check("Volver de Mercado Pago confirma el pago y activa el QR local sin recibir notificaciones",
        confirmado_local["estado"]=="APROBADO" and confirmado_local["codigoAcceso"] is not None
        and confirmado_local["idPago"] is not None)
    # Borrar está permitido, pero una aprobación posterior conserva el dinero y pide revisión.
    api(admin,"DELETE",f"/api/Administracion/clases/{clase}")
    proveedor.cambiar(pago_ui["ordenId"],"processed","accredited",total_paid_amount="116.00")
    proveedor.notificar(anon,base,pago_ui["ordenId"])
    revision=api(c,"GET","/api/Pagos/"+pago_ui["idCobro"])
    check("Aprobación tras borrar una clase conserva el PAGO y pide revisión sin inscribir",revision["estado"]=="REVISION" and revision["idPago"] is not None and not revision["inscripcionVigente"])
    api(admin,"DELETE",f"/api/Usuario/{usuarios[3]}")
    api(c,"GET","/api/Pagos",esperado=401)
    check("Borrar un comprador conserva el historial financiero y revoca el acceso",db.execute("SELECT r.ID_USUARIO,r.ID_CLASE,p.ID_PAGO FROM dbo.PAGO_MERCADOPAGO p JOIN dbo.RESERVA r ON r.ID_RESERVA=p.ID_RESERVA WHERE ID_COBRO=?",pago_ui["idCobro"]).fetchone()[0] is None)
    probar_accesos_asistencia(db, browser, admin, anon, api, base, check, proveedor, password, artifacts, errores, smtp,
        profesor, usuario_rol, entrenador_rol, deporte)
    for ctx in [*contextos,invitado]: ctx.close()
