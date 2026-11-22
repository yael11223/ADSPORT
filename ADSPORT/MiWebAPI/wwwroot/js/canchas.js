"use strict";
document.addEventListener("DOMContentLoaded", async () => {
    const A = Admin, $ = id => document.getElementById(id);
    if (!await A.ready) return;
    let canchas = [], cargando = false, guardando = false, consulta = 0;
    let imagenActual = null, previewLocal = null;

    function liberarPreview() {
        if (previewLocal) URL.revokeObjectURL(previewLocal);
        previewLocal = null;
    }
    function mostrarPreview(ruta, detalle = "") {
        $("previewCancha").hidden = !ruta;
        $("previewImagenCancha").hidden = !ruta;
        if (ruta) $("previewImagenCancha").src = ruta;
        else $("previewImagenCancha").removeAttribute("src");
        $("detalleImagenCancha").textContent = detalle;
    }
    function bloquear(valor) {
        guardando = valor;
        $("formCancha").querySelectorAll("input,select,textarea,button").forEach(c => c.disabled = valor);
        $("listaCanchas").querySelectorAll("button").forEach(c => c.disabled = valor);
    }
    async function subirImagen(id, archivo) {
        const datos = new FormData();
        datos.append("archivo", archivo);
        const resultado = await A.api("/api/Cancha/" + encodeURIComponent(id) + "/imagen", { method:"POST", body:datos });
        imagenActual = resultado.imagenUrl;
    }
    $("imagenCancha").addEventListener("change", () => {
        const archivo = $("imagenCancha").files?.[0];
        liberarPreview();
        $("reintentarImagenCancha").hidden = true;
        if (!archivo) { mostrarPreview(imagenActual, imagenActual ? "Fotografía actual." : ""); return; }
        if (archivo.size > 5 * 1024 * 1024 || !["image/jpeg","image/png","image/webp"].includes(archivo.type)) {
            $("imagenCancha").value = "";
            mostrarPreview(imagenActual, imagenActual ? "Fotografía actual." : "");
            A.aviso("avisoCanchas","Selecciona una imagen JPG, PNG o WebP de máximo 5 MB.",true);
            return;
        }
        previewLocal = URL.createObjectURL(archivo);
        mostrarPreview(previewLocal, archivo.name);
    });
    $("previewImagenCancha").addEventListener("error", () => {
        $("previewImagenCancha").hidden = true;
        $("detalleImagenCancha").textContent = "No fue posible cargar la vista previa.";
    });
    window.addEventListener("pagehide", liberarPreview);
    function agregarApertura(h = {}) {
        if ($("aperturaCancha").childElementCount >= 21) return;
        A.filaHorario($("aperturaCancha"), h);
    }
    function limpiar() {
        liberarPreview(); imagenActual = null; mostrarPreview(null);
        $("reintentarImagenCancha").hidden = true;
        $("formCancha").reset(); $("idCancha").value = "0"; $("aperturaCancha").replaceChildren();
        agregarApertura(); $("cancelarCancha").hidden = true; $("tituloCancha").textContent = "Nueva cancha";
    }
    function editar(c) {
        if (guardando) return;
        liberarPreview(); $("imagenCancha").value = ""; imagenActual = c.imagenUrl;
        mostrarPreview(imagenActual, imagenActual ? "Fotografía actual. Selecciona otra para reemplazarla." : "");
        $("reintentarImagenCancha").hidden = true;
        $("idCancha").value = c.idCancha; $("nombreCancha").value = c.nombre;
        $("deporteCancha").value = String(c.idDeporte); $("ubicacionCancha").value = c.ubicacion || "";
        $("canchaActiva").checked = c.activo;
        $("aperturaCancha").replaceChildren(); c.horarios.forEach(agregarApertura);
        $("cancelarCancha").hidden = false; $("tituloCancha").textContent = "Editar cancha";
        $("formCancha").scrollIntoView({ behavior: "smooth", block: "start" }); $("nombreCancha").focus({ preventScroll: true });
    }
    function renderizar() {
        const texto = $("buscarCancha").value.trim().toLocaleLowerCase("es");
        const visibles = canchas.filter(c => ($("mostrarCanchasInactivas").checked || c.activo && c.deporteActivo) &&
            (c.nombre + " " + c.nombreDeporte).toLocaleLowerCase("es").includes(texto));
        const lista = $("listaCanchas"); lista.replaceChildren();
        visibles.forEach(c => {
            const card = A.nodo("article", "admin-court-card");
            if (c.imagenUrl) {
                const imagen = A.nodo("img", "admin-court-photo");
                imagen.src = c.imagenUrl; imagen.alt = "Instalación: " + c.nombre; imagen.loading = "lazy";
                imagen.addEventListener("error", () => { imagen.hidden = true; }, { once:true });
                card.append(imagen);
            }
            card.append(A.nodo("h3", "", c.nombre), A.nodo("p", "admin-help", c.nombreDeporte + (c.ubicacion ? " · " + c.ubicacion : "")),
                A.nodo("span", "admin-badge" + (c.activo && c.deporteActivo ? "" : " admin-badge--inactive"),
                    !c.idDeporte ? "Sin deporte asignado" : !c.activo ? "Inactiva" : !c.deporteActivo ? "Deporte inactivo" : "Habilitada"));
            const horas = A.nodo("ul"); c.horarios.forEach(h => horas.append(A.nodo("li", "", A.horario(h))));
            const acciones = A.nodo("div", "admin-actions");
            acciones.append(A.boton("Editar", () => editar(c)), A.boton("Ver disponibilidad", () => {
                $("canchaDisponibilidad").value = String(c.idCancha); cargarDisponibilidad();
                $("tituloDisponibilidad").scrollIntoView({ behavior: "smooth" });
            }));
            acciones.append(A.boton("Eliminar", () => eliminar(c), "admin-button admin-button--danger"));
            card.append(horas, acciones); lista.append(card);
            acciones.querySelectorAll("button").forEach(b => b.disabled = guardando || cargando);
        });
        if (!visibles.length) lista.append(A.nodo("p", "admin-empty", "Todavía no hay canchas que coincidan. Registra una y define sus horarios."));
        $("cantidadCanchas").textContent = visibles.length + " canchas";
    }
    async function eliminar(c) {
        if (guardando || cargando) return;
        if (!confirm("¿Eliminar definitivamente la cancha «" + c.nombre + "» y su fotografía de la base de datos? Sus clases dejarán de publicarse y quedarán sin cancha para reasignarlas. Las reservas y pagos se conservarán.")) return;
        bloquear(true);
        try {
            const resultado = await A.api("/api/Cancha/" + encodeURIComponent(c.idCancha), { method:"DELETE" });
            canchas = canchas.filter(cancha => String(cancha.idCancha) !== String(c.idCancha));
            renderizar();
            if ($("idCancha").value === String(c.idCancha)) limpiar();
            try {
                await actualizar();
                A.aviso("avisoCanchas", resultado.respuesta);
            } catch (error) {
                A.aviso("avisoCanchas", "La cancha se eliminó. No se pudo actualizar la vista: " + error.message, true);
            }
        } catch (error) { A.aviso("avisoCanchas", error.message, true); }
        finally { bloquear(false); }
    }

    async function cargarDisponibilidad() {
        const id = $("canchaDisponibilidad").value, actual = ++consulta;
        $("franjasLibres").replaceChildren(); $("franjasOcupadas").replaceChildren();
        if (!id) { A.aviso("avisoDisponibilidad", "Selecciona una cancha para consultar sus horarios."); return; }
        $("cronogramaCancha").href = "/cronograma.html?idCancha=" + encodeURIComponent(id);
        A.aviso("avisoDisponibilidad", "Consultando horarios…");
        try {
            const datos = await A.api("/api/Cancha/" + encodeURIComponent(id) + "/disponibilidad?diaSemana=" + $("diaDisponibilidad").value);
            if (actual !== consulta) return;
            datos.disponibles.forEach(h => $("franjasLibres").append(A.nodo("div", "admin-slot", h.horaInicio + " – " + h.horaFin)));
            datos.ocupados.forEach(h => {
                const bloque = A.nodo("div", "admin-slot admin-slot--busy", h.horaInicio + " – " + h.horaFin);
                bloque.append(A.nodo("p", "", h.nombreClase)); $("franjasOcupadas").append(bloque);
            });
            if (!datos.disponibles.length) $("franjasLibres").append(A.nodo("p", "admin-empty", "Sin franjas libres: la cancha está cerrada, inactiva o completamente ocupada este día."));
            if (!datos.ocupados.length) $("franjasOcupadas").append(A.nodo("p", "admin-empty", "No hay clases publicadas en esta cancha este día."));
            A.aviso("avisoDisponibilidad");
        } catch (error) { if (actual === consulta) A.aviso("avisoDisponibilidad", error.message, true); }
    }
    async function actualizar(seleccion = null) {
        if (cargando) return;
        cargando = true; $("actualizarCanchas").disabled = true;
        try {
            canchas = await A.api("/api/Cancha?incluirInactivas=true");
            const anterior = seleccion || $("canchaDisponibilidad").value || new URLSearchParams(location.search).get("idCancha");
            $("canchaDisponibilidad").replaceChildren(new Option("Selecciona una cancha", ""));
            canchas.forEach(c => $("canchaDisponibilidad").add(new Option(c.nombre + " · " + c.nombreDeporte, c.idCancha)));
            $("canchaDisponibilidad").value = canchas.some(c => String(c.idCancha) === String(anterior)) ? anterior : canchas[0]?.idCancha || "";
            renderizar(); await cargarDisponibilidad();
        } finally {
            cargando = false; $("actualizarCanchas").disabled = false;
            $("listaCanchas").querySelectorAll("button").forEach(b => b.disabled = guardando);
        }
    }

    $("formCancha").addEventListener("submit", async evento => {
        evento.preventDefault();
        if (guardando || !$("formCancha").reportValidity()) return;
        const horarios = A.leerHorarios($("aperturaCancha"));
        if (!horarios.length) { A.aviso("avisoCanchas", "Agrega al menos un horario de apertura.", true); return; }
        let id = Number($("idCancha").value);
        const archivo = $("imagenCancha").files?.[0] || null;
        const datos = { nombre: $("nombreCancha").value.trim(), idDeporte: Number($("deporteCancha").value),
            ubicacion: $("ubicacionCancha").value.trim(), activo: $("canchaActiva").checked, horarios };
        let guardado = false, imagenPendiente = false;
        bloquear(true); A.aviso("avisoCanchas");
        $("guardarCancha").setAttribute("aria-busy", "true");
        try {
            const resultado = await A.guardar("/api/Cancha" + (id ? "/" + id : ""), id ? "PUT" : "POST", datos);
            id = resultado.idCancha;
            // Mantener el identificador permite reintentar la foto sin duplicar la cancha.
            $("idCancha").value = id; $("tituloCancha").textContent = "Editar cancha"; $("cancelarCancha").hidden = false;
            guardado = true;
            if (archivo) { imagenPendiente = true; await subirImagen(id, archivo); imagenPendiente = false; }
            limpiar(); A.aviso("avisoCanchas", resultado.respuesta + (archivo ? " Fotografía guardada." : ""));
            try { await actualizar(String(id)); }
            catch (error) { A.aviso("avisoCanchas", "La cancha se guardó. No se pudo actualizar la vista: " + error.message, true); }
        } catch (error) {
            if (guardado && imagenPendiente) {
                $("reintentarImagenCancha").hidden = false;
                A.aviso("avisoCanchas", "La cancha se guardó, pero su fotografía no pudo subirse. " + error.message + " Usa Reintentar imagen.", true);
                await actualizar(String(id)).catch(() => {});
            } else A.aviso("avisoCanchas", error.message, true);
        } finally { bloquear(false); $("guardarCancha").removeAttribute("aria-busy"); }
    });
    $("reintentarImagenCancha").addEventListener("click", async () => {
        const id = $("idCancha").value, archivo = $("imagenCancha").files?.[0];
        if (guardando || id === "0" || !archivo) return;
        bloquear(true);
        try {
            await subirImagen(id,archivo); limpiar();
            A.aviso("avisoCanchas","Fotografía de la instalación guardada.");
            await actualizar(id);
        } catch (error) { A.aviso("avisoCanchas","No fue posible completar la carga. " + error.message,true); }
        finally { bloquear(false); }
    });
    $("agregarApertura").addEventListener("click", () => agregarApertura());
    $("cancelarCancha").addEventListener("click", () => { if (!guardando) limpiar(); });
    $("actualizarCanchas").addEventListener("click", () => actualizar().catch(e => A.aviso("avisoCanchas", e.message, true)));
    $("buscarCancha").addEventListener("input", renderizar);
    $("mostrarCanchasInactivas").addEventListener("change", renderizar);
    ["canchaDisponibilidad", "diaDisponibilidad"].forEach(id => $(id).addEventListener("change", cargarDisponibilidad));
    $("actualizarDisponibilidad").addEventListener("click", cargarDisponibilidad);
    limpiar();
    try {
        const deportes = await A.api("/api/Deporte?incluirInactivos=true");
        $("deporteCancha").replaceChildren(new Option("Selecciona un deporte", ""));
        deportes.forEach(d => $("deporteCancha").add(new Option(d.nombreDeporte + (d.activo ? "" : " (inactivo)"), d.idDeporte)));
        $("guardarCancha").disabled = !deportes.length;
        if (!deportes.length) A.aviso("avisoCanchas", "Registra un deporte antes de crear una cancha.");
        await actualizar();
    } catch (error) { A.aviso("avisoCanchas", error.message, true); }
});
