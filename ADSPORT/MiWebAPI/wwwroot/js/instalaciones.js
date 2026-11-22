"use strict";
document.addEventListener("DOMContentLoaded", () => {
    const $ = id => document.getElementById(id);
    const dias = ["","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
    let instalaciones = [], peticion;
    function nodo(tag, clase, texto) {
        const n = document.createElement(tag);
        if (clase) n.className = clase;
        if (texto !== undefined) n.textContent = String(texto);
        return n;
    }
    function estado(texto, error = false) {
        $("estadoInstalaciones").textContent = texto;
        $("estadoInstalaciones").hidden = !texto;
        $("estadoInstalaciones").classList.toggle("instalaciones-estado--error",error);
    }
    function ampliar(c) {
        $("tituloVisorInstalacion").textContent = c.nombre;
        $("fotoVisorInstalacion").alt = "Instalación de " + c.nombreDeporte + ": " + c.nombre;
        $("fotoVisorInstalacion").src = c.imagenUrl;
        $("visorInstalacion").showModal();
    }
    function tarjeta(c) {
        const card = nodo("article","instalacion-tarjeta");
        const placeholder = nodo("div","instalacion-foto instalacion-sin-foto","Imagen no disponible");
        if (c.imagenUrl) {
            const foto = nodo("img","instalacion-foto");
            foto.src = c.imagenUrl; foto.alt = "Instalación de " + c.nombreDeporte + ": " + c.nombre;
            foto.loading = "lazy"; card.append(foto);
            foto.addEventListener("error",() => { foto.replaceWith(placeholder); botonFoto.hidden = true; },{once:true});
        } else card.append(placeholder);
        const contenido = nodo("div","instalacion-datos");
        contenido.append(nodo("span","instalacion-deporte",c.nombreDeporte),nodo("h3","",c.nombre),
            nodo("p","instalacion-ubicacion",c.ubicacion || "Consulta la ubicación con ADSPORT."),
            nodo("h4","","Horarios de apertura"));
        const horarios = nodo("ul","instalacion-horarios");
        c.horarios.forEach(h => horarios.append(nodo("li","",dias[h.diaSemana] + " · " + h.horaInicio + " – " + h.horaFin)));
        if (!c.horarios.length) horarios.append(nodo("li","","Consulta los horarios con ADSPORT."));
        contenido.append(horarios);
        const acciones = nodo("div","instalacion-acciones");
        const clases = nodo("a","instalaciones-boton","Ver clases");
        clases.href = "/tenis.html?" + new URLSearchParams({idDeporte:c.idDeporte,deporte:c.nombreDeporte});
        const botonFoto = nodo("button","instalaciones-boton instalaciones-boton--secundario","Ampliar fotografía");
        botonFoto.type = "button"; botonFoto.hidden = !c.imagenUrl;
        botonFoto.addEventListener("click",() => ampliar(c));
        acciones.append(clases,botonFoto); contenido.append(acciones); card.append(contenido);
        return card;
    }
    function renderizar() {
        const id = $("deporteInstalaciones").value;
        const visibles = instalaciones.filter(c => !id || String(c.idDeporte) === id);
        $("galeriaInstalaciones").replaceChildren(...visibles.map(tarjeta));
        $("totalInstalaciones").textContent = visibles.length + (visibles.length === 1 ? " instalación" : " instalaciones");
        estado(visibles.length ? "" : "Todavía no hay instalaciones disponibles para este deporte.");
    }
    async function cargar() {
        peticion?.abort(); peticion = new AbortController();
        const signal = peticion.signal;
        $("actualizarInstalaciones").disabled = true;
        $("galeriaInstalaciones").setAttribute("aria-busy","true");
        estado("Cargando instalaciones…");
        try {
            const respuesta = await fetch("/api/Instalaciones",{cache:"no-store",signal});
            if (!respuesta.ok) throw new Error();
            const datos = await respuesta.json();
            if (!Array.isArray(datos)) throw new Error();
            instalaciones = datos;
            const actual = $("deporteInstalaciones").value || new URLSearchParams(location.search).get("idDeporte") || "";
            $("deporteInstalaciones").replaceChildren(new Option("Todos los deportes",""));
            const deportes = new Map(instalaciones.map(c => [c.idDeporte,c.nombreDeporte]));
            [...deportes].sort((a,b) => a[1].localeCompare(b[1],"es")).forEach(([id,nombre]) =>
                $("deporteInstalaciones").add(new Option(nombre,String(id))));
            $("deporteInstalaciones").value = [...$("deporteInstalaciones").options].some(o => o.value === actual) ? actual : "";
            renderizar();
        } catch (error) {
            if (error.name !== "AbortError") {
                $("galeriaInstalaciones").replaceChildren();
                $("totalInstalaciones").textContent = "";
                estado("No fue posible mostrar nuestras instalaciones. Intenta actualizar la página.",true);
            }
        } finally {
            if (!signal.aborted) {
                $("galeriaInstalaciones").setAttribute("aria-busy","false");
                $("actualizarInstalaciones").disabled = false;
            }
        }
    }
    $("deporteInstalaciones").addEventListener("change",renderizar);
    $("actualizarInstalaciones").addEventListener("click",cargar);
    $("cerrarVisorInstalacion").addEventListener("click",() => $("visorInstalacion").close());
    $("visorInstalacion").addEventListener("close",() => $("fotoVisorInstalacion").removeAttribute("src"));
    cargar();
});
