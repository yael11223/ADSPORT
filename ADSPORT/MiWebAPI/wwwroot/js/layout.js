
/* ==========================================================
   ADSPORT - COMPONENTES COMPARTIDOS
   Archivo: layout.js

   1. Cargar Header y Footer
   2. Detectar página activa
   3. Controlar menús desplegables
   4. Comprobar sesión
   5. Mostrar nombre y fotografía del usuario
   6. Cerrar sesión
   ========================================================== */

document.addEventListener("DOMContentLoaded", () => {

    // ========================================
    // CONFIGURACIÓN
    // ========================================

    const RUTA_HEADER = "/componetes/heder.html";
    const RUTA_FOOTER = "/componetes/footer.html";

    const API_SESION = "/api/LoginUsuario/sesion";
    const API_LOGOUT = "/api/LoginUsuario/logout";

    const API_PERFIL = "/api/Usuario/mi-perfil";
    const API_FOTO = "/api/Usuario/mi-foto";

    const FOTO_DEFAULT = "/Accet/perfil.png";

    const PAGINA_LOGIN = "/loginUsuario.html";

    const PAGINAS_DEPORTES = [
        "tenis.html",
        "futbol.html",
        "baloncesto.html",
        "natacion.html"
    ];


    // ========================================
    // 1. CARGAR COMPONENTES
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
                    `Error HTTP ${respuesta.status}: ${ruta}`
                );
            }

            contenedor.innerHTML =
                await respuesta.text();

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
    // 2. MARCAR PÁGINA ACTIVA
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

        enlaces.forEach(enlace => {
            enlace.classList.remove("activo");
            enlace.removeAttribute("aria-current");
        });

        const enlacesDeportes = document.querySelectorAll(
            ".nav-dropdown__menu a"
        );

        enlacesDeportes.forEach(enlace => {
            enlace.classList.remove("activo");
            enlace.removeAttribute("aria-current");
        });

        let seccionActiva = "";

        if (
            paginaActual === "indexusuario.html" ||
            paginaActual === ""
        ) {

            seccionActiva =
                seccionActual === "#clases"
                    ? "clases"
                    : "inicio";

        } else if (paginaActual === "nosotros.html") {

            seccionActiva = "nosotros";

        } else if (
            PAGINAS_DEPORTES.includes(paginaActual)
        ) {

            seccionActiva = "clases";
        }

        if (seccionActiva) {

            const enlaceActivo = document.querySelector(
                `.profile-nav [data-nav="${seccionActiva}"]`
            );

            if (enlaceActivo) {

                enlaceActivo.classList.add("activo");

                if (
                    enlaceActivo.tagName.toLowerCase() === "a"
                ) {
                    enlaceActivo.setAttribute(
                        "aria-current",
                        "page"
                    );
                }
            }
        }

        // Marcar el deporte seleccionado.
        if (PAGINAS_DEPORTES.includes(paginaActual)) {

            enlacesDeportes.forEach(enlace => {

                const ruta = enlace.getAttribute("href");

                if (!ruta) return;

                const destino = ruta
                    .split("#")[0]
                    .split("/")
                    .pop()
                    .toLowerCase();

                if (destino === paginaActual) {

                    enlace.classList.add("activo");

                    enlace.setAttribute(
                        "aria-current",
                        "page"
                    );
                }
            });
        }
    }


    // ========================================
    // 3. CONFIGURAR MENÚS DESPLEGABLES
    // ========================================

    function configurarMenus() {

        const menus = [
            document.querySelector(".nav-dropdown"),
            document.getElementById("menuUsuario")
        ].filter(Boolean);

        // Al abrir uno, cerrar el otro.
        menus.forEach(menu => {

            menu.addEventListener("toggle", () => {

                if (!menu.open) return;

                menus.forEach(otroMenu => {

                    if (otroMenu !== menu) {
                        otroMenu.open = false;
                    }
                });
            });
        });

        // Cerrar al hacer clic fuera.
        document.addEventListener("click", evento => {

            menus.forEach(menu => {

                if (
                    menu.open &&
                    !menu.contains(evento.target)
                ) {
                    menu.open = false;
                }
            });
        });

        // Cerrar con Escape.
        document.addEventListener("keydown", evento => {

            if (evento.key !== "Escape") return;

            menus.forEach(menu => {

                if (menu.open) {

                    menu.open = false;

                    menu.querySelector("summary")?.focus();
                }
            });
        });
    }


    // ========================================
    // 4. MOSTRAR ELEMENTOS SEGÚN SESIÓN
    // ========================================

    function actualizarMenuSesion(autenticado) {

        const invitados = document.querySelectorAll(
            '.profile-header [data-auth="guest"]'
        );

        const usuarios = document.querySelectorAll(
            '.profile-header [data-auth="user"]'
        );

        invitados.forEach(elemento => {
            elemento.hidden = autenticado;
        });

        usuarios.forEach(elemento => {
            elemento.hidden = !autenticado;

            if (!autenticado && elemento.tagName === "DETAILS") {
                elemento.open = false;
            }
        });

        if (!autenticado) {
            establecerPerfilPredeterminado();
        }
    }


    // ========================================
    // 5. PERFIL PREDETERMINADO
    // ========================================

    function establecerPerfilPredeterminado() {

        const nombreHeader =
            document.getElementById("nombreUsuarioHeader");

        const nombreMenu =
            document.getElementById("nombreUsuarioMenu");

        if (nombreHeader) {
            nombreHeader.textContent = "MI CUENTA";
        }

        if (nombreMenu) {
            nombreMenu.textContent = "Mi cuenta";
        }

        actualizarFotografias(FOTO_DEFAULT);
    }


    // ========================================
    // 6. ACTUALIZAR FOTOGRAFÍAS
    // ========================================

    function actualizarFotografias(rutaFoto) {

        const imagenes = [
            document.getElementById("fotoUsuarioHeader"),
            document.getElementById("fotoUsuarioMenu")
        ];

        imagenes.forEach(imagen => {

            if (!imagen) return;

            // Si falla la imagen, usar la predeterminada.
            imagen.onerror = () => {

                imagen.onerror = null;

                imagen.src = FOTO_DEFAULT;
            };

            imagen.src = rutaFoto;
        });
    }


    // ========================================
    // 7. OBTENER PERFIL DESDE LA API
    // ========================================

    async function cargarPerfilUsuario() {

        try {

            const respuesta = await fetch(API_PERFIL, {

                method: "GET",

                credentials: "same-origin",

                cache: "no-store",

                headers: {
                    "Accept": "application/json"
                }
            });

            if (respuesta.status === 401) {

                actualizarMenuSesion(false);

                return;
            }

            if (!respuesta.ok) {

                throw new Error(
                    `Error HTTP ${respuesta.status} al obtener perfil.`
                );
            }

            const usuario = await respuesta.json();

            // Obtener nombre real de la API.
            const nombreCompleto = (
                usuario.nombreCompleto ||
                usuario.nombre ||
                "MI CUENTA"
            ).trim();

            const primerNombre = (
                usuario.nombre ||
                nombreCompleto
            ).trim();

            // ====================================
            // MOSTRAR NOMBRE EN EL HEADER
            // ====================================

            const nombreHeader =
                document.getElementById("nombreUsuarioHeader");

            if (nombreHeader) {
                nombreHeader.textContent = primerNombre;
            }

            // ====================================
            // MOSTRAR NOMBRE EN EL MENÚ
            // ====================================

            const nombreMenu =
                document.getElementById("nombreUsuarioMenu");

            if (nombreMenu) {
                nombreMenu.textContent = nombreCompleto;
            }

            // ====================================
            // MOSTRAR FOTOGRAFÍA
            // ====================================

            if (usuario.tieneFoto === true) {

                actualizarFotografias(API_FOTO);

            } else {

                actualizarFotografias(FOTO_DEFAULT);
            }

            console.log(
                "ADSPORT - Perfil de usuario cargado."
            );

        } catch (error) {

            console.error(
                "ADSPORT - No se pudo cargar el perfil:",
                error
            );

            establecerPerfilPredeterminado();
        }
    }


    // ========================================
    // 8. COMPROBAR SESIÓN
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

            if (respuesta.status === 401) {

                actualizarMenuSesion(false);

                return;
            }

            if (!respuesta.ok) {

                throw new Error(
                    `Error HTTP ${respuesta.status}`
                );
            }

            const resultado = await respuesta.json();

            const autenticado =
                resultado.autenticado === true;

            actualizarMenuSesion(autenticado);

            // Si hay sesión, consultar sus datos.
            if (autenticado) {

                await cargarPerfilUsuario();
            }

        } catch (error) {

            console.error(
                "ADSPORT - Error al comprobar sesión:",
                error
            );

            actualizarMenuSesion(false);
        }
    }


    // ========================================
    // 9. CERRAR SESIÓN
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
                    `No se pudo cerrar sesión. HTTP ${respuesta.status}`
                );
            }

            actualizarMenuSesion(false);

            window.location.replace(PAGINA_LOGIN);

        } catch (error) {

            console.error(
                "ADSPORT - Error al cerrar sesión:",
                error
            );

            alert(
                "No fue posible cerrar sesión. Inténtalo nuevamente."
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
    // 10. INICIALIZAR HEADER
    // ========================================

    async function inicializarHeader() {

        const cargado = await cargarComponente(
            RUTA_HEADER,
            "contenedor-header"
        );

        if (!cargado) return;

        marcarPaginaActiva();

        configurarMenus();

        establecerPerfilPredeterminado();

        window.addEventListener(
            "hashchange",
            marcarPaginaActiva
        );

        const botonCerrar =
            document.getElementById("btnCerrarSesion");

        botonCerrar?.addEventListener(
            "click",
            cerrarSesion
        );

        await comprobarSesion();
    }


    // ========================================
    // 11. INICIALIZAR FOOTER
    // ========================================

    async function inicializarFooter() {

        await cargarComponente(
            RUTA_FOOTER,
            "contenedor-footer"
        );
    }


    // ========================================
    // 12. INICIAR COMPONENTES
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
