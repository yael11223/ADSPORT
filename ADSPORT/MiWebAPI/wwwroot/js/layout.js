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
    const PAGINA_LOGIN = "/loginUsuario.html";

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

    async function cargarDeportesEnMenu() {
        const menuClases = document.querySelector(".nav-dropdown__menu");
        if (!menuClases) return;

        try {
            const res = await fetch(API_DEPORTE, { cache: "no-store" });
            if (!res.ok) return;

            const deportes = await res.json();
            const params = new URLSearchParams(window.location.search);
            const idActual = params.get("idDeporte");

            let html = `<span class="nav-dropdown__label" style="display:block; font-size:0.7rem; opacity:0.7; padding:6px 12px;">EXPLORA LOS DEPORTES</span>`;

            if (!deportes || deportes.length === 0) {
                html += `<span style="display:block; padding:8px 12px; font-size:0.85rem; color:#888;">Sin deportes registrados</span>`;
            } else {
                html += deportes.map(d => {
                    const activo = String(d.idDeporte) === String(idActual) ? "activo" : "";
                    const url = `/tenis.html?idDeporte=${d.idDeporte}&deporte=${encodeURIComponent(d.nombreDeporte)}`;
                    return `
                        <a href="${url}" class="${activo}" style="display:block; width:100%; padding:8px 12px;">
                            <span>🏅 ${d.nombreDeporte.toUpperCase()}</span>
                        </a>
                    `;
                }).join("");
            }

            html += `
                <a href="/tenis.html" class="btn-ver-todas" style="margin-top:8px; background:#ff6b00; color:#fff; font-weight:700; border-radius:6px; text-align:center; display:block; width:100%; padding:8px 12px;">
                    VER TODAS LAS CLASES →
                </a>
            `;

            menuClases.innerHTML = html;
        } catch (error) {
            console.error("ADSPORT - Error al cargar deportes en el menú:", error);
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
            const nombreCompleto = (usuario.nombreCompleto || usuario.nombre || "MI CUENTA").trim();
            const primerNombre = (usuario.nombre || nombreCompleto).trim();

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
            const respuesta = await fetch(API_LOGOUT, {
                method: "POST",
                credentials: "same-origin",
                headers: { "Accept": "application/json" }
            });

            if (!respuesta.ok) {
                throw new Error(`No se pudo cerrar sesión. HTTP ${respuesta.status}`);
            }

            actualizarMenuSesion(false);
            window.location.replace(PAGINA_LOGIN);
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

        window.addEventListener("hashchange", marcarPaginaActiva);

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