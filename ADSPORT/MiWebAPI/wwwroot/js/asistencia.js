document.addEventListener("DOMContentLoaded", () => {
    "use strict";
    const $ = id => document.getElementById(id);
    const clase = new URLSearchParams(location.search).get("idClase");
    let vista, ocupado = false, solicitud = 0, stream, temporizador, turnoCamara = 0, iniciandoCamara = false, camaraElegida = "";
    const canvas = document.createElement("canvas"), contexto = canvas.getContext("2d", { willReadFrequently: true });
    const fecha = valor => new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(valor + "T12:00:00Z"));
    const hoy = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Mexico_City" }).format(new Date());
    const lunes = new Date(hoy + "T12:00:00Z"); lunes.setUTCDate(lunes.getUTCDate() - (lunes.getUTCDay() + 6) % 7);
    $("semanaAsistencia").value = lunes.toISOString().slice(0, 10);
    function nodo(tag, claseCss, texto) { const e = document.createElement(tag); if (claseCss) e.className = claseCss; if (texto !== undefined) e.textContent = texto; return e; }
    function aviso(texto, error = false) { const e = $("avisoAsistencia"); e.textContent = texto; e.hidden = !texto; e.classList.toggle("pagos-aviso--error", error); e.classList.toggle("pagos-aviso--exito", !error); }
    async function api(ruta, metodo = "GET", datos) {
        const headers = { Accept: "application/json" };
        if (metodo !== "GET") { const r = await fetch("/api/Entrenador/csrf", { credentials: "same-origin", cache: "no-store" }); if (!r.ok) throw new Error("Actualiza tu sesión de entrenador."); headers["X-CSRF-TOKEN"] = (await r.json()).token; headers["Content-Type"] = "application/json"; }
        const r = await fetch(ruta, { method: metodo, headers, credentials: "same-origin", cache: "no-store", body: datos === undefined ? undefined : JSON.stringify(datos) });
        const d = (r.headers.get("content-type") || "").includes("application/json") ? await r.json() : {};
        if (r.status === 401) { location.assign("/loginEntrenador.html"); throw new Error("Inicia sesión como entrenador."); }
        if (!r.ok) throw new Error(d.respuesta || (d.errors ? Object.values(d.errors).flat().join(" ") : "No se pudo consultar la asistencia de esta clase."));
        return d;
    }
    const sesion = () => vista?.sesiones[Number($("sesionAsistencia").value)];
    function controles() {
        const abierta = !ocupado && sesion()?.puedeRegistrar === true;
        $("abrirCamara").disabled = !abierta || iniciandoCamara;
        $("camaraAsistencia").disabled = !abierta || iniciandoCamara;
        for (const id of ["semanaAsistencia", "semanaAnterior", "semanaSiguiente", "actualizarAsistencia"]) $(id).disabled = ocupado;
        $("sesionAsistencia").disabled = ocupado || !vista?.sesiones.length;
    }
    function renderizar() {
        controles();
        const s = sesion(), alumnos = s?.alumnos || [], presentes = alumnos.filter(a => a.presente).length;
        $("inscritosAsistencia").textContent = alumnos.filter(a => a.accesoActivo).length;
        $("presentesAsistencia").textContent = presentes;
        $("pendientesAsistencia").textContent = alumnos.filter(a => a.accesoActivo && !a.presente).length;
        $("ventanaAsistencia").textContent = s ? `${fecha(s.fecha)} · ${s.horaInicio}–${s.horaFin} · ${s.cancha || "Cancha por confirmar"}. ` +
            (s.puedeRegistrar ? "REGISTRO ABIERTO. Captura el QR para registrar la asistencia y utilizar el acceso de esta sesión." : "Registro cerrado. Abre 30 minutos antes de esta sesión y cierra al terminarla, en horario de Ciudad de México.") : "La clase no tiene sesiones disponibles. Consulta su publicación y horarios desde tu panel.";
        const lista = $("listaAlumnosAsistencia"); lista.replaceChildren();
        const filtro = $("buscarAlumnoAsistencia").value.trim().toLocaleLowerCase("es");
        for (const a of alumnos.filter(a => a.nombre.toLocaleLowerCase("es").includes(filtro))) {
            const card = nodo("article", "asistencia-alumno" + (a.presente ? " asistencia-presente" : "")); card.dataset.cobro = a.idCobro;
            card.dataset.estadoAcceso = a.estadoAcceso;
            const detalle = nodo("div"); detalle.append(nodo("h3", "", a.nombre), nodo("span", "asistencia-estado", a.presente ? "PRESENTE · ACCESO UTILIZADO" : a.accesoActivo ? "ASISTENCIA PENDIENTE" : "ACCESO REVOCADO"));
            if (a.registradoUtc) detalle.append(nodo("p", "", "Último registro: " + new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" }).format(new Date(a.registradoUtc)) + " · " + (a.metodo === "QR" ? "QR" : "Manual")));
            card.append(detalle);
            if (a.presente) {
                const boton = nodo("button", "pagos-btn pagos-btn--secundario", "CORREGIR ASISTENCIA"); boton.type = "button";
                boton.setAttribute("aria-label", "Retirar presencia de " + a.nombre);
                boton.disabled = ocupado || !s.puedeRegistrar || !a.accesoActivo;
                boton.addEventListener("click", () => {
                    if (confirm("¿Retirar la asistencia registrada de " + a.nombre + "? El acceso volverá a estar disponible para esta sesión."))
                        registrar("PUT", `/api/Entrenador/clases/${clase}/asistencias/${encodeURIComponent(a.idCobro)}`, { fecha: s.fecha, horaInicio: s.horaInicio, presente: false });
                });
                card.append(boton);
            }
            lista.append(card);
        }
        if (!lista.childElementCount) lista.append(nodo("p", "pagos-muted", alumnos.length ? "No hay alumnos con ese nombre." : "Aún no hay alumnos inscritos en esta clase y semana."));
    }
    async function cargar(conservarVista = false) {
        const numero = ++solicitud, anterior = sesion(); detenerCamara(); ocupado = true; controles();
        if (conservarVista !== true) { $("resultadoAccesoAsistencia").hidden = true; aviso(""); }
        try {
            const d = new Date($("semanaAsistencia").value + "T12:00:00Z");
            if (Number.isNaN(d.getTime()) || d.getUTCDay() !== 1) throw new Error("Selecciona el lunes de la semana que quieres consultar.");
            const datos = await api(`/api/Entrenador/clases/${clase}/asistencias?inicioSemana=${encodeURIComponent($("semanaAsistencia").value)}`);
            if (numero !== solicitud) return;
            vista = datos; $("nombreClaseAsistencia").textContent = vista.nombreClase;
            $("sesionAsistencia").replaceChildren(...vista.sesiones.map((s, i) => new Option(`${fecha(s.fecha)} · ${s.horaInicio}–${s.horaFin}`, String(i))));
            const misma = vista.sesiones.findIndex(s => s.fecha === anterior?.fecha && s.horaInicio === anterior?.horaInicio);
            $("sesionAsistencia").value = String(misma >= 0 ? misma : Math.max(0, vista.sesiones.findIndex(s => s.puedeRegistrar)));
            return true;
        } catch (e) { if (numero === solicitud) { if (conservarVista !== true) vista = null; aviso(e.message, true); } return false; }
        finally { if (numero === solicitud) { ocupado = false; renderizar(); } }
    }
    async function registrar(metodo, ruta, datos) {
        if (ocupado) return; detenerCamara(); ocupado = true; renderizar();
        try {
            const resultado = await api(ruta, metodo, datos);
            const alumno = sesion()?.alumnos.find(a => a.idCobro === resultado.idCobro);
            if (alumno) { alumno.presente = resultado.presente; alumno.estadoAcceso = resultado.estadoAcceso; alumno.registradoUtc = null; }
            const actualizada = await cargar(true);
            if (resultado.presente) {
                const panel = $("resultadoAccesoAsistencia"); panel.hidden = false;
                panel.classList.toggle("asistencia-resultado--repetido", resultado.yaEstabaPresente);
                $("tituloResultadoAcceso").textContent = resultado.yaEstabaPresente ? "ACCESO YA UTILIZADO" : "ASISTENCIA REGISTRADA";
                $("alumnoResultadoAcceso").textContent = resultado.alumno;
                $("detalleResultadoAcceso").textContent = resultado.mensaje;
                aviso(actualizada ? "" : "La asistencia se guardó, pero no fue posible actualizar la lista. Pulsa ACTUALIZAR para volver a consultarla.", !actualizada);
            } else { $("resultadoAccesoAsistencia").hidden = true; aviso(resultado.mensaje); }
        }
        catch (e) { aviso(e.message, true); }
        finally { ocupado = false; renderizar(); }
    }
    function validar(codigo) {
        const s = sesion(); if (ocupado) return;
        if (!s?.puedeRegistrar) { aviso("Selecciona una sesión con el registro abierto.", true); return; }
        return registrar("POST", `/api/Entrenador/clases/${clase}/acceso`, { codigoAcceso: codigo, fecha: s.fecha, horaInicio: s.horaInicio });
    }
    function detenerCamara() {
        ++turnoCamara; clearTimeout(temporizador);
        iniciandoCamara = false;
        if (stream) stream.getTracks().forEach(t => t.stop()); stream = null;
        $("videoAsistencia").srcObject = null; $("contenedorCamara").hidden = true; $("cerrarCamara").hidden = true; $("abrirCamara").hidden = false;
        $("estadoCamaraAsistencia").textContent = "Cámara detenida. Puedes iniciar una nueva captura.";
        controles();
    }
    function leerImagen(imagen, ancho, alto) {
        if (!contexto || typeof window.jsQR !== "function") throw new Error("No se pudo cargar el lector QR. Actualiza la página e intenta nuevamente.");
        const escala = Math.min(1, 1400 / Math.max(ancho, alto)); canvas.width = Math.round(ancho * escala); canvas.height = Math.round(alto * escala);
        contexto.drawImage(imagen, 0, 0, canvas.width, canvas.height);
        const pixels = contexto.getImageData(0, 0, canvas.width, canvas.height);
        return window.jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: "attemptBoth" })?.data;
    }
    async function listarCamaras(turno) {
        if (!navigator.mediaDevices.enumerateDevices) return;
        try {
            const dispositivos = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "videoinput");
            if (turno !== turnoCamara) return;
            const dispositivoActivo = stream?.getVideoTracks()[0]?.getSettings?.().deviceId;
            const actual = dispositivos.some(d => d.deviceId === dispositivoActivo) ? dispositivoActivo : camaraElegida;
            $("camaraAsistencia").replaceChildren(...dispositivos.map((d, i) => new Option(d.label || "Cámara " + (i + 1), d.deviceId)));
            if (dispositivos.some(d => d.deviceId === actual)) $("camaraAsistencia").value = actual;
            $("selectorCamaraAsistencia").hidden = dispositivos.length < 2;
        } catch { /* La captura sigue disponible si el navegador no permite enumerar cámaras. */ }
    }
    function mensajeCamara(error) {
        if (!window.isSecureContext) return "Para usar la cámara abre ADSPORT mediante HTTPS. En esta PC también puedes usar localhost; en el celular se necesita una conexión HTTPS confiable.";
        if (error.name === "NotAllowedError" || error.name === "SecurityError") return "Permite el acceso a la cámara en la configuración del navegador y vuelve a pulsar ABRIR CÁMARA.";
        if (error.name === "NotFoundError" || error.name === "OverconstrainedError") return "No se encontró una cámara disponible. Conecta o habilita la cámara y vuelve a intentarlo.";
        if (error.name === "NotReadableError" || error.name === "AbortError") return "La cámara está ocupada o no pudo iniciarse. Cierra las aplicaciones que la estén usando y vuelve a intentarlo.";
        return error.message || "No fue posible iniciar la cámara. Revisa sus permisos y vuelve a intentarlo.";
    }
    async function abrirCamara() {
        if (!sesion()?.puedeRegistrar || ocupado) return;
        detenerCamara(); const turno = turnoCamara;
        iniciandoCamara = true; controles(); aviso(""); $("resultadoAccesoAsistencia").hidden = true;
        $("abrirCamara").hidden = true; $("cerrarCamara").hidden = false;
        $("estadoCamaraAsistencia").textContent = "Esperando autorización de la cámara…";
        try {
            if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error("Este navegador no permite activar la cámara. Abre ADSPORT en un navegador actualizado mediante HTTPS o localhost.");
            let nueva;
            try {
                nueva = await navigator.mediaDevices.getUserMedia({ video: camaraElegida ? { deviceId: { exact: camaraElegida } } :
                    { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
            } catch (error) {
                if (!["NotFoundError", "OverconstrainedError"].includes(error.name) || turno !== turnoCamara) throw error;
                camaraElegida = "";
                nueva = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            }
            if (turno !== turnoCamara) { nueva.getTracks().forEach(t => t.stop()); return; }
            stream = nueva; const video = $("videoAsistencia"); video.srcObject = stream;
            video.muted = true; video.playsInline = true;
            $("contenedorCamara").hidden = false; await video.play();
            if (turno !== turnoCamara) return;
            iniciandoCamara = false; controles();
            $("estadoCamaraAsistencia").textContent = "Cámara activa. Acerca el QR completo, mantén la imagen estable y evita reflejos.";
            listarCamaras(turno);
            nueva.getVideoTracks().forEach(pista => pista.addEventListener("ended", () => {
                if (turno === turnoCamara) { detenerCamara(); aviso("La cámara se desconectó. Conéctala e inicia otra captura.", true); }
            }, { once: true }));
            const inicio = Date.now();
            function capturar() {
                if (!stream || turno !== turnoCamara) return;
                try {
                    if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
                        const codigo = leerImagen(video, video.videoWidth, video.videoHeight);
                        if (codigo) { detenerCamara(); validar(codigo); return; }
                    } else if (Date.now() - inicio > 10000) throw new Error("La cámara no está entregando imagen. Detén otras aplicaciones de cámara y vuelve a intentarlo.");
                    temporizador = setTimeout(capturar, 300);
                } catch (error) { detenerCamara(); aviso(mensajeCamara(error), true); }
            }
            capturar();
        } catch (error) { if (turno === turnoCamara) { detenerCamara(); aviso(mensajeCamara(error), true); } }
    }
    $("abrirCamara").addEventListener("click", abrirCamara);
    $("cerrarCamara").addEventListener("click", detenerCamara);
    $("camaraAsistencia").addEventListener("change", () => {
        camaraElegida = $("camaraAsistencia").value;
        if (stream || iniciandoCamara) abrirCamara();
    });
    $("sesionAsistencia").addEventListener("change", () => { detenerCamara(); $("resultadoAccesoAsistencia").hidden = true; aviso(""); renderizar(); });
    $("semanaAsistencia").addEventListener("change", cargar); $("actualizarAsistencia").addEventListener("click", cargar);
    for (const [id, dias] of [["semanaAnterior", -7], ["semanaSiguiente", 7]]) $(id).addEventListener("click", () => { const d = new Date($("semanaAsistencia").value + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + dias); $("semanaAsistencia").value = d.toISOString().slice(0, 10); cargar(); });
    $("buscarAlumnoAsistencia").addEventListener("input", renderizar);
    window.addEventListener("pagehide", detenerCamara); document.addEventListener("visibilitychange", () => { if (document.hidden) detenerCamara(); });
    if (!/^[1-9]\d*$/.test(clase || "") || !Number.isSafeInteger(Number(clase))) { aviso("Abre la asistencia desde una de tus clases.", true); controles(); return; }
    cargar();
});
