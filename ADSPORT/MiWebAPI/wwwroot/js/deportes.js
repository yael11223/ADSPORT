"use strict";

document.addEventListener("DOMContentLoaded", async () => {
    const porId = (id) => document.getElementById(id);
    const form = porId("formDeporte");
    const tabla = porId("tablaDeportesBody");
    const imagen = porId("imagenDeporte");
    let deportes = [];
    let ocupado = false;
    let previewLocal = null;
    let imagenActual = null;

    function nodo(tag, clase, texto) {
        const item = document.createElement(tag);
        if (clase) item.className = clase;
        if (texto !== undefined) item.textContent = String(texto);
        return item;
    }

    function aviso(texto, error = false) {
        const item = porId("alertaApi");
        item.textContent = texto;
        item.hidden = !texto;
        item.classList.toggle("sports-notice--error", error);
    }

    async function solicitar(ruta, opciones = {}) {
        const response = await solicitarAdmin(ruta, { cache: "no-store", ...opciones });
        const data = await response.json().catch(() => null);
        if (response.status === 401) { window.location.replace("/login.html"); throw new Error("Inicia sesión como administrador."); }
        if (response.status === 403) { deportes = []; renderizar(); }
        if (!response.ok || (typeof data?.numeroError === "number" && data.numeroError !== 0)) {
            const validacion = data?.errors ? Object.values(data.errors).flat().join(" ") : "";
            throw new Error(data?.respuesta || validacion || (response.status === 403
                ? "Esta operación requiere una sesión administrativa activa."
                : "No fue posible completar la solicitud. Intenta nuevamente."));
        }
        if (!data) throw new Error("ADSPORT no devolvió una respuesta válida.");
        return data;
    }

    function bloquear(estado) {
        ocupado = estado;
        form.querySelectorAll("input,textarea,button").forEach((campo) => { campo.disabled = estado; });
        porId("btnActualizarDeportes").disabled = estado;
        tabla.querySelectorAll("button").forEach((boton) => { boton.disabled = estado; });
    }

    function mostrarPreview(ruta) {
        if (previewLocal) { URL.revokeObjectURL(previewLocal); previewLocal = null; }
        const preview = porId("previewImagenDeporte");
        preview.onerror = () => { preview.onerror = null; preview.src = "/Accet/Inicio.jpg"; };
        if (ruta) preview.src = ruta;
        else preview.removeAttribute("src");
        porId("contenedorPreview").hidden = !ruta;
    }

    function limpiarFormulario() {
        form.reset();
        porId("idDeporte").value = "0";
        porId("deporteActivo").checked = true;
        porId("tituloFormulario").textContent = "REGISTRAR DEPORTE";
        porId("btnGuardar").textContent = "Guardar deporte";
        porId("btnCancelar").hidden = true;
        porId("btnReintentarImagen").hidden = true;
        imagenActual = null;
        mostrarPreview(null);
    }

    function editar(deporte) {
        if (ocupado) return;
        limpiarFormulario();
        porId("idDeporte").value = String(deporte.idDeporte);
        porId("nombreDeporte").value = deporte.nombreDeporte || "";
        porId("descripcion").value = deporte.descripcion || "";
        porId("deporteActivo").checked = deporte.activo;
        porId("tituloFormulario").textContent = "EDITAR DEPORTE";
        porId("btnGuardar").textContent = "Guardar cambios";
        porId("btnCancelar").hidden = false;
        imagenActual = deporte.imagenUrl || null;
        mostrarPreview(imagenActual);
        aviso("");
        porId("nombreDeporte").focus();
        form.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    function renderizar() {
        tabla.replaceChildren();
        const visibles = deportes.filter((deporte) => porId("mostrarInactivos").checked || deporte.activo);
        porId("totalRegistros").textContent = visibles.length + " de " + deportes.length + " deportes";
        if (!visibles.length) {
            const fila = nodo("tr");
            const celda = nodo("td", "", "No hay deportes para mostrar con este filtro.");
            celda.colSpan = 4; fila.append(celda); tabla.append(fila); return;
        }
        visibles.forEach((deporte) => {
            const fila = nodo("tr");
            const datos = nodo("td");
            const registro = nodo("div", "sports-record");
            const foto = nodo("img"); foto.src = deporte.imagenUrl || "/Accet/Inicio.jpg"; foto.alt = "Imagen de " + deporte.nombreDeporte; foto.loading = "lazy";
            foto.addEventListener("error", () => { foto.src = "/Accet/Inicio.jpg"; }, { once: true });
            const texto = nodo("div"); texto.append(nodo("strong", "", deporte.nombreDeporte), nodo("p", "", deporte.descripcion || "Sin descripción"));
            registro.append(foto, texto); datos.append(registro);
            const estado = nodo("td"); estado.append(nodo("span", "sports-state" + (deporte.activo ? "" : " sports-state--inactive"), deporte.activo ? "Activo" : "Inactivo"));
            const fecha = nodo("td", "", fechaTexto(deporte.fechaUltimaModificacion));
            const acciones = nodo("td"); const grupo = nodo("div", "sports-row-actions");
            const btnEditar = nodo("button", "sports-button sports-button--quiet", "Editar"); btnEditar.type = "button"; btnEditar.addEventListener("click", () => editar(deporte));
            const btnEstado = nodo("button", "sports-button sports-button--quiet", deporte.activo ? "Desactivar" : "Reactivar"); btnEstado.type = "button"; btnEstado.addEventListener("click", () => cambiarEstado(deporte));
            const btnEliminar = nodo("button", "sports-button sports-button--quiet", "Eliminar");
            btnEliminar.type = "button"; btnEliminar.addEventListener("click", () => eliminar(deporte));
            grupo.append(btnEditar, btnEstado, btnEliminar); acciones.append(grupo); fila.append(datos, estado, fecha, acciones); tabla.append(fila);
        });
        if (ocupado) tabla.querySelectorAll("button").forEach((boton) => { boton.disabled = true; });
    }

    function fechaTexto(valor) {
        if (!valor) return "No registrada";
        const fecha = new Date(valor);
        return Number.isNaN(fecha.getTime()) ? "No registrada" : fecha.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
    }

    async function cargarDeportes() {
        const lista = await solicitar("/api/Deporte?incluirInactivos=true");
        if (!Array.isArray(lista)) throw new Error("No fue posible leer el catálogo.");
        deportes = lista;
        renderizar();
    }

    function mostrarErrorCarga(error) {
        aviso(error.message || "No fue posible cargar el catálogo.", true);
        if (!deportes.length) {
            const fila = nodo("tr");
            const celda = nodo("td", "", "No fue posible consultar los deportes. Intenta Actualizar catálogo.");
            celda.colSpan = 4;
            fila.append(celda);
            tabla.replaceChildren(fila);
            porId("totalRegistros").textContent = "No disponible";
        }
    }

    async function subirImagen(id, archivo) {
        const data = new FormData(); data.append("archivo", archivo);
        return solicitar("/api/Deporte/" + encodeURIComponent(id) + "/imagen", { method: "POST", body: data });
    }


    async function eliminar(deporte) {
        if (ocupado) return;
        if (!confirm("¿Eliminar definitivamente el deporte «" + deporte.nombreDeporte + "» y su imagen? Sus canchas quedarán inactivas para asignarles otro deporte y sus clases dejarán de publicarse. Las reservas y pagos se conservarán.")) return;
        bloquear(true);
        try {
            const resultado = await solicitar("/api/Deporte/" + encodeURIComponent(deporte.idDeporte), { method:"DELETE" });
            deportes = deportes.filter(d => d.idDeporte !== deporte.idDeporte); renderizar();
            if (String(porId("idDeporte").value) === String(deporte.idDeporte)) limpiarFormulario();
            try { await cargarDeportes(); aviso(resultado.respuesta); }
            catch { aviso("El deporte se eliminó. Actualiza el catálogo para volver a cargar los registros."); }
        } catch (error) { aviso(error.message,true); }
        finally { bloquear(false); }
    }

    async function cambiarEstado(deporte) {
        if (ocupado) return;
        if (deporte.activo && !window.confirm("¿Desactivar " + deporte.nombreDeporte + "? Se ocultará del catálogo público y se conservarán sus datos y clases.")) return;
        bloquear(true);
        try {
            await solicitar("/api/Deporte/" + encodeURIComponent(deporte.idDeporte) + (deporte.activo ? "/desactivar" : ""), deporte.activo ? { method: "POST" } : {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nombreDeporte: deporte.nombreDeporte, descripcion: deporte.descripcion, activo: true })
            });
            if (String(porId("idDeporte").value) === String(deporte.idDeporte)) limpiarFormulario();
            await cargarDeportes();
            aviso(deporte.activo ? "Deporte desactivado. Su información y clases se conservaron." : "Deporte reactivado en el catálogo.");
        } catch (error) { aviso(error.message || "No fue posible actualizar el deporte.", true); }
        finally { bloquear(false); }
    }

    imagen.addEventListener("change", () => {
        const archivo = imagen.files?.[0];
        porId("btnReintentarImagen").hidden = true;
        if (!archivo) { mostrarPreview(imagenActual); return; }
        if (archivo.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(archivo.type)) {
            aviso("Elige una imagen JPG, PNG o WEBP de máximo 5 MB.", true);
            imagen.value = ""; mostrarPreview(imagenActual); return;
        }
        mostrarPreview(null);
        previewLocal = URL.createObjectURL(archivo);
        porId("previewImagenDeporte").src = previewLocal;
        porId("contenedorPreview").hidden = false;
    });

    form.addEventListener("submit", async (evento) => {
        evento.preventDefault();
        if (ocupado || !form.reportValidity()) return;
        const nombre = porId("nombreDeporte").value.trim();
        const descripcion = porId("descripcion").value.trim();
        if (!nombre || !descripcion) { aviso("Completa el nombre y la descripción del deporte.", true); return; }
        const archivo = imagen.files?.[0] || null;
        let id = porId("idDeporte").value;
        let guardado = false;
        let imagenPendiente = false;
        bloquear(true);
        porId("btnGuardar").setAttribute("aria-busy", "true");
        aviso("");
        try {
            const nuevo = id === "0";
            const resultado = await solicitar("/api/Deporte" + (nuevo ? "" : "/" + encodeURIComponent(id)), {
                method: nuevo ? "POST" : "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nombreDeporte: nombre, descripcion, activo: porId("deporteActivo").checked })
            });
            if (nuevo) {
                if (!resultado.idDeporte) throw new Error("El servidor no indicó el identificador del deporte guardado. Actualiza el catálogo antes de continuar.");
                id = String(resultado.idDeporte);
                // Se conserva el ID antes de subir la imagen: un reintento nunca crea otro deporte.
                porId("idDeporte").value = id;
                porId("tituloFormulario").textContent = "EDITAR DEPORTE";
                porId("btnCancelar").hidden = false;
                porId("btnGuardar").textContent = "Guardar cambios";
            }
            guardado = true;
            if (archivo) { imagenPendiente = true; await subirImagen(id, archivo); imagenPendiente = false; }
            limpiarFormulario();
            await cargarDeportes();
            aviso(resultado.respuesta || "Deporte guardado correctamente.");
        } catch (error) {
            if (guardado && imagenPendiente) {
                porId("btnReintentarImagen").hidden = false;
                aviso("El deporte se guardó, pero su imagen no pudo cargarse. " + error.message + " Usa Reintentar imagen; se conservará el mismo deporte.", true);
                await cargarDeportes().catch(() => {});
            } else aviso(guardado ? "El deporte se guardó, pero no fue posible actualizar el catálogo. Usa Actualizar catálogo." : error.message || "No fue posible guardar el deporte.", true);
        } finally { bloquear(false); porId("btnGuardar").removeAttribute("aria-busy"); }
    });

    porId("btnReintentarImagen").addEventListener("click", async () => {
        const archivo = imagen.files?.[0]; const id = porId("idDeporte").value;
        if (ocupado || !archivo || id === "0") return;
        bloquear(true);
        try {
            await subirImagen(id, archivo);
            limpiarFormulario();
            await cargarDeportes();
            aviso("La imagen se cargó correctamente para el deporte guardado.");
        } catch (error) { aviso("El deporte sigue guardado. No fue posible cargar su imagen: " + error.message, true); }
        finally { bloquear(false); }
    });
    porId("btnCancelar").addEventListener("click", () => { if (!ocupado) { limpiarFormulario(); aviso(""); } });
    porId("mostrarInactivos").addEventListener("change", renderizar);
    porId("btnCerrarSesion").addEventListener("click", cerrarSesion);
    porId("btnActualizarDeportes").addEventListener("click", async () => {
        if (ocupado) return;
        bloquear(true);
        try { await cargarDeportes(); aviso(""); } catch (error) { mostrarErrorCarga(error); }
        finally { bloquear(false); }
    });
    window.addEventListener("pagehide", () => { if (previewLocal) URL.revokeObjectURL(previewLocal); });
    await protegerPagina();
    bloquear(true);
    try { await cargarDeportes(); } catch (error) { mostrarErrorCarga(error); }
    finally { bloquear(false); }
});
