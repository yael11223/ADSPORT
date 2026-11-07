
document.addEventListener("DOMContentLoaded", () => {

    // ========================================
    // ADSPORT - LOGIN DE USUARIOS REGISTRADOS
    // ========================================

    const formLogin = document.getElementById("formLogin");
    const correo = document.getElementById("correo");
    const password = document.getElementById("password");
    const btnLogin = document.getElementById("btnLogin");
    const mensajeLogin = document.getElementById("mensajeLogin");

    const mostrarPassword =
        document.getElementById("mostrarPassword");

    const textoBtnLogin =
        btnLogin?.querySelector("span:not(.flecha)");

    const API_LOGIN = "/api/LoginUsuario/login";

    let iniciandoSesion = false;

    // ========================================
    // COMPROBAR ELEMENTOS HTML
    // ========================================

    if (
        !formLogin ||
        !correo ||
        !password ||
        !btnLogin ||
        !mensajeLogin
    ) {
        console.error(
            "ADSPORT: faltan elementos del formulario de login."
        );

        return;
    }

    // ========================================
    // MOSTRAR MENSAJE DE ERROR
    // ========================================

    function mostrarError(texto) {

        mensajeLogin.textContent = texto;
        mensajeLogin.classList.remove("d-none");
        mensajeLogin.hidden = false;
    }

    // ========================================
    // OCULTAR MENSAJE DE ERROR
    // ========================================

    function ocultarError() {

        mensajeLogin.textContent = "";
        mensajeLogin.classList.add("d-none");
        mensajeLogin.hidden = true;
    }

    // ========================================
    // CAMBIAR TEXTO DEL BOTÓN SIN QUITAR FLECHA
    // ========================================

    function cambiarTextoBoton(texto) {

        if (textoBtnLogin) {
            textoBtnLogin.textContent = texto;
        }
    }

    // ========================================
    // MOSTRAR U OCULTAR CONTRASEÑA
    // ========================================

    mostrarPassword?.addEventListener("click", () => {

        const estaOculta =
            password.type === "password";

        password.type =
            estaOculta ? "text" : "password";

        mostrarPassword.setAttribute(
            "aria-label",
            estaOculta
                ? "Ocultar contraseña"
                : "Mostrar contraseña"
        );

        mostrarPassword.setAttribute(
            "aria-pressed",
            String(estaOculta)
        );

        password.focus();
    });

    // ========================================
    // LIMPIAR ERRORES CUANDO EL USUARIO ESCRIBA
    // ========================================

    correo.addEventListener("input", ocultarError);
    password.addEventListener("input", ocultarError);

    // ========================================
    // INICIAR SESIÓN
    // ========================================

    formLogin.addEventListener("submit", async (evento) => {

        evento.preventDefault();

        // Evitar enviar varias peticiones al mismo tiempo.
        if (iniciandoSesion) {
            return;
        }

        ocultarError();

        // ========================================
        // 1. OBTENER DATOS DEL FORMULARIO
        // ========================================

        const correoUsuario =
            correo.value.trim().toLowerCase();

        const passwordUsuario =
            password.value;

        // ========================================
        // 2. VALIDAR CAMPOS OBLIGATORIOS
        // ========================================

        if (!correoUsuario) {

            mostrarError(
                "Introduce tu correo electrónico."
            );

            correo.focus();
            return;
        }

        if (!correo.checkValidity()) {

            mostrarError(
                "Introduce un correo electrónico válido."
            );

            correo.focus();
            return;
        }

        if (!passwordUsuario) {

            mostrarError(
                "Introduce tu contraseña."
            );

            password.focus();
            return;
        }

        // ========================================
        // 3. MOSTRAR ESTADO DE CARGA
        // ========================================

        iniciandoSesion = true;
        btnLogin.disabled = true;

        cambiarTextoBoton("Iniciando sesión...");

        try {

            // ========================================
            // 4. CONSULTAR API DE LOGIN
            // ========================================

            const respuesta = await fetch(API_LOGIN, {

                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                // Permite recibir y enviar la cookie
                // de autenticación de ASP.NET Core.
                credentials: "same-origin",

                body: JSON.stringify({

                    correo: correoUsuario,
                    password: passwordUsuario

                })
            });

            // ========================================
            // 5. COMPROBAR RESPUESTA DEL SERVIDOR
            // ========================================

            const tipoContenido =
                respuesta.headers.get("content-type") || "";

            if (!tipoContenido.includes("application/json")) {

                throw new Error(
                    "El servidor no devolvió una respuesta JSON válida."
                );
            }

            const resultado = await respuesta.json();

            // ========================================
            // 6. VALIDAR RESULTADO DE LA API
            // ========================================

            if (
                !respuesta.ok ||
                resultado.isSuccess !== true ||
                Number(resultado.numeroError) !== 0
            ) {

                throw new Error(
                    resultado.respuesta ||
                    "Correo o contraseña incorrectos."
                );
            }

            // ========================================
            // 7. INICIO DE SESIÓN CORRECTO
            // ========================================

            cambiarTextoBoton("¡Bienvenido!");

            // La API ya validó las credenciales
            // en SQL Server mediante LoginUsuarioData.
            //
            // ASP.NET Core administra la sesión
            // mediante una cookie de autenticación.
            //
            // No guardar contraseñas ni sesiones
            // en localStorage o sessionStorage.

            console.log("Login SQL correcto. Abriendo indexUsuario.html");
            window.location.replace("/indexUsuario.html");

        } catch (error) {

            console.error(
                "Error al iniciar sesión:",
                error
            );

            mostrarError(
                error.message ||
                "No fue posible conectar con el servidor."
            );

        } finally {

            iniciandoSesion = false;
            btnLogin.disabled = false;

            cambiarTextoBoton("Ingresar");
        }
    });

});
