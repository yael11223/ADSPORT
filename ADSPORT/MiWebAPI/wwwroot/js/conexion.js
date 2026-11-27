/* Mensajes de conexión para la interfaz. Conserva los estados reales de la API. */
(() => {
    "use strict";
    const textos = Object.freeze({
        conectando: "Conectando con ADSPORT…",
        conexion: "No se pudo conectar con ADSPORT. Intenta de nuevo.",
        credenciales: "El correo o la contraseña no son correctos.",
        permiso: "Esta cuenta no tiene acceso a este panel.",
        datos: "Revisa los datos e intenta de nuevo.",
        espera: "Espera un momento antes de volver a intentarlo."
    });
    const tecnico = /\b(?:HTTP|SQL|SQLSTATE|JSON|CSRF|ODBC|JDBC|TypeError|SyntaxError|NetworkError|stack trace|Bad Gateway|Gateway Timeout|Service Unavailable|Failed to fetch|Unexpected token)\b|\b(?:error|c[oó]digo|status)\s*[:=#-]?\s*\d{3,}[a-z]*\b|\b50\d[a-z]+\b|<\/?(?:html|body|!doctype)\b/i;
    const seguro = (texto, alternativa) => typeof texto === "string" && texto.trim() && !tecnico.test(texto)
        ? texto.trim().slice(0, 500) : alternativa;
    function errorPublico(texto, status = 0) {
        return Object.assign(new Error(texto), { status, mensajePublico: true });
    }
    function fallo(respuesta, datos, alternativa = textos.datos) {
        const status = Number(respuesta?.status) || 0;
        if (!status || status === 408 || status >= 500 || Number(datos?.numeroError) >= 500)
            return errorPublico(textos.conexion, status);
        if (status === 401) return errorPublico(textos.credenciales, status);
        if (status === 429) return errorPublico(textos.espera, status);
        const validaciones = datos?.errors ? Object.values(datos.errors).flat().join(" ") : "";
        const respaldo = status === 403 ? textos.permiso : alternativa;
        return errorPublico(seguro(datos?.respuesta || validaciones, respaldo), status);
    }
    async function solicitar(url, opciones = {}) {
        const controlador = new AbortController();
        const limite = setTimeout(() => controlador.abort(), 20000);
        try {
            const respuesta = await fetch(url, { credentials: "same-origin", cache: "no-store", ...opciones, signal: controlador.signal });
            const datos = await respuesta.json().catch(() => null);
            if (!respuesta.ok) throw fallo(respuesta, datos);
            if (datos === null) throw errorPublico(textos.conexion, respuesta.status);
            if (datos.isSuccess === false) throw fallo(respuesta, datos);
            return datos;
        } catch (error) {
            if (error.mensajePublico) throw error;
            throw errorPublico(textos.conexion);
        } finally {
            clearTimeout(limite);
        }
    }
    function mensajeError(error) {
        if (["TypeError", "SyntaxError", "AbortError", "TimeoutError"].includes(error?.name)) return textos.conexion;
        return seguro(error?.message, textos.conexion);
    }
    function mostrar(elemento, texto, conectando = false) {
        elemento.textContent = texto;
        elemento.hidden = !texto;
        elemento.classList.remove("d-none");
        elemento.classList.toggle("estado-conexion", conectando);
        elemento.setAttribute("role", conectando ? "status" : "alert");
        elemento.setAttribute("aria-live", "polite");
    }
    window.ADSPORTConexion = Object.freeze({ textos, solicitar, fallo, mensajeError, mostrar });
})();
