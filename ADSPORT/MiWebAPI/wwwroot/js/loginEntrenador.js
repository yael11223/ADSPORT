"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const conexion = window.ADSPORTConexion;
    const form = document.getElementById("formLoginEntrenador");
    const correo = document.getElementById("correoEntrenador");
    const password = document.getElementById("passwordEntrenador");
    const boton = document.getElementById("btnLoginEntrenador");
    const mensaje = document.getElementById("mensajeLoginEntrenador");
    const mostrar = document.getElementById("mostrarPasswordEntrenador");
    const textoBoton = document.getElementById("textoBtnLoginEntrenador");
    const carga = document.getElementById("cargaLoginEntrenador");
    let enviando = false;

    mostrar.addEventListener("click", () => {
        const visible = password.type === "password";
        password.type = visible ? "text" : "password";
        mostrar.setAttribute("aria-label", visible ? "Ocultar contraseña" : "Mostrar contraseña");
        mostrar.setAttribute("aria-pressed", String(visible));
        password.focus({ preventScroll: true });
    });
    form.addEventListener("input", () => { mensaje.hidden = true; });
    form.addEventListener("submit", async (evento) => {
        evento.preventDefault();
        if (enviando || !form.reportValidity()) return;
        enviando = true;
        boton.disabled = true;
        boton.setAttribute("aria-busy", "true");
        textoBoton.textContent = "Conectando…";
        carga.hidden = false;
        conexion.mostrar(mensaje, conexion.textos.conectando, true);
        try {
            const { token } = await conexion.solicitar("/api/Entrenador/csrf");
            if (!token) throw new Error(conexion.textos.conexion);
            const resultado = await conexion.solicitar("/api/Entrenador/login", {
                method: "POST", credentials: "same-origin",
                headers: { "Content-Type": "application/json", "X-CSRF-TOKEN": token },
                body: JSON.stringify({ correo: correo.value.trim().toLowerCase(), password: password.value })
            });
            if (resultado?.isSuccess !== true) throw new Error(conexion.textos.conexion);
            // El perfil obtiene un token nuevo vinculado a la sesión autenticada.
            window.location.replace("/perfilEntrenador.html");
        } catch (error) {
            conexion.mostrar(mensaje, conexion.mensajeError(error));
        } finally {
            enviando = false;
            boton.disabled = false;
            boton.setAttribute("aria-busy", "false");
            textoBoton.textContent = "Iniciar sesión";
            carga.hidden = true;
        }
    });
});
