
/* ==========================================================
   ADSPORT - COMPONENTES COMPARTIDOS
   Archivo: layout.js

   1. Cargar Header y Footer
   2. Detectar página activa
   3. Comprobar sesión del usuario
   4. Mostrar botones según autenticación
   5. Cerrar sesión
   ========================================================== */

document.addEventListener("DOMContentLoaded", () => {

    // ========================================
    // CONFIGURACIÓN GENERAL
    // ========================================

    const RUTA_HEADER = "/componetes/heder.html";
    const RUTA_FOOTER = "/componetes/footer.html";

    const API_SESION = "/api/LoginUsuario/sesion";
    const API_LOGOUT = "/api/LoginUsuario/logout";

    const PAGINA_LOGIN = "/loginUsuario.html";

    // ========================================
    // 1. CARGAR COMPONENTES HTML
    // ========================================

    async function cargarComponente(ruta, idContenedor) {

        const contenedor =
            document.getElementById(idContenedor);

        if (!contenedor) {
            return false;
        }

        try {

            const respuesta = await fetch(ruta, {
                method: "GET",
                cache: "no-store"
            });

            if (!respuesta.ok) {
                throw new Error(
                    `No se pudo cargar ${ruta}. HTTP ${respuesta.status}`
                );
            }

            const contenido = await respuesta.text();

            contenedor.innerHTML = contenido;

            return true;

        } catch (error) {

            console.error(
                "ADSPORT - Error al cargar componente:",
                error
            );

            return false;
        }
    }

    // ========================================
    // 2. IDENTIFICAR PÁGINA ACTIVA
    // ========================================

    function marcarPaginaActiva() {

        const paginaActual = window.location.pathname
            .split("/")
            .pop()
            .toLowerCase();

        const seccionActual =
            window.location.hash.toLowerCase();

        const enlaces = document.querySelectorAll(
            ".profile-nav [data-nav]"
        );

        // Quitar selección anterior.
        enlaces.forEach(enlace => {

            enlace.classList.remove("activo");

            enlace.removeAttribute("aria-current");
        });

        let seccionActiva = "";

        // ========================================
        // PÁGINA INICIO
        // ========================================

        if (
            paginaActual === "indexusuario.html" ||
            paginaActual === ""
        ) {

            if (seccionActual === "#clases") {
                seccionActiva = "clases";
            } else {
                seccionActiva = "inicio";
            }
        }

        // ========================================
        // PÁGINA NOSOTROS
        // ========================================

        else if (paginaActual === "nosotros.html") {

            seccionActiva = "nosotros";
        }

        // ========================================
        // MARCAR ENLACE ACTIVO
        // ========================================

        if (seccionActiva) {

            const enlaceActivo = document.querySelector(
                `.profile-nav [data-nav="${seccionActiva}"]`
            );

            if (enlaceActivo) {

                enlaceActivo.classList.add("activo");

                enlaceActivo.setAttribute(
                    "aria-current",
                    "page"
                );
            }
        }
    }

    // ========================================
    // 3. MOSTRAR OPCIONES SEGÚN LA SESIÓN
    // ========================================

    function actualizarMenuSesion(autenticado) {

        const enlacesInvitado =
            document.querySelectorAll(
                '.profile-header [data-auth="guest"]'
            );

        const enlacesUsuario =
            document.querySelectorAll(
                '.profile-header [data-auth="user"]'
            );

        // Si NO inició sesión:
        // Mostrar INICIAR SESIÓN y ÚNETE.
        enlacesInvitado.forEach(elemento => {

            elemento.hidden = autenticado;
        });

        // Si inició sesión:
        // Mostrar CERRAR SESIÓN.
        enlacesUsuario.forEach(elemento => {

            elemento.hidden = !autenticado;
        });
    }

    // ========================================
    // 4. CONSULTAR SESIÓN EN ASP.NET CORE
    // ========================================

    async function comprobarSesion() {

        try {

            const respuesta = await fetch(API_SESION, {

                method: "GET",

                credentials: "same-origin",

                cache: "no-store",

                headers: {
                    "Accept": "application/json"
                }
            });

            // No hay sesión válida.
            if (respuesta.status === 401) {

                actualizarMenuSesion(false);

                return;
            }

            // La API todavía no existe o falló.
            if (!respuesta.ok) {

                throw new Error(
                    `Error HTTP ${respuesta.status} al comprobar la sesión.`
                );
            }

            const resultado = await respuesta.json();

            // La API debe devolver:
            // { autenticado: true }
            // o { autenticado: false }

            const autenticado =
                resultado.autenticado === true;

            actualizarMenuSesion(autenticado);

        } catch (error) {

            console.error(
                "ADSPORT - No se pudo comprobar la sesión:",
                error
            );

            // Por seguridad, no mostrar al usuario
            // como autenticado si no se pudo verificar.
            actualizarMenuSesion(false);
        }
    }

    // ========================================
    // 5. CERRAR SESIÓN
    // ========================================

    async function cerrarSesion(evento) {

        evento.preventDefault();

        const boton =
            document.getElementById("btnCerrarSesion");

        if (boton?.dataset.procesando === "true") {
            return;
        }

        if (boton) {
            boton.dataset.procesando = "true";
            boton.style.pointerEvents = "none";
            boton.textContent = "CERRANDO...";
        }

        try {

            const respuesta = await fetch(API_LOGOUT, {

                method: "POST",

                credentials: "same-origin",

                headers: {
                    "Accept": "application/json"
                }
            });

            if (!respuesta.ok) {
                throw new Error(
                    `No se pudo cerrar la sesión. HTTP ${respuesta.status}`
                );
            }

            // Actualizar menú.
            actualizarMenuSesion(false);

            // Redirigir al login de usuarios.
            window.location.replace(PAGINA_LOGIN);

        } catch (error) {

            console.error(
                "ADSPORT - Error al cerrar sesión:",
                error
            );

            alert(
                "No fue posible cerrar la sesión. Inténtalo nuevamente."
            );

        } finally {

            if (boton) {
                boton.dataset.procesando = "false";
                boton.style.pointerEvents = "";
                boton.textContent = "CERRAR SESIÓN";
            }
        }
    }

    // ========================================
    // 6. INICIALIZAR HEADER
    // ========================================

    async function inicializarHeader() {

        const cargado = await cargarComponente(
            RUTA_HEADER,
            "contenedor-header"
        );

        if (!cargado) {
            return;
        }

        // Resaltar la página actual.
        marcarPaginaActiva();

        // Cambiar selección al navegar a #clases.
        window.addEventListener(
            "hashchange",
            marcarPaginaActiva
        );

        // Vincular el botón de cerrar sesión.
        const botonCerrar =
            document.getElementById("btnCerrarSesion");

        botonCerrar?.addEventListener(
            "click",
            cerrarSesion
        );

        // Consultar si el usuario está autenticado.
        await comprobarSesion();
    }

    // ========================================
    // 7. INICIALIZAR FOOTER
    // ========================================

    async function inicializarFooter() {

        await cargarComponente(
            RUTA_FOOTER,
            "contenedor-footer"
        );
    }

    // ========================================
    // 8. INICIAR COMPONENTES
    // ========================================

    async function iniciarLayout() {

        await Promise.all([
            inicializarHeader(),
            inicializarFooter()
        ]);

        console.log(
            "ADSPORT - Componentes cargados."
        );
    }

    iniciarLayout();

});
