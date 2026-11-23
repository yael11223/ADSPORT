"use strict";
document.addEventListener("DOMContentLoaded", async () => {
    const A = Admin, $ = id => document.getElementById(id);
    if (!await A.ready) return;
    let consulta = 0, eliminandoClase = false;
    function renderizar(sesiones) {
        const semana = $("semanaAgenda"); semana.replaceChildren();
        for (let dia = 1; dia <= 7; dia++) {
            const bloque = A.nodo("section", "admin-day"); bloque.append(A.nodo("h2", "", A.dias[dia]));
            const delDia = sesiones.filter(s => s.diaSemana === dia);
            delDia.forEach(s => {
                const card = A.nodo("article", "admin-session" + (s.disponible ? "" : " admin-session--inactive"));
                card.append(A.nodo("time", "", s.horaInicio + " – " + s.horaFin), A.nodo("h3", "", s.nombreClase),
                    A.nodo("p", "", s.entrenadorNombre), A.nodo("p", "", s.nombreDeporte),
                    A.nodo("p", "", s.nombreCancha || "Sin cancha asignada"));
                if (s.ubicacion && s.ubicacion !== s.nombreCancha) card.append(A.nodo("p", "", s.ubicacion));
                if (!s.disponible) card.append(A.nodo("span", "admin-badge admin-badge--inactive", "No publicada"));
                card.append(A.boton("Eliminar clase", () => quitarClase(s), "admin-button admin-button--danger"));
                bloque.append(card);
            });
            if (!delDia.length) bloque.append(A.nodo("p", "admin-help", "Sin clases"));
            semana.append(bloque);
        }
        $("resumenAgenda").textContent = new Set(sesiones.map(s => s.idClase)).size + " clases · " + sesiones.length + " sesiones semanales";
    }
    async function cargar() {
        const actual = ++consulta, params = new URLSearchParams();
        [["profesorAgenda","idEntrenador"],["canchaAgenda","idCancha"],["deporteAgenda","idDeporte"]].forEach(([id,nombre]) => {
            if ($(id).value) params.set(nombre,$(id).value);
        });
        if ($("incluirNoPublicadas").checked) params.set("incluirNoDisponibles","true");
        history.replaceState(null,"",location.pathname + (params.size ? "?" + params : ""));
        A.aviso("avisoAgenda", "Cargando cronograma…");
        try {
            const sesiones = await A.api("/api/Administracion/cronograma?" + params);
            if (actual !== consulta) return;
            renderizar(sesiones); A.aviso("avisoAgenda", sesiones.length ? "" : "No hay clases para los filtros seleccionados.");
        } catch (error) { if (actual === consulta) { $("semanaAgenda").replaceChildren(); $("resumenAgenda").textContent = ""; A.aviso("avisoAgenda", error.message, true); } }
    }

    async function quitarClase(clase) {
        if (eliminandoClase) return;
        eliminandoClase = true;
        document.querySelectorAll("#semanaAgenda button,#listaClasesAgenda button").forEach(b => b.disabled = true);
        try {
            const resultado = await A.eliminarClase(clase.idClase,clase.nombreClase);
            if (!resultado) return;
            await cargar();
            if ($("dialogClasesAgenda").open) await cargarListaClases();
            A.aviso("avisoAgenda",resultado.respuesta);
            A.aviso("avisoListaClases",resultado.respuesta);
        } catch (error) {
            A.aviso("avisoAgenda",error.message,true);
            A.aviso("avisoListaClases",error.message,true);
        } finally {
            eliminandoClase = false;
            document.querySelectorAll("#semanaAgenda button,#listaClasesAgenda button").forEach(b => b.disabled = false);
        }
    }
    async function cargarListaClases() {
        const lista = $("listaClasesAgenda");
        lista.replaceChildren(A.nodo("p","admin-help","Cargando clases…"));
        try {
            const clases = await A.api("/api/Administracion/clases");
            lista.replaceChildren();
            clases.forEach(c => {
                const card = A.nodo("article","admin-class-card");
                card.append(A.nodo("h3","",c.nombreClase),A.nodo("p","admin-help",c.entrenadorNombre + " · " + c.nombreDeporte),
                    A.nodo("p","admin-help",(c.nombreCancha || "Sin cancha asignada") + " · " + (c.disponible ? "Publicada" : "No publicada")));
                const horarios = A.nodo("ul");
                c.horarios.forEach(h => horarios.append(A.nodo("li","",A.horario(h))));
                if (!c.horarios.length) horarios.append(A.nodo("li","","Sin horarios asignados"));
                card.append(horarios,A.boton("Eliminar clase",()=>quitarClase(c),"admin-button admin-button--danger"));
                lista.append(card);
            });
            if (!clases.length) lista.append(A.nodo("p","admin-empty","No hay clases registradas."));
        } catch (error) { lista.replaceChildren(A.nodo("p","admin-notice admin-notice--error",error.message)); }
    }
    $("abrirClasesAgenda").addEventListener("click",() => {
        A.aviso("avisoListaClases"); $("dialogClasesAgenda").showModal(); cargarListaClases();
    });
    $("cerrarClasesAgenda").addEventListener("click",() => $("dialogClasesAgenda").close());
    ["profesorAgenda","canchaAgenda","deporteAgenda","incluirNoPublicadas"].forEach(id => $(id).addEventListener("change", cargar));
    $("actualizarAgenda").addEventListener("click", cargar);
    $("limpiarAgenda").addEventListener("click", () => {
        ["profesorAgenda","canchaAgenda","deporteAgenda"].forEach(id => $(id).value=""); $("incluirNoPublicadas").checked=false; cargar();
    });
    try {
        const [profesores,canchas,deportes] = await Promise.all([A.api("/api/Usuario?rol=ENTRENADOR"),
            A.api("/api/Cancha?incluirInactivas=true"), A.api("/api/Deporte?incluirInactivos=true")]);
        profesores.forEach(p => $("profesorAgenda").add(new Option(A.nombre(p),p.idUsuario)));
        canchas.forEach(c => $("canchaAgenda").add(new Option(c.nombre,c.idCancha)));
        deportes.forEach(d => $("deporteAgenda").add(new Option(d.nombreDeporte,d.idDeporte)));
        const params = new URLSearchParams(location.search);
        [["profesorAgenda","idEntrenador"],["canchaAgenda","idCancha"],["deporteAgenda","idDeporte"]].forEach(([id,nombre]) => {
            if (params.has(nombre)) $(id).value=params.get(nombre);
        });
        $("incluirNoPublicadas").checked=params.get("incluirNoDisponibles")==="true";
        await cargar();
    } catch(error) { A.aviso("avisoAgenda",error.message,true); }
});
