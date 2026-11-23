/* Catálogo de disciplinas del inicio: conserva el diseño y las animaciones de Home.js. */
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const contenedor = document.getElementById("clasesContainer");
    const estado = document.getElementById("estadoDeportesHome");
    const recargar = document.getElementById("recargarDeportesHome");
    let pendiente;
    const fotos = { TENIS: "/img/nosotros/tenis.png", BOXEO: "/img/nosotros/boxeo.png", BALONCESTO: "/img/nosotros/baloncesto.png" };

    function elemento(tag, clase, texto) {
        const nodo = document.createElement(tag);
        if (clase) nodo.className = clase;
        if (texto !== undefined) nodo.textContent = String(texto);
        return nodo;
    }

    function tarjeta(deporte, indice, total) {
        const normalizado = deporte.nombreDeporte.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const respaldo = fotos[normalizado] || "/Accet/Inicio.jpg";
        const card = elemento("article", "clase-card stack-card");
        card.dataset.card = String(indice + 1);
        card.style.setProperty("--card-index", String(indice));
        const interior = elemento("div", "stack-card-inner");
        const imagen = elemento("div", "clase-image");
        const foto = elemento("img");
        foto.src = deporte.imagenUrl || respaldo;
        foto.alt = "Disciplina " + deporte.nombreDeporte;
        foto.loading = "lazy";
        foto.addEventListener("error", () => { foto.src = respaldo; }, { once: true });
        imagen.append(foto, elemento("span", "clase-badge", "DISCIPLINA ADSPORT"),
            elemento("span", "card-number", String(indice + 1).padStart(2, "0") + " / " + String(total).padStart(2, "0")));
        const contenido = elemento("div", "clase-content");
        contenido.append(elemento("span", "clase-category", "CATÁLOGO ADSPORT"),
            elemento("h3", "", deporte.nombreDeporte.toLocaleUpperCase("es")),
            elemento("p", "clase-description", deporte.descripcion || "Explora las clases y los horarios publicados para esta disciplina."));
        const link = elemento("a", "clase-button", "EXPLORAR DISCIPLINA");
        const query = new URLSearchParams({ idDeporte: String(deporte.idDeporte), deporte: deporte.nombreDeporte });
        link.href = "/tenis.html?" + query.toString();
        link.append(elemento("span", "", "→"));
        contenido.append(link);
        interior.append(imagen, contenido);
        card.append(interior);
        return card;
    }

    async function cargar() {
        pendiente?.abort();
        pendiente = new AbortController();
        const signal = pendiente.signal;
        recargar.disabled = true;
        contenedor.setAttribute("aria-busy", "true");
        estado.textContent = "Consultando disciplinas de ADSPORT…";
        contenedor.replaceChildren();
        contenedor.classList.add("deportes-home-catalogo--vacio");
        window.dispatchEvent(new CustomEvent("adsport:deportes-cargados"));
        try {
            const respuesta = await fetch("/api/Deporte", { cache: "no-store", signal });
            if (!respuesta.ok) throw new Error("No fue posible consultar el catálogo. Intenta nuevamente.");
            const deportes = await respuesta.json();
            if (!Array.isArray(deportes)) throw new Error("El catálogo no está disponible en este momento.");
            const activos = deportes.filter((deporte) => deporte.activo !== false);
            activos.forEach((deporte, indice) => contenedor.append(tarjeta(deporte, indice, activos.length)));
            contenedor.classList.toggle("deportes-home-catalogo--vacio", !activos.length);
            estado.textContent = activos.length ? activos.length + " disciplinas. Consulta las clases y los horarios publicados de cada deporte." : "Todavía no hay disciplinas activas en el catálogo.";
            window.dispatchEvent(new CustomEvent("adsport:deportes-cargados"));
        } catch (error) {
            if (error.name !== "AbortError") estado.textContent = error.message || "No fue posible conectar con ADSPORT. Intenta nuevamente.";
        } finally {
            if (!signal.aborted) { recargar.disabled = false; contenedor.setAttribute("aria-busy", "false"); }
        }
    }
    recargar.addEventListener("click", cargar);
    cargar();
});
