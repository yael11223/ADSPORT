/* ==========================================================
   ADSPORT - COMPONENTES COMPARTIDOS
   Archivo: layout.js
   ========================================================== */

document.addEventListener("DOMContentLoaded", () => {

    const RUTA_HEADER = "/componetes/heder.html";
    const RUTA_FOOTER = "/componetes/footer.html";

    const API_SESION = "/api/LoginUsuario/sesion";
    const API_LOGOUT = "/api/LoginUsuario/logout";
    const API_PERFIL = "/api/Usuario/mi-perfil";
    const API_FOTO = "/api/Usuario/mi-foto";
    const API_DEPORTE = "/api/Deporte";

    const FOTO_DEFAULT = "/Accet/perfil.png";
    let esEntrenador = false;

    const PAGINA_LOGIN = "/LoginUsuario.html";

    const PAGINAS_DEPORTES = [
        "tenis.html",
        "futbol.html",
        "baloncesto.html",
        "natacion.html"
    ];

    async function cargarDeportesEnMenu() {
        const menu = document.querySelector(".nav-dropdown__menu");
        if (!menu) return;
        try {
            const respuesta = await fetch("/api/Deporte", { cache: "no-store" });
            if (!respuesta.ok) throw new Error("No fue posible consultar los deportes.");
            const deportes = await respuesta.json();
            const titulo = document.createElement("span");
            titulo.className = "nav-dropdown__titulo";
            titulo.textContent = "EXPLORA LOS DEPORTES";
            menu.replaceChildren(titulo);
            for (const deporte of deportes) {
                const enlace = document.createElement("a");
                enlace.className = "nav-dropdown__item";
                enlace.dataset.deporteId = String(deporte.idDeporte);
                enlace.href = "/tenis.html?" + new URLSearchParams({
                    idDeporte: deporte.idDeporte, deporte: deporte.nombreDeporte
                });
                enlace.textContent = deporte.nombreDeporte;
                menu.append(enlace);
            }
            if (!deportes.length) {
                const vacio = document.createElement("span");
                vacio.className = "nav-dropdown__item";
                vacio.textContent = "Sin deportes disponibles";
                menu.append(vacio);
            }
            const todos = document.createElement("a");
            todos.className = "nav-dropdown__todos";
            todos.href = "/tenis.html?deporte=todos";
            todos.textContent = "VER TODAS LAS CLASES →";
            menu.append(todos);
        } catch (error) {
            console.error("ADSPORT - Error al cargar deportes:", error);
        }
    }


    // ========================================
    // 1. CARGAR COMPONENTES
    // ========================================

    async function cargarComponente(ruta, idContenedor) {
        const contenedor = document.getElementById(idContenedor);
        if (!contenedor) return false;

        try {
            const respuesta = await fetch(ruta, {
                method: "GET",
                cache: "no-store"
            });

            if (!respuesta.ok) {
                throw new Error(`Error HTTP ${respuesta.status}: ${ruta}`);
            }

            contenedor.innerHTML = await respuesta.text();
            return true;
        } catch (error) {
            console.error("ADSPORT - Error al cargar componente:", error);
            return false;
        }
    }

    function marcarPaginaActiva() {
        const paginaActual = window.location.pathname
            .split("/")
            .pop()
            .toLowerCase();

        const seccionActual = window.location.hash.toLowerCase();

        const enlaces = document.querySelectorAll(".profile-nav [data-nav]");
        enlaces.forEach(enlace => {
            enlace.classList.remove("activo");
            enlace.removeAttribute("aria-current");
        });

        let seccionActiva = "";

        if (paginaActual === "indexusuario.html" || paginaActual === "") {
            seccionActiva = seccionActual === "#clases" ? "clases" : "inicio";
        } else if (paginaActual === "nosotros.html") {
            seccionActiva = "nosotros";
        } else if (paginaActual === "instalaciones.html") {
            seccionActiva = "instalaciones";
        } else if (paginaActual === "tenis.html" || paginaActual === "clases.html") {
            seccionActiva = "clases";
        }

        if (seccionActiva) {
            const enlaceActivo = document.querySelector(`.profile-nav [data-nav="${seccionActiva}"]`);
            if (enlaceActivo) {
                enlaceActivo.classList.add("activo");
                if (enlaceActivo.tagName.toLowerCase() === "a") {
                    enlaceActivo.setAttribute("aria-current", "page");
                }
            }
        }

        // Marcar el deporte seleccionado.
        if (PAGINAS_DEPORTES.includes(paginaActual)) {
            const enlacesDeportes = document.querySelectorAll(".nav-dropdown__menu a");

            enlacesDeportes.forEach(enlace => {

                const ruta = enlace.getAttribute("href");

                if (!ruta) return;

                const destino = new URL(ruta, window.location.origin);
                const parametros = new URLSearchParams(window.location.search);
                const idActual = parametros.get("idDeporte");
                const nombreActual = parametros.get("deporte") || "Tenis";
                const coincide = idActual ? destino.searchParams.get("idDeporte") === idActual :
                    (destino.searchParams.get("deporte") || "Tenis").localeCompare(nombreActual, "es", { sensitivity: "base" }) === 0;

                if (destino.pathname.toLowerCase() === "/" + paginaActual && coincide) {

                    enlace.classList.add("activo");

                    enlace.setAttribute(
                        "aria-current",
                        "page"
                    );
                }
            });
        }
    }

    function configurarMenus() {
        const menus = [
            document.querySelector(".nav-dropdown"),
            document.getElementById("menuUsuario")
        ].filter(Boolean);

        menus.forEach(menu => {
            menu.addEventListener("toggle", () => {
                if (!menu.open) return;
                menus.forEach(otroMenu => {
                    if (otroMenu !== menu) otroMenu.open = false;
                });
            });
        });

        document.addEventListener("click", evento => {
            menus.forEach(menu => {
                if (menu.open && !menu.contains(evento.target)) {
                    menu.open = false;
                }
            });
        });

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

    function actualizarMenuSesion(autenticado) {
        const invitados = document.querySelectorAll('.profile-header [data-auth="guest"]');
        const usuarios = document.querySelectorAll('.profile-header [data-auth="user"]');

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

    function establecerPerfilPredeterminado() {
        const nombreHeader = document.getElementById("nombreUsuarioHeader");
        const nombreMenu = document.getElementById("nombreUsuarioMenu");

        if (nombreHeader) nombreHeader.textContent = "MI CUENTA";
        if (nombreMenu) nombreMenu.textContent = "Mi cuenta";

        actualizarFotografias(FOTO_DEFAULT);
    }

    function actualizarFotografias(rutaFoto) {
        const imagenes = [
            document.getElementById("fotoUsuarioHeader"),
            document.getElementById("fotoUsuarioMenu")
        ];

        imagenes.forEach(imagen => {
            if (!imagen) return;
            imagen.onerror = () => {
                imagen.onerror = null;
                imagen.src = FOTO_DEFAULT;
            };
            imagen.src = rutaFoto;
        });
    }

    async function cargarPerfilUsuario() {
        try {
            const respuesta = await fetch(API_PERFIL, {
                method: "GET",
                credentials: "same-origin",
                cache: "no-store",
                headers: { "Accept": "application/json" }
            });

            if (respuesta.status === 401) {
                actualizarMenuSesion(false);
                return;
            }

            if (!respuesta.ok) {
                throw new Error(`Error HTTP ${respuesta.status} al obtener perfil.`);
            }

            const usuario = await respuesta.json();
            const nombreCompleto = usuario.nombreCompleto || [usuario.nombre, usuario.apellidoPaterno, usuario.apellidoMaterno].filter(Boolean).join(" ");
            const primerNombre = (usuario.nombre || nombreCompleto || "Mi cuenta").trim().split(/\s+/)[0];
            esEntrenador = (usuario.nombreRol || "").trim().toUpperCase() === "ENTRENADOR";
            const enlacePerfil = document.getElementById("enlaceMiPerfil");
            if (enlacePerfil) enlacePerfil.href = esEntrenador ? "/perfilEntrenador.html" : "/perfilCliente.html";

            const nombreHeader = document.getElementById("nombreUsuarioHeader");
            if (nombreHeader) nombreHeader.textContent = primerNombre;

            const nombreMenu = document.getElementById("nombreUsuarioMenu");
            if (nombreMenu) nombreMenu.textContent = nombreCompleto;

            if (usuario.tieneFoto === true) {
                actualizarFotografias(API_FOTO);
            } else {
                actualizarFotografias(FOTO_DEFAULT);
            }
        } catch (error) {
            console.error("ADSPORT - No se pudo cargar el perfil:", error);
            establecerPerfilPredeterminado();
        }
    }

    async function comprobarSesion() {
        try {
            const respuesta = await fetch(API_SESION, {
                method: "GET",
                credentials: "same-origin",
                cache: "no-store",
                headers: { "Accept": "application/json" }
            });

            if (respuesta.status === 401) {
                actualizarMenuSesion(false);
                return;
            }

            if (!respuesta.ok) {
                throw new Error(`Error HTTP ${respuesta.status}`);
            }

            const resultado = await respuesta.json();
            const autenticado = resultado.autenticado === true;

            actualizarMenuSesion(autenticado);

            if (autenticado) {
                await cargarPerfilUsuario();
            }
        } catch (error) {
            console.error("ADSPORT - Error al comprobar sesión:", error);
            actualizarMenuSesion(false);
        }
    }

    async function cerrarSesion(evento) {
        evento.preventDefault();

        const boton = document.getElementById("btnCerrarSesion");
        if (boton?.dataset.procesando === "true") return;

        if (boton) {
            boton.dataset.procesando = "true";
            boton.style.pointerEvents = "none";
            boton.textContent = "CERRANDO...";
        }

        try {

            const csrf = await fetch("/api/Entrenador/csrf", { cache: "no-store" }).then(r => r.json());
            const respuesta = await fetch(esEntrenador ? "/api/Entrenador/logout" : API_LOGOUT, {

                method: "POST",
                credentials: "same-origin",

                headers: {
                    "Accept": "application/json",
                    "X-CSRF-TOKEN": csrf.token
                }
            });

            if (!respuesta.ok) {
                throw new Error(`No se pudo cerrar sesión. HTTP ${respuesta.status}`);
            }

            actualizarMenuSesion(false);

            window.location.replace(esEntrenador ? "/loginEntrenador.html" : PAGINA_LOGIN);

        } catch (error) {
            console.error("ADSPORT - Error al cerrar sesión:", error);
            alert("No fue posible cerrar sesión. Inténtalo nuevamente.");
        } finally {
            if (boton) {
                boton.dataset.procesando = "false";
                boton.style.pointerEvents = "";
                boton.textContent = "CERRAR SESIÓN";
            }
        }
    }

    async function inicializarHeader() {
        const cargado = await cargarComponente(RUTA_HEADER, "contenedor-header");
        if (!cargado) return;

        await cargarDeportesEnMenu();

        marcarPaginaActiva();
        configurarMenus();
        establecerPerfilPredeterminado();

        window.addEventListener(
            "hashchange",
            marcarPaginaActiva
        );
        window.addEventListener("adsport:deporte-cambiado", marcarPaginaActiva);

        const botonCerrar = document.getElementById("btnCerrarSesion");
        botonCerrar?.addEventListener("click", cerrarSesion);

        await comprobarSesion();
    }

    async function inicializarFooter() {
        await cargarComponente(RUTA_FOOTER, "contenedor-footer");
    }

    async function iniciarLayout() {
        await Promise.all([
            inicializarHeader(),
            inicializarFooter()
        ]);
    }

    iniciarLayout();
});
