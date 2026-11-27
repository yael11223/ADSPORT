"""Perfiles propios, imágenes, administrador SQL y precarga de recursos públicos."""
from __future__ import annotations
import io
from urllib.parse import urlsplit
from PIL import Image
from playwright.sync_api import expect


def probar_perfiles(db,browser,admin,anon,api,base,check,password,artifacts,errores):
    roles=api(admin,"GET","/api/Rol")
    def rol(nombre):
        actual=next((r["idRol"] for r in roles if r["nombreRol"]==nombre),None)
        if actual:return actual
        api(admin,"POST","/api/Rol",{"nombreRol":nombre},esperado=201)
        return next(r["idRol"] for r in api(admin,"GET","/api/Rol") if r["nombreRol"]==nombre)
    usuario_rol,profesor_rol,admin_rol=rol("USUARIO"),rol("ENTRENADOR"),rol("ADMINISTRADOR")
    contextos=[];personas=[]
    for nombre,email,rol_id in [("Perfil alumno","perfil.alumno@example.test",usuario_rol),("Perfil profesor","perfil.profesor@example.test",profesor_rol),
        ("Otro alumno","perfil.ajeno@example.test",usuario_rol),("Segundo administrador","admin.sql@example.test",admin_rol)]:
        datos={"idRol":rol_id,"nombre":nombre,"apellidoPaterno":"Pruebas","apellidoMaterno":"","correo":email,"telefono":"123","estatus":"ACTIVO","passwordInicial":password}
        persona=api(admin,"POST","/api/Usuario",datos,esperado=201)
        ctx=browser.new_context(reduced_motion="reduce",viewport={"width":1440,"height":1050})
        ruta="/api/Auth/login" if rol_id==admin_rol else "/api/Entrenador/login" if rol_id==profesor_rol else "/api/LoginUsuario/login"
        api(ctx,"POST",ruta,{"correo":email,"password":password},csrf=rol_id!=usuario_rol)
        contextos.append(ctx);personas.append((persona["idUsuario"],datos))
    alumno,profesor,ajeno,segundo=contextos
    check("Un administrador nuevo inicia sesión con su cuenta SQL aunque no esté en DemoLogin",api(segundo,"GET","/api/Auth/sesion")["nombre"]=="Segundo administrador Pruebas")
    denegado=browser.new_context()
    api(denegado,"POST","/api/Auth/login",{"correo":"perfil.alumno@example.test","password":password},esperado=403)
    api(denegado,"POST","/api/Auth/login",{"correo":"perfil.profesor@example.test","password":password},esperado=403)
    check("Usuario y profesor no obtienen sesión administrativa desde su formulario",not api(denegado,"GET","/api/Auth/sesion")["autenticado"])
    denegado.close()

    resumen=api(admin,"GET","/api/Administracion/inicio")
    check("El panel administrativo consulta cantidades actuales de SQL",resumen["usuarios"]==db.execute("SELECT COUNT(*) FROM dbo.USUARIO").fetchone()[0]
        and resumen["canchas"]==db.execute("SELECT COUNT(*) FROM dbo.CANCHA WHERE ACTIVO=1").fetchone()[0])
    api(alumno,"GET","/api/Administracion/inicio",esperado=403)
    sin_sesion=browser.new_context()
    api(sin_sesion,"GET","/api/Perfil",esperado=401)
    sin_sesion.close()
    check("Resumen y edición de perfiles conservan la autorización de servidor")

    def imagen(color):
        buffer=io.BytesIO();Image.new("RGB",(90,60),color).save(buffer,format="PNG");return buffer.getvalue()
    foto,fondo=imagen("orange"),imagen("navy")
    campos={"Nombre":"Alumno editado","ApellidoPaterno":"Desde SQL","ApellidoMaterno":"","Telefono":"5551234567"}
    def guardar(ctx,datos,archivos=None,esperado=200,csrf=True):
        headers={}
        if csrf:headers["X-CSRF-TOKEN"]=ctx.request.get(base+"/api/Auth/csrf").json()["token"]
        contenido=dict(datos)
        for nombre,bytes_ in (archivos or {}).items(): contenido[nombre]={"name":nombre+".png","mimeType":"image/png","buffer":bytes_}
        r=ctx.request.put(base+"/api/Perfil",multipart=contenido,headers=headers)
        assert r.status==esperado,(r.status,r.text()[:800])
        return r.json() if "application/json" in r.headers.get("content-type","") else r
    guardar(alumno,campos,{"Foto":foto},esperado=400,csrf=False)
    check("La edición del perfil exige CSRF")
    editado=guardar(alumno,dict(campos,IdUsuario=str(personas[2][0]),IdRol=str(admin_rol),Estatus="INACTIVO",Correo="cambiado@example.test"),{"Foto":foto,"Fondo":fondo})
    check("La foto y el fondo se guardan juntos en la cuenta autenticada",editado["tieneFoto"] and editado["tieneFondo"]
        and api(ajeno,"GET","/api/Perfil")["nombre"]=="Otro alumno"
        and editado["correo"]=="perfil.alumno@example.test" and editado["nombreRol"]=="USUARIO")
    foto_guardada=alumno.request.get(base+editado["fotoUrl"]); fondo_guardado=alumno.request.get(base+editado["fondoUrl"])
    check("Las imágenes vuelven desde SQL con MIME correcto y sin caché privada",foto_guardada.body()==foto and fondo_guardado.body()==fondo
        and foto_guardada.headers["content-type"].startswith("image/png") and "no-store" in fondo_guardado.headers.get("cache-control",""))
    check("Otro alumno no puede consultar el fondo ajeno por un parámetro",ajeno.request.get(base+"/api/Perfil/fondo?idUsuario="+str(personas[0][0])).status==404)
    guardar(alumno,dict(campos,Nombre="No debe guardarse"),{"Foto":fondo,"Fondo":b"<svg onload='alert(1)'/>"},esperado=400)
    check("Una imagen inválida no guarda parcialmente los datos ni la otra imagen",api(alumno,"GET","/api/Perfil")["nombre"]=="Alumno editado"
        and alumno.request.get(base+"/api/Perfil/foto").body()==foto)
    guardar(alumno,campos,{"Foto":b"\x89PNG\r\n\x1a\n"+b"x"*(5*1024*1024)},esperado=400)
    check("Cada imagen tiene un límite de 5 MB")

    pagina=alumno.new_page();pagina.on("pageerror",lambda e:errores.append(str(e)))
    pagina.goto(base+"/perfilCliente.html",wait_until="domcontentloaded")
    expect(pagina.locator("#btnEditarPerfil")).to_be_enabled()
    expect(pagina.locator(".profile-welcome")).to_have_class(__import__("re").compile("perfil-portada-personalizada"))
    pagina.locator("#btnEditarPerfil").click();expect(pagina.locator("#editorPerfil")).to_be_visible()
    pagina.locator("#perfilNombre").fill("Nombre desde formulario")
    pagina.locator("#perfilNuevaFoto").set_input_files({"name":"avatar.png","mimeType":"image/png","buffer":fondo})
    pagina.locator("#perfilNuevoFondo").set_input_files({"name":"fondo.png","mimeType":"image/png","buffer":foto})
    pagina.locator("#guardarEditorPerfil").click()
    expect(pagina.locator("#editorPerfil")).not_to_be_visible()
    expect(pagina.locator("#lblNombreUsuario")).to_contain_text("Nombre desde formulario")
    check("El alumno edita nombre, foto y fondo desde el formulario existente")
    pagina.reload(wait_until="domcontentloaded")
    expect(pagina.locator("#lblNombreUsuario")).to_contain_text("Nombre desde formulario")
    expect(pagina.locator(".profile-welcome")).to_have_class(__import__("re").compile("perfil-portada-personalizada"))
    check("El perfil conserva los cambios al recargar y actualiza la imagen del encabezado",alumno.request.get(base+"/api/Perfil/foto").body()==fondo)
    pagina.screenshot(path=str(artifacts/"perfil-editado-escritorio.png"),full_page=True)
    pagina.set_viewport_size({"width":390,"height":844});pagina.locator("#btnEditarPerfil").click()
    expect(pagina.locator("#editorPerfil")).to_be_visible()
    check("El editor de foto y fondo cabe en móvil",pagina.locator("#editorPerfil").bounding_box()["width"]<=390
        and pagina.evaluate("document.documentElement.scrollWidth<=innerWidth"))
    pagina.screenshot(path=str(artifacts/"perfil-editor-movil.png"),full_page=True)
    pagina.locator("#cancelarEditorPerfil").click()

    pagina_profe=profesor.new_page();pagina_profe.on("pageerror",lambda e:errores.append(str(e)))
    pagina_profe.goto(base+"/perfilEntrenador.html",wait_until="domcontentloaded")
    expect(pagina_profe.locator("#btnEditarPerfilEntrenador")).to_be_enabled()
    expect(pagina_profe.locator("#btnCambiarFotoEntrenador")).to_be_enabled()
    pagina_profe.locator("#btnEditarPerfilEntrenador").click()
    pagina_profe.locator("#perfilNombre").fill("Profesor actualizado")
    pagina_profe.locator("#perfilNuevaFoto").set_input_files({"name":"profesor.png","mimeType":"image/png","buffer":foto})
    pagina_profe.locator("#perfilNuevoFondo").set_input_files({"name":"portada.png","mimeType":"image/png","buffer":fondo})
    pagina_profe.locator("#guardarEditorPerfil").click()
    expect(pagina_profe.locator("#editorPerfil")).not_to_be_visible()
    expect(pagina_profe.locator("#lblNombreEntrenador")).to_contain_text("Profesor actualizado")
    check("El entrenador también carga una foto y un fondo propios",profesor.request.get(base+"/api/Perfil/fondo").body()==fondo
        and api(alumno,"GET","/api/Perfil")["nombre"]=="Nombre desde formulario")
    pagina_profe.reload(wait_until="domcontentloaded")
    expect(pagina_profe.locator(".profile-welcome")).to_have_class(__import__("re").compile("perfil-portada-personalizada"))
    pagina_profe.screenshot(path=str(artifacts/"perfil-entrenador-editado.png"),full_page=True)
    pagina_profe.locator("#btnEditarPerfilEntrenador").click()
    pagina_profe.locator("#quitarFondoPerfil").check();pagina_profe.locator("#guardarEditorPerfil").click()
    expect(pagina_profe.locator("#editorPerfil")).not_to_be_visible()
    check("Se puede quitar el fondo conservando la fotografía",not api(profesor,"GET","/api/Perfil")["tieneFondo"]
        and profesor.request.get(base+"/api/Perfil/foto").body()==foto)

    pagina_admin=admin.new_page();pagina_admin.on("pageerror",lambda e:errores.append(str(e)))
    pagina_admin.goto(base+"/index.html",wait_until="domcontentloaded")
    expect(pagina_admin.locator("#estadoBaseDatosAdmin")).to_contain_text("CONECTADO")
    expect(pagina_admin.locator("#cantidadUsuariosAdmin")).to_have_text(str(db.execute("SELECT COUNT(*) FROM dbo.USUARIO").fetchone()[0])+" usuarios registrados")
    check("El administrador precarga el resumen de la base al abrir el panel")
    pagina_admin.screenshot(path=str(artifacts/"administracion-sql.png"),full_page=True)

    invitado=browser.new_context(reduced_motion="reduce");pre=invitado.new_page()
    privadas=[];pre.on("request",lambda r:privadas.append(r.url) if urlsplit(r.url).path.startswith(("/api/Usuario","/api/Administracion","/api/Perfil","/api/Pagos","/api/Entrenador")) else None)
    recursos=api(invitado,"GET","/api/Aplicacion/precarga")
    check("El manifiesto contiene las páginas y archivos públicos sin datos de usuarios",all(p in recursos["paginas"] for p in ["/index.html","/perfilCliente.html","/perfilEntrenador.html","/pagos.html"])
        and all(r.startswith("/") and not r.startswith("/api/") for r in recursos["recursos"]))
    pre.goto(base+"/Nosotros.html",wait_until="load")
    pre.wait_for_function("document.documentElement.dataset.precarga==='lista'",timeout=30000)
    check("La precarga termina en segundo plano sin consultar APIs privadas",not privadas)
    invitado.close()

    api(admin,"POST","/api/Usuario/"+str(personas[3][0])+"/desactivar")
    api(segundo,"GET","/api/Administracion/inicio",esperado=401)
    check("Desactivar un administrador SQL revoca su cookie igual que las demás cuentas")
    root_id=db.execute("SELECT ID_USUARIO FROM dbo.USUARIO WHERE CORREO='admin.integration@example.test'").fetchone()[0]
    api(admin,"POST",f"/api/Usuario/{root_id}/desactivar",esperado=409)
    api(admin,"DELETE",f"/api/Rol/{admin_rol}",esperado=409)
    check("No se elimina ni se desactiva accidentalmente al último administrador",api(admin,"GET","/api/Auth/sesion")["autenticado"])
    for ctx in contextos:ctx.close()
