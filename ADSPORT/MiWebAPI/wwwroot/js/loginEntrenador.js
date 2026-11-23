"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("formLoginEntrenador");
    const correo = document.getElementById("correoEntrenador");
    const password = document.getElementById("passwordEntrenador");
    const boton = document.getElementById("btnLoginEntrenador");
    const mensaje = document.getElementById("mensajeLoginEntrenador");
    const mostrar = document.getElementById("mostrarPasswordEntrenador");
    let enviando = false;

    mostrar.addEventListener("click", () => {
        const visible = password.type === "password";
        password.type = visible ? "text" : "password";
        mostrar.textContent = visible ? "Ocultar" : "Mostrar";
        mostrar.setAttribute("aria-pressed", String(visible));
    });
    form.addEventListener("input", () => { mensaje.hidden = true; });
    form.addEventListener("submit", async (evento) => {
        evento.preventDefault();
        if (enviando || !form.reportValidity()) return;
        enviando = true;
        boton.disabled = true;
        boton.textContent = "INICIANDO SESIÓN…";
        mensaje.hidden = true;
        try {
            const csrf = await fetch("/api/Entrenador/csrf", { credentials: "same-origin", cache: "no-store" });
            if (!csrf.ok) throw new Error("No fue posible preparar el inicio de sesión. Intenta de nuevo.");
            const { token } = await csrf.json();
            if (!token) throw new Error("No fue posible preparar el inicio de sesión.");
            const respuesta = await fetch("/api/Entrenador/login", {
                method: "POST", credentials: "same-origin",
                headers: { "Content-Type": "application/json", "X-CSRF-TOKEN": token },
                body: JSON.stringify({ correo: correo.value.trim().toLowerCase(), password: password.value })
            });
            const resultado = await respuesta.json().catch(() => null);
            if (!respuesta.ok || resultado?.isSuccess !== true) throw new Error(resultado?.respuesta || "No fue posible iniciar sesión. Revisa tus credenciales de entrenador.");
            // El perfil obtiene un token nuevo vinculado a la sesión autenticada.
            window.location.replace("/perfilEntrenador.html");
        } catch (error) {
            mensaje.textContent = error.message || "No fue posible conectar con ADSPORT.";
            mensaje.hidden = false;
        } finally {
            enviando = false;
            boton.disabled = false;
            boton.textContent = "ENTRAR A MI PANEL ↗";
        }
    });
});
