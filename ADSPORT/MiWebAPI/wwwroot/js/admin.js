"use strict";

window.Admin = (() => {
    const mensajeConexion = "No se pudo conectar con ADSPORT. Intenta de nuevo.";
    const tecnico = /\b(?:HTTP|SQL|JSON|TypeError|SyntaxError|NetworkError|Failed to fetch|Unexpected token|Gateway|Service Unavailable)\b|\b(?:error|c[oó]digo|status)\s*[:=#-]?\s*\d{3,}[a-z]*\b/i;
    const dias = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    function nodo(tag, clase, texto) {
        const n = document.createElement(tag);
        if (clase) n.className = clase;
        if (texto !== undefined) n.textContent = String(texto);
        return n;
    }
    function aviso(id, texto = "", error = false) {
        if (error && tecnico.test(texto)) texto = mensajeConexion;
        const n = document.getElementById(id);
        if (!n) return;
        n.textContent = texto;
        n.hidden = !texto;
        n.classList.toggle("admin-notice--error", error);
    }
    async function api(ruta, opciones = {}) {
        let respuesta;
        try { respuesta = await solicitarAdmin(ruta, opciones); }
        catch { throw new Error(mensajeConexion); }
        const datos = await respuesta.json().catch(() => null);
        if (respuesta.status === 401) {
            window.location.replace("/login.html");
            throw new Error("Tu sesión terminó. Vuelve a iniciar sesión.");
        }
        if (!respuesta.ok || datos === null) {
            if (respuesta.status >= 500 || respuesta.status === 408 || datos === null)
                throw new Error(mensajeConexion);
            const detalle = datos?.errors ? Object.values(datos.errors).flat().join(" ") : "";
            const mensaje = datos?.respuesta || detalle || "No se pudo completar la solicitud. Intenta de nuevo.";
            throw new Error(tecnico.test(mensaje) ? mensajeConexion : mensaje);
        }
        return datos;
    }
    const guardar = (ruta, metodo, datos) => api(ruta, {
        method: metodo, headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos)
    });
    const nombre = u => [u.nombre, u.apellidoPaterno, u.apellidoMaterno].filter(Boolean).join(" ");
    const profesor = u => (u.nombreRol || "").trim().toUpperCase() === "ENTRENADOR";
    const horario = h => dias[h.diaSemana] + " · " + h.horaInicio + " – " + h.horaFin;
    const ready = new Promise(resolve => document.addEventListener("DOMContentLoaded", async () => {
        try {
            const sesion = await api("/api/Auth/sesion", { cache: "no-store" });
            if (!sesion.autenticado) {
                window.location.replace("/login.html");
                resolve(false);
                return;
            }
            document.getElementById("adminContenido").hidden = false;
            const nombreSesion = document.getElementById("nombreUsuario");
            if (nombreSesion) nombreSesion.textContent = sesion.nombre || "Administración";
            aviso("avisoSesion");
            resolve(true);
        } catch (error) {
            aviso("avisoSesion", error.message, true);
            resolve(false);
        }
    }, { once: true }));
    function boton(texto, accion, clase = "admin-button admin-button--quiet") {
        const b = nodo("button", clase, texto);
        b.type = "button";
        b.addEventListener("click", accion);
        return b;
    }
    function filaHorario(contenedor, valor = {}, alCambiar = () => {}) {
        const fila = nodo("div", "admin-schedule-row");
        ["diaSemana", "horaInicio", "horaFin"].forEach((campo, i) => {
            const grupo = nodo("div", "admin-field");
            const id = "apertura-" + crypto.randomUUID();
            const label = nodo("label", "", ["Día","Desde","Hasta"][i]); label.htmlFor = id;
            const input = nodo(i ? "input" : "select"); input.id = id; input.dataset.campo = campo; input.required = true;
            if (!i) dias.forEach((dia, indice) => { if (indice) input.add(new Option(dia, indice)); });
            else { input.type = "time"; input.step = "60"; }
            input.value = valor[campo] || (i ? (i === 1 ? "08:00" : "22:00") : 1);
            input.addEventListener("change", alCambiar);
            grupo.append(label, input); fila.append(grupo);
        });
        fila.append(boton("Quitar", () => { fila.remove(); alCambiar(); }));
        contenedor.append(fila);
    }
    function leerHorarios(contenedor) {
        return [...contenedor.querySelectorAll(".admin-schedule-row")].map(fila => ({
            diaSemana: Number(fila.querySelector('[data-campo="diaSemana"]').value),
            horaInicio: fila.querySelector('[data-campo="horaInicio"]').value,
            horaFin: fila.querySelector('[data-campo="horaFin"]').value
        }));
    }
    async function eliminarClase(id, nombreClase) {
        if (!confirm("¿Eliminar definitivamente la clase «" + nombreClase + "» y sus horarios? Las reservas y pagos se conservarán.")) return null;
        return api("/api/Administracion/clases/" + encodeURIComponent(id), { method:"DELETE" });
    }
    return { dias, nodo, aviso, api, guardar, nombre, profesor, horario, ready, boton, filaHorario, leerHorarios, eliminarClase };
})();
