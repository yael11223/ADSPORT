
document.addEventListener("DOMContentLoaded", () => {

    // ========================================
    // ADSPORT - NAVEGACIÓN DEL REGISTRO
    // ========================================

    const pantallas = [
        "pantallaCorreo",
        "pantallaVerificacion",
        "pantallaDatos",
        "pantallaPassword",
        "pantallaFinal"
    ];

    const pasos = document.querySelectorAll(".paso");
    const correoInput = document.getElementById("correo");
    const correoDestino = document.getElementById("correoDestino");
    const codigoInput = document.getElementById("codigo");
    // ========================================
    // CONTADOR PARA REENVIAR CÓDIGO
    // ========================================

    const btnReenviarCodigo =
        document.getElementById("btnReenviarCodigo");

    const tiempoReenvio =
        document.getElementById("tiempoReenvio");

    const textoReenvio =
        document.getElementById("textoReenvio");

    const contadorCodigo =
        document.getElementById("contadorCodigo");

    const DURACION_REENVIO = 60;

    let finEsperaReenvio = 0;
    let intervaloReenvio = null;
    let reenviandoCodigo = false;

    let pantallaActual = 0;
    let correoSolicitado = "";
    let correoValidado = false;

    // ========================================
    // MOSTRAR PANTALLA
    // ========================================

    function mostrarPantalla(indice) {

        if (indice < 0 || indice >= pantallas.length) {
            return;
        }

        pantallas.forEach((id, posicion) => {
            const pantalla = document.getElementById(id);

            if (!pantalla) return;

            pantalla.hidden = posicion !== indice;
        });

        pantallaActual = indice;

        pasos.forEach((paso, indicePaso) => {
            paso.classList.toggle(
                "activo",
                indicePaso === obtenerPaso(indice)
            );
        });

        const panel = document.querySelector(".panel-formulario");

        if (panel) {
            panel.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }
    }

    // ========================================
    // INDICADOR DE PROGRESO
    // ========================================

    function obtenerPaso(indice) {
        if (indice <= 1) return indice;
        if (indice <= 3) return 2;
        return 2;
    }

    // ========================================
    // MENSAJES
    // ========================================

    const idsErrores = [
        "errorCorreo",
        "errorCodigo",
        "errorDatos",
        "errorPassword"
    ];

    const mensajesOriginales = {};

    idsErrores.forEach(id => {
        const elemento = document.getElementById(id);

        if (elemento) {
            mensajesOriginales[id] = elemento.innerHTML;
        }
    });

    function mostrarMensaje(id, visible) {
        const elemento = document.getElementById(id);

        if (elemento) {
            elemento.hidden = !visible;
        }
    }

    function mostrarError(id, mensaje) {
        const elemento = document.getElementById(id);

        if (elemento) {
            elemento.textContent = mensaje;
            elemento.hidden = false;
        } else {
            alert(mensaje);
        }
    }

    function limpiarMensajes() {

        idsErrores.forEach(id => {
            const elemento = document.getElementById(id);

            if (!elemento) return;

            elemento.hidden = true;

            if (mensajesOriginales[id] !== undefined) {
                elemento.innerHTML = mensajesOriginales[id];
            }
        });
    }

    // ========================================
    // VALIDAR CORREO
    // ========================================

    function prepararCorreo() {

        if (!correoInput) return false;

        const correo = correoInput.value.trim();

        if (!correo || !correoInput.checkValidity()) {
            mostrarMensaje("errorCorreo", true);
            correoInput.focus();
            return false;
        }

        mostrarMensaje("errorCorreo", false);

        if (correoDestino) {
            correoDestino.textContent = correo;
        }

        return true;
    }

    // ========================================
    // VALIDACIONES EN TIEMPO REAL
    // NOMBRES, APELLIDOS Y TELÉFONO
    // ========================================

    const idsNombres = [
        "nombre",
        "apellidoPaterno",
        "apellidoMaterno"
    ];

    const expresionNombre =
        /^[\p{L}\p{M}]+(?: [\p{L}\p{M}]+)*$/u;

    const telefonoInput = document.getElementById("telefono");

    idsNombres.forEach(id => {

        const campo = document.getElementById(id);

        if (!campo) return;

        // Eliminar números y símbolos al escribir o pegar.
        // Se permiten letras, acentos, ñ y espacios.
        campo.addEventListener("input", () => {

            if (campo.isComposing) return;

            campo.value = campo.value
                .replace(/[^\p{L}\p{M} ]/gu, "")
                .slice(0, 100);
        });

        // Eliminar espacios innecesarios.
        campo.addEventListener("blur", () => {

            campo.value = campo.value
                .replace(/\s+/g, " ")
                .trim();
        });
    });

    // Permitir únicamente números en el teléfono.
    telefonoInput?.addEventListener("input", () => {

        telefonoInput.value = telefonoInput.value
            .replace(/\D/g, "")
            .slice(0, 10);
    });

    // El código de verificación también será numérico.
    codigoInput?.addEventListener("input", () => {

        codigoInput.value = codigoInput.value
            .replace(/\D/g, "")
            .slice(0, 6);
    });

    // ========================================
    // VALIDACIÓN EN TIEMPO REAL
    // DE CONTRASEÑAS
    // ========================================

    const passwordInput = document.getElementById("password");

    const confirmarInput =
        document.getElementById("confirmarPassword");

    function evaluarRequisitosPassword() {

        const clave = passwordInput?.value || "";
        const confirmacion = confirmarInput?.value || "";

        const reglas = {

            // Mínimo 8 caracteres.
            longitud: clave.length >= 8,

            // Al menos una mayúscula.
            mayuscula: /[A-Z]/.test(clave),

            // Al menos una minúscula.
            minuscula: /[a-z]/.test(clave),

            // Al menos un número.
            numero: /[0-9]/.test(clave),

            // Al menos un carácter especial.
            especial:
                /[^\p{L}\p{M}0-9\s]/u.test(clave),

            // Las dos contraseñas deben coincidir.
            coincidencia:
                clave.length > 0 &&
                clave === confirmacion
        };

        // Cambiar los requisitos a verde
        // conforme el usuario los cumpla.
        Object.entries(reglas).forEach(
            ([requisito, cumplido]) => {

                const elemento = document.querySelector(
                    `[data-requisito="${requisito}"]`
                );

                if (!elemento) return;

                elemento.classList.toggle(
                    "cumplido",
                    cumplido
                );

                elemento.setAttribute(
                    "aria-label",
                    `${cumplido ? "Cumplido" : "Pendiente"}: ${elemento.textContent.trim()}`
                );
            }
        );

        // Solo es válida si cumple todas las reglas.
        return Object.values(reglas).every(Boolean);
    }

    // Evaluar mientras escribe la contraseña.
    passwordInput?.addEventListener(
        "input",
        evaluarRequisitosPassword
    );

    // Evaluar mientras confirma la contraseña.
    confirmarInput?.addEventListener(
        "input",
        evaluarRequisitosPassword
    );

    evaluarRequisitosPassword();

    // ========================================
    // VENTANA ANIMADA PARA ENVIAR CORREO
    // ========================================

    const ventanaEnvio =
        document.getElementById("ventanaEnvio");

    const tituloVentanaEnvio =
        document.getElementById("tituloVentanaEnvio");

    const descripcionVentanaEnvio =
        document.getElementById("descripcionVentanaEnvio");

    const iconoExitoEnvio =
        ventanaEnvio?.querySelector(".icono-exito-envio");

    // Mostrar ventana mientras se envía el correo.
    function abrirVentanaEnvio() {

        if (!ventanaEnvio) return;

        ventanaEnvio.classList.remove("exito");

        if (tituloVentanaEnvio) {
            tituloVentanaEnvio.textContent =
                "Enviando tu código…";
        }

        if (descripcionVentanaEnvio) {
            descripcionVentanaEnvio.textContent =
                "Estamos preparando el mensaje para tu correo electrónico.";
        }

        if (iconoExitoEnvio) {
            iconoExitoEnvio.hidden = true;
        }

        ventanaEnvio.hidden = false;
    }

    // Mostrar confirmación cuando la API responda.
    function mostrarEnvioExitoso() {

        if (!ventanaEnvio) return;

        ventanaEnvio.classList.add("exito");

        if (tituloVentanaEnvio) {
            tituloVentanaEnvio.textContent =
                "¡Código enviado!";
        }

        if (descripcionVentanaEnvio) {
            descripcionVentanaEnvio.textContent =
                "Revisa tu bandeja de entrada y tu carpeta de spam.";
        }

        if (iconoExitoEnvio) {
            iconoExitoEnvio.hidden = false;
        }
    }

    // Ocultar la ventana.
    function cerrarVentanaEnvio() {

        if (ventanaEnvio) {
            ventanaEnvio.hidden = true;
        }
    }

    // ========================================
    // VALIDAR DATOS PERSONALES
    // ========================================

    function prepararDatos() {

        const nombre =
            document.getElementById("nombre");

        const paterno =
            document.getElementById("apellidoPaterno");

        const materno =
            document.getElementById("apellidoMaterno");

        // Revisar los tres campos de nombre.
        // El apellido materno es opcional.
        for (const campo of [nombre, paterno, materno]) {

            if (!campo) continue;

            campo.value = campo.value
                .replace(/\s+/g, " ")
                .trim();

            const obligatorio =
                campo === nombre || campo === paterno;

            if (
                (obligatorio && !campo.value) ||
                (
                    campo.value &&
                    !expresionNombre.test(campo.value)
                )
            ) {

                mostrarError(
                    "errorDatos",
                    "Escribe nombres y apellidos solo con letras y espacios."
                );

                campo.focus();

                return false;
            }
        }

        // Comprobar que el teléfono tenga 10 dígitos.
        if (
            !nombre ||
            !paterno ||
            !telefonoInput ||
            !/^\d{10}$/.test(telefonoInput.value)
        ) {

            mostrarError(
                "errorDatos",
                "Introduce un número de teléfono válido de 10 dígitos."
            );

            telefonoInput?.focus();

            return false;
        }

        mostrarMensaje("errorDatos", false);

        return true;
    }

    // ========================================
    // VALIDAR CONTRASEÑAS
    // ========================================

    function prepararPassword() {

        if (!passwordInput || !confirmarInput) {
            return false;
        }

        // Revisar todos los requisitos.
        if (!evaluarRequisitosPassword()) {

            mostrarError(
                "errorPassword",
                "La contraseña debe cumplir todos los requisitos y coincidir con su confirmación."
            );

            return false;
        }

        mostrarMensaje("errorPassword", false);

        return true;
    }

    // ========================================
    // OBTENER DATOS DEL NUEVO USUARIO
    // ========================================

    function obtenerDatosRegistro() {

        return {

            correo: correoSolicitado,

            nombre:
                document.getElementById("nombre")
                    .value.trim(),

            apellidoPaterno:
                document.getElementById("apellidoPaterno")
                    .value.trim(),

            apellidoMaterno:
                document.getElementById("apellidoMaterno")
                    ?.value.trim() || "",

            telefono:
                document.getElementById("telefono")
                    .value.trim(),

            password:
                document.getElementById("password")
                    .value
        };
    }

    // ========================================
    // INVALIDAR VERIFICACIÓN SI CAMBIA CORREO
    // ========================================

    correoInput?.addEventListener("input", () => {

        const correoActual =
            correoInput.value.trim().toLowerCase();

        if (correoActual !== correoSolicitado) {
            correoValidado = false;
        }
    });

    // ========================================
    // CONTADOR PARA REENVIAR CÓDIGO
    // ========================================

    function actualizarContadorReenvio() {

        const segundosRestantes = Math.max(
            0,
            Math.ceil(
                (finEsperaReenvio - Date.now()) / 1000
            )
        );

        const minutos = Math.floor(segundosRestantes / 60);
        const segundos = segundosRestantes % 60;

        const tiempo =
            String(minutos).padStart(2, "0") + ":" +
            String(segundos).padStart(2, "0");

        if (tiempoReenvio) {
            tiempoReenvio.textContent = tiempo;
        }

        if (btnReenviarCodigo) {
            btnReenviarCodigo.disabled =
                segundosRestantes > 0 || reenviandoCodigo;
        }

        if (segundosRestantes === 0) {

            if (textoReenvio) {
                textoReenvio.textContent =
                    "¿No recibiste el código? Puedes solicitar otro.";
            }

            contadorCodigo?.classList.add("disponible");

            if (intervaloReenvio !== null) {
                clearInterval(intervaloReenvio);
                intervaloReenvio = null;
            }

        } else {

            if (textoReenvio) {
                textoReenvio.textContent =
                    "Podrás solicitar otro código en:";
            }

            contadorCodigo?.classList.remove("disponible");
        }
    }

    // ========================================
    // INICIAR CONTADOR DE 60 SEGUNDOS
    // ========================================

    function iniciarContadorReenvio() {

        finEsperaReenvio =
            Date.now() + DURACION_REENVIO * 1000;

        if (intervaloReenvio !== null) {
            clearInterval(intervaloReenvio);
        }

        actualizarContadorReenvio();

        intervaloReenvio = setInterval(
            actualizarContadorReenvio,
            250
        );
    }

    // ========================================
    // BOTÓN REENVIAR CÓDIGO
    // ========================================

    btnReenviarCodigo?.addEventListener(
        "click",
        async () => {

            // Evitar solicitudes duplicadas.
            if (
                reenviandoCodigo ||
                Date.now() < finEsperaReenvio ||
                !correoSolicitado ||
                correoValidado
            ) {
                return;
            }

            reenviandoCodigo = true;
            actualizarContadorReenvio();
            limpiarMensajes();

            try {

                // Mostrar animación de envío.
                abrirVentanaEnvio();

                // Reutilizar la API que ya funciona.
                await solicitarCodigoRegistro(
                    correoSolicitado
                );

                // Limpiar el código anterior.
                if (codigoInput) {
                    codigoInput.value = "";
                }

                // Reiniciar contador después del éxito.
                iniciarContadorReenvio();

                // Mostrar confirmación.
                mostrarEnvioExitoso();

                await new Promise(resolve =>
                    setTimeout(resolve, 850)
                );

            } catch (error) {

                console.error(
                    "Error al reenviar código:",
                    error
                );

                mostrarError(
                    "errorCodigo",
                    error.message ||
                    "No fue posible reenviar el código."
                );

            } finally {

                cerrarVentanaEnvio();

                reenviandoCodigo = false;
                actualizarContadorReenvio();
            }
        }
    );

    // ========================================
    // BOTONES PARA AVANZAR
    // ========================================

    document.querySelectorAll("[data-siguiente]")
        .forEach(boton => {

            boton.addEventListener(
                "click",
                async (evento) => {

                    evento.preventDefault();

                    limpiarMensajes();

                    const destino =
                        boton.dataset.siguiente;

                    const indiceDestino =
                        pantallas.indexOf(destino);

                    if (indiceDestino === -1) return;

                    if (boton.disabled) return;

                    // Evitar solicitudes duplicadas.
                    boton.disabled = true;

                    try {

                        // ========================================
                        // 1. ENVIAR CÓDIGO POR CORREO
                        // ========================================

                        if (destino === "pantallaVerificacion") {

                            if (!prepararCorreo()) return;

                            if (
                                typeof solicitarCodigoRegistro !== "function"
                            ) {
                                throw new Error(
                                    "No se encontró la función de envío en app.js."
                                );
                            }

                            const correo =
                                correoInput.value
                                    .trim()
                                    .toLowerCase();

                            // Mostrar la ventana de carga.
                            abrirVentanaEnvio();

                            // Esperar respuesta real de la API.
                            await solicitarCodigoRegistro(correo);

                            // Solo mostrar éxito si la API respondió bien.
                            mostrarEnvioExitoso();

                            // Mostrar brevemente la confirmación.
                            await new Promise(resolve =>
                                setTimeout(resolve, 850)
                            );

                            correoSolicitado = correo;
                            correoValidado = false;

                            if (codigoInput) {
                                codigoInput.value = "";
                            }

                            // Iniciar los 60 segundos después del primer envío.
                            iniciarContadorReenvio();

                            mostrarPantalla(indiceDestino);


                            return;
                        }

                        // ========================================
                        // 2. VALIDAR EL CÓDIGO RECIBIDO
                        // ========================================

                        if (destino === "pantallaDatos") {

                            const codigo =
                                codigoInput?.value.trim() || "";

                            if (!/^\d{6}$/.test(codigo)) {

                                mostrarError(
                                    "errorCodigo",
                                    "Introduce el código de seis dígitos."
                                );

                                codigoInput?.focus();

                                return;
                            }

                            if (!correoSolicitado) {

                                mostrarError(
                                    "errorCodigo",
                                    "Primero debes solicitar un código."
                                );

                                return;
                            }

                            if (
                                typeof validarCodigoRegistro !== "function"
                            ) {
                                throw new Error(
                                    "No se encontró la función de validación en app.js."
                                );
                            }

                            // Consultar la API de verificación.
                            await validarCodigoRegistro(
                                correoSolicitado,
                                codigo
                            );

                            // Solo permitir avanzar si fue correcto.
                            correoValidado = true;

                            mostrarPantalla(indiceDestino);

                            return;
                        }

                        // ========================================
                        // 3. VALIDAR DATOS PERSONALES
                        // ========================================

                        if (destino === "pantallaPassword") {

                            if (!correoValidado) {

                                mostrarError(
                                    "errorDatos",
                                    "Primero debes verificar tu correo."
                                );

                                return;
                            }

                            if (!prepararDatos()) return;

                            mostrarPantalla(indiceDestino);

                            return;
                        }

                        // ========================================
                        // 4. REGISTRAR USUARIO EN SQL SERVER
                        // ========================================

                        if (destino === "pantallaFinal") {

                            if (!correoValidado) {

                                mostrarError(
                                    "errorPassword",
                                    "Debes verificar tu correo antes de registrarte."
                                );

                                return;
                            }

                            if (!prepararPassword()) return;

                            if (
                                typeof registrarUsuarioRegistro !== "function"
                            ) {
                                throw new Error(
                                    "El registro de usuarios todavía no está conectado."
                                );
                            }

                            const datos = obtenerDatosRegistro();

                            // Esperar a que SQL Server confirme el registro.
                            await registrarUsuarioRegistro(datos);

                            // Mostrar éxito solo cuando termine.
                            mostrarPantalla(indiceDestino);

                            return;
                        }

                        // ========================================
                        // NAVEGACIÓN GENERAL
                        // ========================================

                        mostrarPantalla(indiceDestino);

                    } catch (error) {

                        console.error(
                            "Error en el registro:",
                            error
                        );

                        const mensaje =
                            error.message ||
                            "Ocurrió un error inesperado.";

                        // Mostrar el error en la pantalla correcta.
                        if (destino === "pantallaVerificacion") {

                            mostrarError(
                                "errorCorreo",
                                mensaje
                            );

                        } else if (destino === "pantallaDatos") {

                            mostrarError(
                                "errorCodigo",
                                mensaje
                            );

                        } else if (destino === "pantallaFinal") {

                            mostrarError(
                                "errorPassword",
                                mensaje
                            );

                        } else {

                            mostrarError(
                                "errorDatos",
                                mensaje
                            );
                        }

                    } finally {

                        // Ocultar la ventana al terminar.
                        cerrarVentanaEnvio();

                        // Reactivar el botón.
                        boton.disabled = false;
                    }
                }
            );
        });

    // ========================================
    // BOTONES PARA REGRESAR
    // ========================================

    document.querySelectorAll("[data-anterior]")
        .forEach(boton => {

            boton.addEventListener("click", (evento) => {

                evento.preventDefault();

                limpiarMensajes();

                const destino =
                    boton.dataset.anterior;

                const indiceDestino =
                    pantallas.indexOf(destino);

                if (indiceDestino !== -1) {
                    mostrarPantalla(indiceDestino);
                }
            });
        });

    // ========================================
    // INICIO
    // ========================================

    mostrarPantalla(0);

});
