
document.addEventListener("DOMContentLoaded", () => {

    // ========================================
    // ADSPORT - API DE REGISTRO (INDEPENDIENTE)
    // ========================================

    async function solicitarAPIRegistro(ruta, datos, codigosExito) {
        const respuesta = await fetch(ruta, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(datos)
        });

        let resultado;

        try {
            resultado = await respuesta.json();
        } catch {
            throw new Error(
                `El servidor no devolvió JSON válido (HTTP ${respuesta.status}).`
            );
        }

        if (
            !respuesta.ok ||
            !resultado ||
            !codigosExito.includes(Number(resultado.numeroError))
        ) {
            throw new Error(
                resultado?.respuesta ||
                resultado?.mensaje ||
                `Error HTTP ${respuesta.status} al conectar con el servidor.`
            );
        }

        return resultado;
    }

    function solicitarCodigoRegistro(correo) {
        return solicitarAPIRegistro(
            "/api/Verificacion/agregar",
            { correo },
            [200]
        );
    }

    function validarCodigoRegistro(correo, codigo) {
        return solicitarAPIRegistro(
            "/api/Verificacion/validar",
            { correo, codigo },
            [200]
        );
    }

    function registrarUsuarioRegistro(datos) {
        return solicitarAPIRegistro(
            "/api/Verificacion/registrar",
            datos,
            [201]
        );
    }

    // ========================================
    // ELEMENTOS Y ESTADO DEL FORMULARIO
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
    const telefonoInput = document.getElementById("telefono");
    const passwordInput = document.getElementById("password");
    const confirmarInput = document.getElementById("confirmarPassword");

    const btnReenviarCodigo = document.getElementById("btnReenviarCodigo");
    const tiempoReenvio = document.getElementById("tiempoReenvio");
    const textoReenvio = document.getElementById("textoReenvio");
    const contadorCodigo = document.getElementById("contadorCodigo");

    const ventanaEnvio = document.getElementById("ventanaEnvio");
    const tituloVentanaEnvio = document.getElementById("tituloVentanaEnvio");
    const descripcionVentanaEnvio = document.getElementById("descripcionVentanaEnvio");

    const iconoExitoEnvio =
        ventanaEnvio?.querySelector(".icono-exito-envio");

    const DURACION_REENVIO = 60;

    const expresionNombre =
        /^[\p{L}\p{M}]+(?: [\p{L}\p{M}]+)*$/u;

    let correoSolicitado = "";
    let correoValidado = false;

    let finEsperaReenvio = 0;
    let intervaloReenvio = null;
    let reenviandoCodigo = false;

    // ========================================
    // NAVEGACIÓN ENTRE LAS 5 PANTALLAS
    // ========================================

    function mostrarPantalla(indice) {
        if (indice < 0 || indice >= pantallas.length) return;

        pantallas.forEach((id, posicion) => {
            const pantalla = document.getElementById(id);

            if (pantalla) {
                pantalla.hidden = posicion !== indice;
            }
        });

        const pasoActual = indice <= 1 ? indice : 2;

        pasos.forEach((paso, posicion) => {
            paso.classList.toggle(
                "activo",
                posicion === pasoActual
            );
        });

        document.querySelector(".panel-formulario")
            ?.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
    }

    // ========================================
    // MENSAJES DE ERROR
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

    function mostrarError(id, texto) {
        const elemento = document.getElementById(id);

        if (!elemento) {
            alert(texto);
            return;
        }

        elemento.textContent = texto;
        elemento.hidden = false;
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
    // VALIDACIONES EN TIEMPO REAL
    // ========================================

    [
        "nombre",
        "apellidoPaterno",
        "apellidoMaterno"
    ].forEach(id => {
        const campo = document.getElementById(id);

        campo?.addEventListener("input", () => {
            if (campo.isComposing) return;

            campo.value = campo.value
                .replace(/[^\p{L}\p{M} ]/gu, "")
                .slice(0, 100);
        });

        campo?.addEventListener("blur", () => {
            campo.value = campo.value
                .replace(/\s+/g, " ")
                .trim();
        });
    });

    telefonoInput?.addEventListener("input", () => {
        telefonoInput.value = telefonoInput.value
            .replace(/\D/g, "")
            .slice(0, 10);
    });

    codigoInput?.addEventListener("input", () => {
        codigoInput.value = codigoInput.value
            .replace(/\D/g, "")
            .slice(0, 6);
    });

    correoInput?.addEventListener("input", () => {
        if (
            correoInput.value.trim().toLowerCase() !==
            correoSolicitado
        ) {
            correoValidado = false;
        }
    });

    // ========================================
    // VALIDACIÓN DE CONTRASEÑA
    // ========================================

    function evaluarRequisitosPassword() {
        const clave = passwordInput?.value || "";
        const confirmacion = confirmarInput?.value || "";

        const reglas = {
            longitud: clave.length >= 8,
            mayuscula: /[A-Z]/.test(clave),
            minuscula: /[a-z]/.test(clave),
            numero: /[0-9]/.test(clave),
            especial: /[^\p{L}\p{M}0-9\s]/u.test(clave),
            coincidencia:
                clave.length > 0 &&
                clave === confirmacion
        };

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

        return Object.values(reglas).every(Boolean);
    }

    passwordInput?.addEventListener(
        "input",
        evaluarRequisitosPassword
    );

    confirmarInput?.addEventListener(
        "input",
        evaluarRequisitosPassword
    );

    evaluarRequisitosPassword();

    // ========================================
    // VALIDAR CORREO
    // ========================================

    function prepararCorreo() {
        if (
            !correoInput ||
            !correoInput.value.trim() ||
            !correoInput.checkValidity()
        ) {
            mostrarError(
                "errorCorreo",
                "Introduce un correo electrónico válido."
            );

            correoInput?.focus();
            return false;
        }

        if (correoDestino) {
            correoDestino.textContent =
                correoInput.value.trim();
        }

        mostrarMensaje("errorCorreo", false);
        return true;
    }

    // ========================================
    // VALIDAR DATOS PERSONALES
    // ========================================

    function prepararDatos() {
        const nombre = document.getElementById("nombre");
        const paterno =
            document.getElementById("apellidoPaterno");
        const materno =
            document.getElementById("apellidoMaterno");

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
    // VALIDAR CONTRASEÑA FINAL
    // ========================================

    function prepararPassword() {
        if (
            !passwordInput ||
            !confirmarInput ||
            !evaluarRequisitosPassword()
        ) {
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
    // OBTENER DATOS DEL USUARIO
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

            telefono: telefonoInput.value.trim(),

            password: passwordInput.value
        };
    }

    // ========================================
    // VENTANA ANIMADA DEL ENVÍO DE CORREO
    // ========================================

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

    function cerrarVentanaEnvio() {
        if (ventanaEnvio) {
            ventanaEnvio.hidden = true;
        }
    }

    const esperar = ms =>
        new Promise(resolve => setTimeout(resolve, ms));

    // ========================================
    // REENVÍO DEL CÓDIGO (60 SEGUNDOS)
    // ========================================

    function actualizarContadorReenvio() {
        const restantes = Math.max(
            0,
            Math.ceil(
                (finEsperaReenvio - Date.now()) / 1000
            )
        );

        const tiempo =
            `${String(Math.floor(restantes / 60)).padStart(2, "0")}:` +
            `${String(restantes % 60).padStart(2, "0")}`;

        if (tiempoReenvio) {
            tiempoReenvio.textContent = tiempo;
        }

        if (btnReenviarCodigo) {
            btnReenviarCodigo.disabled =
                restantes > 0 || reenviandoCodigo;
        }

        if (textoReenvio) {
            textoReenvio.textContent =
                restantes > 0
                    ? "Podrás solicitar otro código en:"
                    : "¿No recibiste el código? Puedes solicitar otro.";
        }

        contadorCodigo?.classList.toggle(
            "disponible",
            restantes === 0
        );

        if (
            restantes === 0 &&
            intervaloReenvio !== null
        ) {
            clearInterval(intervaloReenvio);
            intervaloReenvio = null;
        }
    }

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
            abrirVentanaEnvio();

            try {
                await solicitarCodigoRegistro(
                    correoSolicitado
                );

                if (codigoInput) {
                    codigoInput.value = "";
                }

                iniciarContadorReenvio();
                mostrarEnvioExitoso();

                await esperar(850);

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
    // BOTONES SIGUIENTE
    // ========================================

    document.querySelectorAll("[data-siguiente]")
        .forEach(boton => {

            boton.addEventListener(
                "click",
                async evento => {

                    evento.preventDefault();

                    if (boton.disabled) return;

                    limpiarMensajes();

                    const destino =
                        boton.dataset.siguiente;

                    const indiceDestino =
                        pantallas.indexOf(destino);

                    if (indiceDestino === -1) return;

                    boton.disabled = true;

                    try {

                        // ========================================
                        // 1. ENVIAR CÓDIGO POR CORREO
                        // ========================================

                        if (destino === "pantallaVerificacion") {

                            if (!prepararCorreo()) return;

                            const correo =
                                correoInput.value
                                    .trim()
                                    .toLowerCase();

                            abrirVentanaEnvio();

                            await solicitarCodigoRegistro(
                                correo
                            );

                            mostrarEnvioExitoso();

                            await esperar(850);

                            correoSolicitado = correo;
                            correoValidado = false;

                            if (codigoInput) {
                                codigoInput.value = "";
                            }

                            iniciarContadorReenvio();

                            mostrarPantalla(indiceDestino);

                            return;
                        }

                        // ========================================
                        // 2. VALIDAR CÓDIGO RECIBIDO
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

                            await validarCodigoRegistro(
                                correoSolicitado,
                                codigo
                            );

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

                            const datos =
                                obtenerDatosRegistro();

                            await registrarUsuarioRegistro(
                                datos
                            );

                            mostrarPantalla(indiceDestino);

                            return;
                        }

                        mostrarPantalla(indiceDestino);

                    } catch (error) {

                        console.error(
                            "Error en el registro:",
                            error
                        );

                        const idError =
                            destino === "pantallaVerificacion"
                                ? "errorCorreo"
                                : destino === "pantallaDatos"
                                    ? "errorCodigo"
                                    : destino === "pantallaFinal"
                                        ? "errorPassword"
                                        : "errorDatos";

                        mostrarError(
                            idError,
                            error.message ||
                            "Ocurrió un error inesperado."
                        );

                    } finally {

                        cerrarVentanaEnvio();

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

            boton.addEventListener("click", evento => {

                evento.preventDefault();

                limpiarMensajes();

                const indice = pantallas.indexOf(
                    boton.dataset.anterior
                );

                if (indice !== -1) {
                    mostrarPantalla(indice);
                }
            });
        });

    // ========================================
    // INICIO
    // ========================================

    mostrarPantalla(0);

});
