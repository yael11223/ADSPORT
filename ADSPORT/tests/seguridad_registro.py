"""Regresiones de registro, sesiones y catálogos contra la API y SQL temporales."""
from playwright.sync_api import expect


def probar_seguridad_registro(db,browser,admin,anon,api,base,check,smtp,verificar,password,artifacts,page_errors):
    roles=api(admin,"GET","/api/Rol")
    rol=next(r["idRol"] for r in roles if r["nombreRol"] in ("USUARIO","SIN ASIGNAR"))
    def datos(email,pw=password,id_rol=rol):
        return {"idRol":id_rol,"nombre":"Prueba","apellidoPaterno":"Seguridad","correo":email,
            "telefono":"5551234567","estatus":"ACTIVO","passwordInicial":pw}
    def registrar(ctx,email,pw=password):
        return api(ctx,"POST","/api/Verificacion/registrar",{"nombre":"Registro","apellidoPaterno":"Seguro",
            "correo":email,"password":pw},csrf=False)

    propietario=browser.new_context(reduced_motion="reduce")
    ajeno=browser.new_context(reduced_motion="reduce")
    email="registro.seguro@example.test"
    verificar(email,propietario)
    permiso=next(c for c in propietario.cookies() if c["name"] == "ADSPORT.RegistroVerificado")
    check("La verificación entrega una autorización HttpOnly limitada al registro",permiso["httpOnly"]
        and permiso["sameSite"] == "Strict" and permiso["path"] == "/api/Verificacion")
    check("Otro navegador no puede completar un registro verificado",registrar(ajeno,email)["numeroError"] == 403)
    check("La autorización de registro no se puede usar con otro correo",registrar(propietario,"otro.correo@example.test")["numeroError"] == 403)
    check("La API rechaza contraseñas débiles sin perder la autorización",registrar(propietario,email,"a")["numeroError"] == 400)
    realizado=registrar(propietario,email)
    check("El navegador verificado puede registrar la cuenta y recibe éxito coherente",realizado["numeroError"] == 201
        and realizado["isSuccess"] and realizado["idUsuario"] > 0)
    check("La autorización de registro se consume después del alta",registrar(propietario,email)["numeroError"] == 403
        and not any(c["name"] == "ADSPORT.RegistroVerificado" for c in propietario.cookies()))

    vencido="registro.vencido@example.test"
    verificar(vencido,propietario)
    db.execute("UPDATE dbo.CODIGO_VERIFICACION SET FECHA_EXPIRACION=DATEADD(second,-1,GETUTCDATE()) WHERE CORREO=? AND PROPOSITO='REGISTRO'",vencido)
    check("La verificación vencida tampoco autoriza al navegador original",registrar(propietario,vencido)["numeroError"] == 403
        and db.execute("SELECT COUNT(*) FROM dbo.USUARIO WHERE CORREO=?",vencido).fetchone()[0] == 0)

    sesion=browser.new_context(reduced_motion="reduce")
    creado=api(admin,"POST","/api/Usuario",datos("sesion.segura@example.test"),esperado=201)["idUsuario"]
    api(sesion,"POST","/api/LoginUsuario/login",{"correo":"sesion.segura@example.test","password":password},csrf=False)
    api(admin,"POST","/api/Usuario/"+str(creado)+"/desactivar")
    api(sesion,"GET","/api/Usuario/mi-perfil",esperado=401)
    check("Desactivar un usuario revoca su cookie y el acceso a su perfil",not api(sesion,"GET","/api/LoginUsuario/sesion")["autenticado"])
    api(admin,"PUT","/api/Usuario/"+str(creado),datos("sesion.segura@example.test"))
    api(sesion,"POST","/api/LoginUsuario/login",{"correo":"sesion.segura@example.test","password":password},csrf=False)
    api(admin,"DELETE","/api/Usuario/"+str(creado))
    api(sesion,"GET","/api/Usuario/mi-perfil",esperado=401)
    check("Eliminar un usuario revoca también la sesión general",not api(sesion,"GET","/api/LoginUsuario/sesion")["autenticado"])

    pw72="Aa1!"+"x"*68
    api(admin,"POST","/api/Usuario",datos("limite.seguro@example.test",pw72),esperado=201)
    api(ajeno,"POST","/api/LoginUsuario/login",{"correo":"limite.seguro@example.test","password":pw72},csrf=False)
    api(propietario,"POST","/api/LoginUsuario/login",{"correo":"limite.seguro@example.test","password":pw72+"SUFIJO"},esperado=401,csrf=False)
    check("El login rechaza el exceso de 72 bytes en lugar de truncarlo")

    api(admin,"POST","/api/Rol",{"nombreRol":"ENTRENADOR"})
    rol_profe=next(r["idRol"] for r in api(admin,"GET","/api/Rol") if r["nombreRol"] == "ENTRENADOR")
    api(admin,"POST","/api/Usuario",datos("profe.rol@example.test",id_rol=rol_profe),esperado=201)
    profesor=browser.new_context(reduced_motion="reduce")
    api(profesor,"POST","/api/Entrenador/login",{"correo":"profe.rol@example.test","password":password})
    deporte=api(admin,"POST","/api/Deporte",{"nombreDeporte":"Deporte de regresión","descripcion":"Prueba","activo":True})["idDeporte"]
    cancha=api(admin,"POST","/api/Cancha",{"nombre":"Cancha de regresión","idDeporte":deporte,"activo":True,
        "horarios":[{"diaSemana":1,"horaInicio":"08:00","horaFin":"18:00"}]},esperado=201)["idCancha"]
    clase=api(profesor,"POST","/api/Entrenador/clases",{"nombreClase":"Clase del rol","descripcion":"Prueba","idDeporte":deporte,
        "idCancha":cancha,"precio":100,"cupoMaximo":10,"disponible":True,
        "horarios":[{"diaSemana":1,"horaInicio":"09:00","horaFin":"10:00"}]})["idClase"]
    cambio=api(admin,"PUT","/api/Rol/"+str(rol_profe),{"nombreRol":"PROFESOR SIN ACCESO"})
    disponible=api(admin,"GET","/api/Cancha/"+str(cancha)+"/disponibilidad?diaSemana=1")
    api(profesor,"GET","/api/Entrenador/perfil",esperado=403)
    check("Renombrar ENTRENADOR despublica sus clases y libera la cancha",cambio["isSuccess"]
        and not db.execute("SELECT DISPONIBLE FROM dbo.CLASE WHERE ID_CLASE=?",clase).fetchone()[0]
        and not disponible["ocupados"] and disponible["disponibles"][0]["horaInicio"] == "08:00")

    # Un nombre con markup cabe en el modelo; el menú debe mostrarlo siempre como texto.
    nombre="<svg/onload=&#97;&#108;&#101;&#114;&#116;(1)>"
    markup=api(admin,"POST","/api/Deporte",{"nombreDeporte":nombre,"descripcion":"Texto sin HTML","activo":True})["idDeporte"]
    visitante=browser.new_context(reduced_motion="reduce")
    pagina=visitante.new_page()
    pagina.on("pageerror",lambda error:page_errors.append(str(error)))
    dialogos=[]
    def dialogo(d):
        dialogos.append(d.message); d.dismiss()
    pagina.on("dialog",dialogo)
    pagina.goto(base+"/instalaciones.html",wait_until="domcontentloaded")
    expect(pagina.locator(".nav-dropdown__menu")).to_contain_text(nombre.upper())
    check("Los nombres de deporte no crean HTML ni ejecutan eventos en el menú",pagina.locator(".nav-dropdown__menu svg").count() == 0 and not dialogos)
    api(admin,"DELETE","/api/Deporte/"+str(markup))
    check("La imagen de respaldo del catálogo vuelve a estar disponible",visitante.request.get(base+"/Accet/Inicio.jpg").status == 200)

    pagina.goto(base+"/indexUsuario.html",wait_until="domcontentloaded")
    expect(pagina.locator("#clasesContainer .stack-card").first).to_be_attached()
    check("El inicio tiene un solo contenedor de catálogo y termina de cargar",pagina.locator("#clasesContainer").count() == 1
        and pagina.locator("#clasesContainer").get_attribute("aria-busy") == "false")
    pagina.goto(base+"/LoginUsuario.html",wait_until="domcontentloaded")
    pagina.get_by_role("link",name="¿Olvidaste tu contraseña?").click()
    expect(pagina.locator("#formSolicitarRecuperacion")).to_be_visible()
    check("El acceso vuelve a abrir la recuperación de contraseña")

    # El reintento debe recuperar también la lista de deportes, sin perder el filtro de la URL.
    pagina.route("**/componetes/heder.html",lambda route:route.fulfill(status=200,content_type="text/html",body="<header></header>"))
    estado_fallo={"primero":True}
    def fallo_inicial(route):
        if estado_fallo["primero"]:
            estado_fallo["primero"]=False
            route.fulfill(status=503,content_type="application/json",body='{"respuesta":"Fallo simulado"}')
        else: route.continue_()
    pagina.route("**/api/Deporte",fallo_inicial)
    pagina.goto(base+"/tenis.html?idDeporte="+str(deporte),wait_until="domcontentloaded")
    expect(pagina.locator("#estadoCatalogo")).to_contain_text("No fue posible consultar")
    pagina.locator("#recargarClases").click()
    expect(pagina.locator("#filtroDeporte")).to_have_value(str(deporte))
    expect(pagina.locator("#titulo-tenis")).to_have_text("Deporte de regresión")
    check("Actualizar recupera los deportes tras un fallo inicial y conserva el filtro",pagina.locator("#filtroDeporte option").count()>1)
    pagina.unroute("**/api/Deporte",fallo_inicial)

    # Flujo completo con Enter, sin interceptar la API ni simular la verificación.
    pagina.goto(base+"/Registro.html",wait_until="domcontentloaded")
    desde=len(smtp.mensajes)
    pagina.locator("#correo").fill("registro.enter@example.test")
    pagina.locator("#correo").press("Enter")
    expect(pagina.locator("#pantallaVerificacion")).to_be_visible()
    codigo=smtp.codigo("registro.enter@example.test",desde,asunto="Verifica tu cuenta | ADSPORT")
    pagina.locator("#codigo").fill(codigo)
    pagina.locator("#codigo").press("Enter")
    expect(pagina.locator("#pantallaDatos")).to_be_visible()
    pagina.locator("#nombre").fill("Registro")
    pagina.locator("#apellidoPaterno").fill("Enter")
    pagina.locator("#telefono").fill("5551234567")
    pagina.locator("#telefono").press("Enter")
    expect(pagina.locator("#pantallaPassword")).to_be_visible()
    pagina.locator("#password").fill(password)
    pagina.locator("#confirmarPassword").fill(password)
    pagina.locator("#confirmarPassword").press("Enter")
    expect(pagina.locator("#pantallaFinal")).to_be_visible()
    check("Enter completa el registro real sin recargar ni incluir correo o código en la URL",pagina.url.endswith("/Registro.html")
        and db.execute("SELECT COUNT(*) FROM dbo.USUARIO WHERE CORREO='registro.enter@example.test'").fetchone()[0] == 1)
    pagina.screenshot(path=str(artifacts/"registro-seguro-final.png"),full_page=True)
    propietario.close();ajeno.close();sesion.close();profesor.close();visitante.close()
