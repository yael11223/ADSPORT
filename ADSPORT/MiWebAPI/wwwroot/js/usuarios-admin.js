"use strict";
document.addEventListener("DOMContentLoaded", async () => {
    const A = window.Admin, $ = id => document.getElementById(id);
    if (!await A.ready) return;
    const soloProfesores = document.body.dataset.soloProfesores === "true";
    let usuarios = [], roles = [], cargando = false, guardando = false;
    const formulario = $("formUsuario");

    async function cargarRoles() {
        const seleccion = $("usuarioRol").value;
        roles = await A.api("/api/Rol");
        const permitidos = soloProfesores ? roles.filter(r => r.nombreRol.trim().toUpperCase() === "ENTRENADOR") : roles;
        $("usuarioRol").replaceChildren(new Option("Selecciona un rol", ""));
        permitidos.forEach(r => $("usuarioRol").add(new Option(r.nombreRol, r.idRol)));
        $("usuarioRol").value = seleccion || (soloProfesores ? permitidos[0]?.idRol || "" : "");
        const filtro = $("filtrarRol").value;
        $("filtrarRol").replaceChildren(new Option("Todos los roles", ""));
        roles.forEach(r => $("filtrarRol").add(new Option(r.nombreRol, r.idRol)));
        $("filtrarRol").value = filtro;
        $("guardarUsuario").disabled = !permitidos.length;
        if (!permitidos.length) throw new Error("No hay roles disponibles. Crea un rol o comprueba la actualización SQL.");
    }

    async function actualizar() {
        if (cargando) return false;
        cargando = true; $("actualizarUsuarios").disabled = true;
        $("cantidadUsuarios").textContent = "Cargando directorio…";
        try {
            usuarios = await A.api("/api/Usuario" + (soloProfesores ? "?rol=ENTRENADOR" : ""));
            renderizar();
            return true;
        } catch (error) {
            A.aviso("avisoUsuarios", error.message, true);
            $("cantidadUsuarios").textContent = "No se pudo actualizar el directorio.";
            return false;
        } finally { cargando = false; $("actualizarUsuarios").disabled = false; }
    }

    function renderizar() {
        const texto = $("buscarUsuario").value.trim().toLocaleLowerCase("es");
        const idRol = $("filtrarRol").value;
        const visibles = usuarios.filter(u => (!soloProfesores || A.profesor(u)) &&
            (!idRol || String(u.idRol) === idRol) && ($("incluirInactivos").checked || u.estatus.toUpperCase() === "ACTIVO") &&
            (A.nombre(u) + " " + u.correo + " " + u.telefono).toLocaleLowerCase("es").includes(texto));
        const lista = $("listaUsuarios"); lista.replaceChildren();
        visibles.forEach(u => {
            const fila = A.nodo("tr");
            const persona = A.nodo("td"); persona.append(A.nodo("strong", "", A.nombre(u)));
            const contacto = A.nodo("td", "", u.correo || "Sin correo");
            const telefono = A.nodo("td", "", u.telefono || "Sin teléfono");
            const estado = A.nodo("td");
            const activo = u.estatus.toUpperCase() === "ACTIVO";
            estado.append(A.nodo("span", "admin-badge" + (activo ? "" : " admin-badge--inactive"), activo ? "Activo" : "Inactivo"));
            const acciones = A.nodo("td"), botones = A.nodo("div", "admin-actions");
            botones.append(A.boton("Editar", () => editar(u)), A.boton("QR", () => mostrarQr(u)));
            if (A.profesor(u)) botones.append(A.boton("Clases", () => mostrarClases(u)));
            if (activo) botones.append(A.boton("Desactivar", () => desactivar(u), "admin-button admin-button--danger"));
            botones.append(A.boton("Eliminar", () => eliminar(u), "admin-button admin-button--danger"));
            acciones.append(botones);
            fila.append(persona, contacto, telefono, A.nodo("td", "", u.nombreRol || "Sin rol"), estado, acciones);
            lista.append(fila);
        });
        $("cantidadUsuarios").textContent = visibles.length + " de " + usuarios.length + (soloProfesores ? " profesores" : " usuarios");
        $("sinUsuarios").hidden = visibles.length > 0;
    }

    function limpiar() {
        formulario.reset(); $("idUsuario").value = "0";
        $("campoPasswordUsuario").hidden = false; $("usuarioPassword").required = true;
        $("cancelarUsuario").hidden = true;
        $("tituloFormularioUsuario").textContent = soloProfesores ? "Nuevo profesor" : "Nuevo usuario";
        $("guardarUsuario").textContent = soloProfesores ? "Guardar profesor" : "Guardar usuario";
        if (soloProfesores) $("usuarioRol").value = roles.find(r => r.nombreRol.trim().toUpperCase() === "ENTRENADOR")?.idRol || "";
    }

    async function editar(usuario) {
        try {
            const u = await A.api("/api/Usuario/" + usuario.idUsuario);
            $("idUsuario").value = u.idUsuario;
            $("usuarioNombre").value = u.nombre || "";
            $("usuarioPaterno").value = u.apellidoPaterno || "";
            $("usuarioMaterno").value = u.apellidoMaterno || "";
            $("usuarioCorreo").value = u.correo || "";
            $("usuarioTelefono").value = u.telefono || "";
            $("usuarioQR").value = u.codigoQr || "";
            $("usuarioRol").value = String(u.idRol);
            $("usuarioEstatus").value = u.estatus.toUpperCase();
            $("usuarioPassword").value = ""; $("usuarioPassword").required = false;
            $("campoPasswordUsuario").hidden = true; $("cancelarUsuario").hidden = false;
            $("tituloFormularioUsuario").textContent = "Editar " + (soloProfesores ? "profesor" : "usuario");
            $("guardarUsuario").textContent = "Guardar cambios";
            formulario.scrollIntoView({ behavior: "smooth", block: "start" });
            $("usuarioNombre").focus({ preventScroll: true });
        } catch (error) { A.aviso("avisoUsuarios", error.message, true); }
    }

    function mostrarQr(u) {
        $("nombreQr").textContent = A.nombre(u);
        $("codigoQr").textContent = u.codigoQr || "";
        const ruta = "/api/Usuario/" + encodeURIComponent(u.idUsuario) + "/qr";
        $("errorQr").hidden = true;
        $("imagenQr").hidden = false;
        $("imagenQr").onerror = () => { $("errorQr").hidden = false; $("imagenQr").hidden = true; };
        $("imagenQr").src = ruta;
        $("descargarQr").href = ruta; $("descargarQr").download = "ADSPORT-QR-" + u.idUsuario + ".png";
        $("dialogQr").showModal();
    }

    async function mostrarClases(u) {
        $("tituloClasesProfesor").textContent = "Clases de " + A.nombre(u);
        $("clasesProfesor").replaceChildren(A.nodo("p", "admin-help", "Cargando clases…"));
        $("cronogramaProfesor").href = "/cronograma.html?idEntrenador=" + encodeURIComponent(u.idUsuario);
        $("dialogClases").dataset.profesor = u.idUsuario;
        if (!$("dialogClases").open) $("dialogClases").showModal();
        try {
            const clases = await A.api("/api/Usuario/" + encodeURIComponent(u.idUsuario) + "/clases");
            if ($("dialogClases").dataset.profesor !== String(u.idUsuario)) return;
            const contenedor = $("clasesProfesor"); contenedor.replaceChildren();
            clases.forEach(c => {
                const card = A.nodo("article", "admin-class-card");
                card.append(A.nodo("h3", "", c.nombreClase), A.nodo("p", "admin-help",
                    c.nombreDeporte + " · " + (c.nombreCancha || "Sin cancha asignada") + " · " + (c.disponible ? "Publicada" : "No publicada")),
                    A.nodo("p", "", c.descripcion || "Sin descripción"),
                    A.nodo("p", "admin-help", (c.alumnosInscritos || 0) + " alumnos · " + (c.cupoMaximo || "Sin") + " cupos"));
                const horarios = A.nodo("ul");
                c.horarios.forEach(h => horarios.append(A.nodo("li", "", A.horario(h) + (h.nombreCancha ? " · " + h.nombreCancha : ""))));
                const eliminar = A.boton("Eliminar clase", async () => {
                    eliminar.disabled = true;
                    try {
                        const resultado = await A.eliminarClase(c.idClase,c.nombreClase);
                        if (resultado) await mostrarClases(u);
                    } catch (error) {
                        contenedor.prepend(A.nodo("p","admin-notice admin-notice--error",error.message));
                    } finally { eliminar.disabled = false; }
                },"admin-button admin-button--danger");
                card.append(horarios,eliminar); contenedor.append(card);
            });
            if (!clases.length) contenedor.append(A.nodo("p", "admin-empty", "Este profesor todavía no tiene clases."));
        } catch (error) { $("clasesProfesor").replaceChildren(A.nodo("p", "admin-notice admin-notice--error", error.message)); }
    }

    async function desactivar(u) {
        if (!confirm("¿Desactivar a " + A.nombre(u) + "? Sus clases dejarán de estar publicadas y se conservará su historial.")) return;
        try {
            const resultado = await A.api("/api/Usuario/" + u.idUsuario + "/desactivar", { method: "POST" });
            await actualizar(); A.aviso("avisoUsuarios", resultado.respuesta);
            if ($("idUsuario").value === String(u.idUsuario)) limpiar();
        } catch (error) { A.aviso("avisoUsuarios", error.message, true); }
    }

    async function eliminar(u) {
        if (guardando || cargando) return;
        if (!confirm("¿Eliminar definitivamente a " + A.nombre(u) + " de la base de datos? Esta acción no se puede deshacer. Sus clases dejarán de publicarse. Las reservas y pagos se conservarán.")) return;
        guardando = true;
        $("guardarUsuario").disabled = true;
        $("cancelarUsuario").disabled = true;
        $("listaUsuarios").querySelectorAll("button").forEach(b => b.disabled = true);
        try {
            const resultado = await A.api("/api/Usuario/" + encodeURIComponent(u.idUsuario), { method:"DELETE" });
            usuarios = usuarios.filter(persona => String(persona.idUsuario) !== String(u.idUsuario));
            renderizar();
            if ($("idUsuario").value === String(u.idUsuario)) limpiar();
            const actualizado = await actualizar();
            A.aviso("avisoUsuarios", resultado.respuesta + (actualizado ? "" : " Actualiza el directorio para comprobar el listado."));
        } catch (error) { A.aviso("avisoUsuarios", error.message, true); }
        finally {
            guardando = false;
            $("guardarUsuario").disabled = false;
            $("cancelarUsuario").disabled = false;
            $("listaUsuarios").querySelectorAll("button").forEach(b => b.disabled = false);
        }
    }

    formulario.addEventListener("submit", async evento => {
        evento.preventDefault();
        if (guardando || !formulario.reportValidity()) return;
        const id = Number($("idUsuario").value);
        const datos = { idRol: Number($("usuarioRol").value), nombre: $("usuarioNombre").value.trim(),
            apellidoPaterno: $("usuarioPaterno").value.trim(), apellidoMaterno: $("usuarioMaterno").value.trim(),
            correo: $("usuarioCorreo").value.trim(), telefono: $("usuarioTelefono").value.trim(), estatus: $("usuarioEstatus").value };
        if (!id) datos.passwordInicial = $("usuarioPassword").value;
        guardando = true; $("guardarUsuario").disabled = true; $("cancelarUsuario").disabled = true;
        $("guardarUsuario").setAttribute("aria-busy", "true");
        A.aviso("avisoUsuarios");
        try {
            const resultado = await A.guardar("/api/Usuario" + (id ? "/" + id : ""), id ? "PUT" : "POST", datos);
            limpiar(); const actualizado = await actualizar();
            A.aviso("avisoUsuarios", resultado.respuesta + (actualizado ? "" : " Actualiza el directorio para consultar el registro."));
            if (!id && resultado.idUsuario) mostrarQr({ ...datos, idUsuario: resultado.idUsuario, codigoQr: resultado.codigoQr });
        } catch (error) { A.aviso("avisoUsuarios", error.message, true); }
        finally { guardando = false; $("guardarUsuario").disabled = false; $("cancelarUsuario").disabled = false; $("guardarUsuario").removeAttribute("aria-busy"); }
    });
    $("cancelarUsuario").addEventListener("click", limpiar);
    $("actualizarUsuarios").addEventListener("click", actualizar);
    ["buscarUsuario", "filtrarRol", "incluirInactivos"].forEach(id => $(id).addEventListener(id === "buscarUsuario" ? "input" : "change", renderizar));
    document.querySelectorAll("[data-cerrar]").forEach(b => b.addEventListener("click", () => $(b.dataset.cerrar).close()));
    $("abrirRol")?.addEventListener("click", () => { $("formRol").reset(); A.aviso("avisoRol"); $("dialogRol").showModal(); });
    $("formRol").addEventListener("submit", async evento => {
        evento.preventDefault();
        if (!$("formRol").reportValidity()) return;
        $("guardarRol").disabled = true;
        $("guardarRol").setAttribute("aria-busy", "true");
        const nombreRol = $("nombreNuevoRol").value.trim();
        try {
            const resultado = await A.guardar("/api/Rol", "POST", { nombreRol });
            if (!resultado.isSuccess) throw new Error(resultado.respuesta);
            await cargarRoles();
            $("usuarioRol").value = roles.find(r => r.nombreRol.trim().toUpperCase() === nombreRol.toUpperCase())?.idRol || "";
            $("dialogRol").close(); A.aviso("avisoUsuarios", "Rol creado y seleccionado en el formulario.");
        } catch (error) { A.aviso("avisoRol", error.message, true); }
        finally { $("guardarRol").disabled = false; $("guardarRol").removeAttribute("aria-busy"); }
    });

    let eliminandoRol = false;
    async function gestionarRoles() {
        if (!$("dialogGestionRoles").open) $("dialogGestionRoles").showModal();
        const lista = $("listaGestionRoles");
        lista.replaceChildren(A.nodo("p","admin-help","Cargando roles…"));
        try {
            const actuales = await A.api("/api/Rol");
            lista.replaceChildren();
            actuales.forEach(rol => {
                const card = A.nodo("article","admin-class-card");
                card.append(A.nodo("h3","",rol.nombreRol));
                const eliminar = A.boton("Eliminar", async () => {
                    if (eliminandoRol) return;
                    if (!confirm("¿Eliminar definitivamente el rol «" + rol.nombreRol + "»? Los usuarios conservarán sus cuentas y pasarán a un rol básico. Las clases de los profesores afectados dejarán de publicarse.")) return;
                    eliminandoRol = true; eliminar.disabled = true;
                    try {
                        const resultado = await A.api("/api/Rol/" + encodeURIComponent(rol.idRol),{method:"DELETE"});
                        await cargarRoles(); await actualizar(); await gestionarRoles();
                        A.aviso("avisoGestionRoles",resultado.respuesta);
                    } catch (error) { A.aviso("avisoGestionRoles",error.message,true); }
                    finally { eliminandoRol = false; eliminar.disabled = false; }
                },"admin-button admin-button--danger");
                card.append(eliminar); lista.append(card);
            });
            if (!actuales.length) lista.append(A.nodo("p","admin-empty","No hay roles registrados."));
        } catch (error) { lista.replaceChildren(A.nodo("p","admin-notice admin-notice--error",error.message)); }
    }
    $("abrirGestionRoles")?.addEventListener("click",() => { A.aviso("avisoGestionRoles"); gestionarRoles(); });
    try { await cargarRoles(); await actualizar(); }
    catch (error) { A.aviso("avisoUsuarios", error.message, true); }
});
