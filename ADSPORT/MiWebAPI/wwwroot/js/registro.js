
document.addEventListener("DOMContentLoaded", () => {

    // ========================================
    // ADSPORT - NAVEGACIÓN VISUAL DEL REGISTRO
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

    let pantallaActual = 0;

    // Mostrar una pantalla y ocultar las demás.
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

        // Actualizar indicador visual de progreso.
        pasos.forEach((paso, indicePaso) => {
            paso.classList.toggle(
                "activo",
                indicePaso === obtenerPaso(indice)
            );
        });

        // Regresar al inicio del formulario.
        const panel = document.querySelector(".panel-formulario");

        if (panel) {
            panel.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }
    }

    // Relacionar las cinco pantallas con los tres pasos visuales.
    function obtenerPaso(indice) {
        if (indice <= 1) return indice;
        if (indice <= 3) return 2;
        return 2;
    }

    // Mostrar u ocultar mensajes de demostración.
    function mostrarMensaje(id, visible) {
        const elemento = document.getElementById(id);

        if (elemento) {
            elemento.hidden = !visible;
        }
    }

    // Limpiar mensajes de error al volver a intentar.
    function limpiarMensajes() {
        [
            "errorCorreo",
            "errorCodigo",
            "errorDatos",
            "errorPassword"
        ].forEach(id => mostrarMensaje(id, false));
    }

    // Simulación visual del correo.
    function prepararCorreo() {
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

    // Validación visual básica de los datos personales.
    function prepararDatos() {
        const campos = [
            document.getElementById("nombre"),
            document.getElementById("apellidoPaterno"),
            document.getElementById("telefono")
        ];

        const incompleto = campos.some(campo =>
            !campo || !campo.value.trim()
        );

        mostrarMensaje("errorDatos", incompleto);

        return !incompleto;
    }

    // Comprobación visual de las contraseñas.
    function prepararPassword() {
        const password = document.getElementById("password");
        const confirmar = document.getElementById("confirmarPassword");

        if (!password || !confirmar) {
            return false;
        }

        const coincide =
            password.value.length > 0 &&
            password.value === confirmar.value;

        mostrarMensaje("errorPassword", !coincide);

        return coincide;
    }

    // ========================================
    // BOTONES PARA AVANZAR
    // ========================================

    document.querySelectorAll("[data-siguiente]").forEach(boton => {
        boton.addEventListener("click", () => {
            limpiarMensajes();

            const destino = boton.dataset.siguiente;

            // Validaciones únicamente para la demostración.
            if (
                destino === "pantallaVerificacion" &&
                !prepararCorreo()
            ) {
                return;
            }

            if (
                destino === "pantallaPassword" &&
                !prepararDatos()
            ) {
                return;
            }

            if (
                destino === "pantallaFinal" &&
                !prepararPassword()
            ) {
                return;
            }

            const indiceDestino = pantallas.indexOf(destino);

            if (indiceDestino !== -1) {
                mostrarPantalla(indiceDestino);
            }
        });
    });

    // ========================================
    // BOTONES PARA REGRESAR
    // ========================================

    document.querySelectorAll("[data-anterior]").forEach(boton => {
        boton.addEventListener("click", () => {
            limpiarMensajes();

            const destino = boton.dataset.anterior;
            const indiceDestino = pantallas.indexOf(destino);

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
