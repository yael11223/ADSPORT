"use strict";
document.addEventListener("DOMContentLoaded", () => {
    const $ = id => document.getElementById(id);
    const formCorreo = $("formSolicitarRecuperacion"), formPassword = $("formRestablecerPassword");
    let ocupado = false, correo = "", reenviarDesde = 0, temporizador;

    function aviso(texto, estado = "info") {
        const elemento = $("mensajeRecuperacion");
        elemento.textContent = texto; elemento.dataset.estado = estado; elemento.hidden = !texto;
    }
    function actualizarReenvio() {
        const segundos = Math.max(0, Math.ceil((reenviarDesde - Date.now()) / 1000));
        $("reenviarCodigoRecuperacion").textContent = segundos ? "Reenviar en " + segundos + " s" : "Reenviar código";
        $("reenviarCodigoRecuperacion").disabled = ocupado || segundos > 0;
        if (!segundos) clearInterval(temporizador);
    }
    function bloquear(valor) {
        ocupado = valor;
        document.querySelectorAll("form button").forEach(b => b.disabled = valor);
        $("enviarCodigoRecuperacion").textContent = valor ? "Procesando…" : "Enviar código";
        $("restablecerPassword").textContent = valor ? "Procesando…" : "Guardar nueva contraseña";
        actualizarReenvio();
    }
    async function api(accion, datos) {
        let respuesta;
        try {
            respuesta = await fetch("/api/RecuperacionPassword/" + accion, { method: "POST", credentials: "omit", cache: "no-store",
                headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos) });
        } catch { throw new Error("No fue posible conectar con el servidor. Intenta nuevamente."); }
        const resultado = await respuesta.json().catch(() => ({}));
        if (!respuesta.ok || !resultado.isSuccess) {
            const validacion = resultado.errors ? Object.values(resultado.errors).flat()[0] : "";
            throw new Error(resultado.respuesta || validacion || "No fue posible completar la solicitud.");
        }
        return resultado;
    }
    async function enviarCodigo() {
        if (ocupado) return;
        bloquear(true); aviso("");
        try {
            const resultado = await api("solicitar", { correo });
            formCorreo.hidden = true; formPassword.hidden = false;
            $("destinoRecuperacion").textContent = correo;
            $("instruccionesRecuperacion").textContent = "Introduce el código recibido y elige tu nueva contraseña.";
            $("codigoRecuperacion").value = "";
            reenviarDesde = Date.now() + resultado.reenviarEnSegundos * 1000;
            clearInterval(temporizador); temporizador = setInterval(actualizarReenvio, 1000);
            aviso(resultado.respuesta); $("codigoRecuperacion").focus();
        } catch (error) { aviso(error.message, "error"); }
        finally { bloquear(false); }
    }
    formCorreo.addEventListener("submit", evento => {
        evento.preventDefault();
        if (!formCorreo.reportValidity()) return;
        correo = $("correoRecuperacion").value.trim().toLowerCase();
        enviarCodigo();
    });
    $("reenviarCodigoRecuperacion").addEventListener("click", () => {
        if (Date.now() >= reenviarDesde) enviarCodigo();
    });
    $("cambiarCorreoRecuperacion").addEventListener("click", () => {
        if (ocupado) return;
        clearInterval(temporizador); formPassword.reset(); formPassword.hidden = true; formCorreo.hidden = false;
        correo = ""; aviso("");
        $("instruccionesRecuperacion").textContent = "Introduce el correo electrónico de tu cuenta.";
        $("correoRecuperacion").focus();
    });
    document.querySelectorAll("[data-password]").forEach(boton => boton.addEventListener("click", () => {
        const campo = $(boton.dataset.password), mostrar = campo.type === "password";
        campo.type = mostrar ? "text" : "password";
        boton.setAttribute("aria-pressed", String(mostrar));
        boton.setAttribute("aria-label", (mostrar ? "Ocultar " : "Mostrar ") + (campo.id === "nuevaPassword" ? "nueva contraseña" : "confirmación de contraseña"));
    }));
    formPassword.addEventListener("submit", async evento => {
        evento.preventDefault();
        if (ocupado || !formPassword.reportValidity()) return;
        const nuevaPassword = $("nuevaPassword").value, confirmarPassword = $("confirmarPassword").value;
        if (nuevaPassword !== confirmarPassword) { aviso("Las contraseñas no coinciden.", "error"); $("confirmarPassword").focus(); return; }
        if (new TextEncoder().encode(nuevaPassword).length > 72) { aviso("La contraseña no debe superar 72 bytes UTF-8.", "error"); return; }
        bloquear(true); aviso("");
        try {
            const resultado = await api("restablecer", { correo, codigo: $("codigoRecuperacion").value, nuevaPassword, confirmarPassword });
            clearInterval(temporizador); formPassword.reset(); formPassword.hidden = true;
            $("recuperacionCompletada").hidden = false;
            $("tituloRecuperacion").textContent = "Contraseña actualizada";
            $("instruccionesRecuperacion").textContent = "Ya puedes volver a tu cuenta.";
            aviso(resultado.respuesta, "exito"); $("recuperacionCompletada").querySelector("a").focus();
        } catch (error) { aviso(error.message, "error"); }
        finally { bloquear(false); }
    });
    window.addEventListener("pagehide", () => { clearInterval(temporizador); formPassword.reset(); });
});
