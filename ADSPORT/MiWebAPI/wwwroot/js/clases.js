/* Catálogo público: usa las clases publicadas, sin crear reservas ni pagos. */
document.addEventListener("DOMContentLoaded", async () => {
    const filtro = document.getElementById("filtroDeporte");
    const catalogo = document.getElementById("catalogoClases");
    const estado = document.getElementById("estadoCatalogo");
    const tabla = document.getElementById("horariosPublicos");
    const dias = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    const moneda = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
    let peticion;

    function elemento(tag, clase, texto) {
        const nodo = document.createElement(tag);
        if (clase) nodo.className = clase;
        if (texto !== undefined) nodo.textContent = texto;
        return nodo;
    }

    async function obtener(ruta, signal) {
        const respuesta = await fetch(ruta, { cache: "no-store", signal });
        if (!respuesta.ok) throw new Error("No fue posible consultar las clases. Intenta de nuevo más tarde.");
        return respuesta.json();
    }

    function portada() {
        const deporte = filtro.value;
        document.getElementById("titulo-tenis").textContent = deporte || "DEPORTES";
        document.title = `Clases de ${deporte || "deportes"} | ADSPORT`;
        const nombreNormalizado = deporte.toLocaleLowerCase("es");
        document.querySelector(".tenis-info").hidden = nombreNormalizado !== "tenis";
        document.querySelector(".tenis-hero__contenido p").textContent =
            `Encuentra tu próxima clase${deporte ? " de " + deporte : " deportiva"} y conoce sus horarios y entrenadores.`;
        const fotos = { tenis: "tenis.png", boxeo: "boxeo.png", baloncesto: "baloncesto.png" };
        const foto = document.querySelector(".tenis-hero__imagen");
        foto.src = fotos[nombreNormalizado] ? `/img/nosotros/${fotos[nombreNormalizado]}` : "/Accet/Inicio.jpg";
        foto.alt = deporte ? `ADSPORT: ${deporte}` : "Deportes ADSPORT";
    }

    function tarjeta(clase) {
        const card = elemento("article", "tenis-profesor-card");
        const foto = elemento("div", "tenis-profesor-card__foto");
        const imagen = elemento("img");
        imagen.src = clase.fotoUrl || "/Accet/perfil.png";
        imagen.alt = `Fotografía de ${clase.entrenadorNombre}`;
        imagen.loading = "lazy";
        imagen.addEventListener("error", () => { imagen.src = "/Accet/perfil.png"; }, { once: true });
        foto.append(imagen, elemento("span", "tenis-profesor-card__categoria", clase.nombreDeporte));
        const contenido = elemento("div", "tenis-profesor-card__contenido catalogo-contenido");
        contenido.append(elemento("h3", "", clase.nombreClase),
            elemento("p", "catalogo-entrenador", clase.entrenadorNombre),
            elemento("p", "catalogo-descripcion", clase.descripcion || "Descripción por confirmar."),
            elemento("strong", "catalogo-precio", clase.precio == null ? "Precio por confirmar" : `${moneda.format(clase.precio)} por clase`));
        const horarios = elemento("ul", "catalogo-horarios");
        for (const horario of clase.horarios) {
            horarios.append(elemento("li", "", `${dias[horario.diaSemana]} · ${horario.horaInicio} – ${horario.horaFin}`));
        }
        contenido.append(horarios);
        if (!clase.horarios.length) contenido.append(elemento("p", "", "Horarios por confirmar."));
        contenido.append(elemento("p", "", clase.ubicacion || "Ubicación por confirmar."),
            elemento("p", "catalogo-cupos", clase.cuposDisponibles == null
                ? "Cupo por confirmar" : `${clase.cuposDisponibles} de ${clase.cupoMaximo} cupos disponibles`));
        card.append(foto, contenido);
        return card;
    }

    async function cargar() {
        peticion?.abort();
        peticion = new AbortController();
        const signal = peticion.signal;
        estado.textContent = "Cargando clases disponibles…";
        catalogo.replaceChildren();
        tabla.replaceChildren();
        catalogo.setAttribute("aria-busy", "true");
        portada();
        try {
            const clases = await obtener(`/api/Clases?deporte=${encodeURIComponent(filtro.value)}`, signal);
            for (const clase of clases) {
                catalogo.append(tarjeta(clase));
                const fila = elemento("tr");
                const titulo = elemento("th", "", `${clase.nombreClase} / ${clase.entrenadorNombre}`);
                titulo.scope = "row";
                fila.append(titulo);
                for (let dia = 1; dia <= 7; dia++) {
                    const horarios = clase.horarios.filter(h => h.diaSemana === dia);
                    fila.append(elemento("td", "", horarios.map(h => `${h.horaInicio} – ${h.horaFin}`).join(" / ") || "—"));
                }
                tabla.append(fila);
            }
            estado.textContent = clases.length ? `${clases.length} clases disponibles.` : "Todavía no hay clases disponibles para este deporte.";
            if (!clases.length) {
                const fila = elemento("tr");
                const celda = elemento("td", "", "Sin horarios publicados.");
                celda.colSpan = 8;
                fila.append(celda);
                tabla.append(fila);
            }
        } catch (error) {
            if (error.name !== "AbortError") estado.textContent = error.message;
        } finally {
            if (!signal.aborted) catalogo.setAttribute("aria-busy", "false");
        }
    }

    filtro.addEventListener("change", () => {
        const url = new URL(window.location.href);
        url.searchParams.set("deporte", filtro.value || "todos");
        window.history.replaceState(null, "", url);
        cargar();
    });
    document.getElementById("recargarClases").addEventListener("click", cargar);
    try {
        const deportes = await obtener("/api/Clases/deportes");
        for (const deporte of deportes) filtro.add(new Option(deporte.nombreDeporte, deporte.nombreDeporte));
        const seleccionado = new URLSearchParams(window.location.search).get("deporte") || "Tenis";
        filtro.value = seleccionado.toLowerCase() === "todos" ? "" :
            [...filtro.options].find(opcion => opcion.value.localeCompare(seleccionado, "es", { sensitivity: "base" }) === 0)?.value || "";
        await cargar();
    } catch (error) {
        estado.textContent = error.message;
        catalogo.setAttribute("aria-busy", "false");
    }
});
