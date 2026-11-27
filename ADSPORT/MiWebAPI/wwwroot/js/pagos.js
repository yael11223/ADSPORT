document.addEventListener("DOMContentLoaded", async () => {
    "use strict";
    const $ = id => document.getElementById(id);
    const moneda = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
    const fecha = valor => new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(valor + "T12:00:00Z"));
    const periodo = pago => `${fecha(pago.inicioSemana)} – ${fecha(pago.finSemana)}`;
    const params = new URLSearchParams(location.search);
    const idClase = params.get("idClase");
    const cobroRetorno = params.get("cobro");
    let autenticado = false, configurado = false, semanas = [], pagos = [], ocupado = false;
    let modoLocal = false, cobroLocal = null;
    let versionPoliticas = "", confirmacionVisible = null, temporizadorConfirmacion;
    let motivoPago = "El club todavía no ha habilitado los pagos con Mercado Pago. Intenta más tarde o consulta al club.";
    const estados = { CREANDO: "Inicio pendiente · puedes reintentar", PENDIENTE: "Pendiente de pago o confirmación", APROBADO: "Pago aprobado",
        CANCELADO: "Cancelado o vencido", VENCIDO: "Inicio vencido", RECHAZADO: "Pago rechazado", REEMBOLSADO: "Reembolsado",
        REEMBOLSO_PARCIAL: "Reembolso parcial · consulta al club", REVISION: "Pago recibido · inscripción por revisar", EN_REVISION: "En revisión" };

    function nodo(tag, clase, texto) { const el = document.createElement(tag); if (clase) el.className = clase; if (texto !== undefined) el.textContent = texto; return el; }
    function usoAcceso(pago) {
        const total = pago.sesionesAcceso?.length || 0, utilizadas = pago.sesionesUtilizadas || 0;
        return pago.estadoUsoAcceso === "UTILIZADO" ? "Acceso utilizado · Asistencia completada en todas las sesiones de tu semana." :
            utilizadas ? `Asistencia registrada en ${utilizadas} de ${total} sesiones.` + (pago.estado === "APROBADO" && pago.inscripcionVigente ? " Tu acceso sigue disponible para las sesiones pendientes." : "") : "Acceso disponible · Pendiente de registrar tu asistencia.";
    }
    function mostrarSesionesAcceso(pago, destino) {
        destino.replaceChildren();
        for (const s of pago.sesionesAcceso || []) {
            const fila = nodo("li", s.presente ? "pago-sesion-utilizada" : "", `${fecha(s.fecha)} · ${s.horaInicio}–${s.horaFin}`);
            fila.append(nodo("strong", "", s.presente ? "PRESENTE · ACCESO UTILIZADO" : "Sin asistencia registrada"));
            if (s.presente && s.registradoUtc) fila.append(nodo("small", "", "Registro: " + new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", timeZone: "America/Mexico_City" }).format(new Date(s.registradoUtc))));
            destino.append(fila);
        }
    }
    function aviso(texto, error = false) { $("avisoPagos").textContent = texto; $("avisoPagos").hidden = !texto; $("avisoPagos").classList.toggle("pagos-aviso--error", error); }
    async function api(ruta, metodo = "GET", datos) {
        const headers = { Accept: "application/json" };
        if (metodo === "POST") {
            const tokenRespuesta = await fetch("/api/Auth/csrf", { credentials: "same-origin", cache: "no-store" });
            if (!tokenRespuesta.ok) throw new Error("No se pudo preparar la solicitud. Actualiza la página.");
            headers["X-CSRF-TOKEN"] = (await tokenRespuesta.json()).token;
            headers["Content-Type"] = "application/json";
        }
        const r = await fetch(ruta, { method: metodo, headers, credentials: "same-origin", cache: "no-store", body: datos === undefined ? undefined : JSON.stringify(datos) });
        const resultado = (r.headers.get("content-type") || "").includes("application/json") ? await r.json() : {};
        if (r.status === 401) { autenticado = false; sesionVisible(); renderizarHistorial(); throw new Error("Tu sesión terminó. Inicia sesión de nuevo para continuar."); }
        if (!r.ok) throw new Error(resultado.respuesta || (resultado.errors ? Object.values(resultado.errors).flat().join(" ") : null) || (r.status === 429 ? "Espera un minuto antes de actualizar nuevamente." : "No se pudo completar la solicitud. Intenta nuevamente."));
        return resultado;
    }
    function sesionVisible() {
        $("avisoSesionPago").hidden = autenticado;
        $("enlaceLoginPago").href = "/LoginUsuario.html?returnUrl=" + encodeURIComponent(location.pathname + location.search);
        $("btnActualizarPagos").disabled = !autenticado || ocupado;
        actualizarSemana();
    }
    function bloqueo(valor) {
        ocupado = valor;
        $("formPago").setAttribute("aria-busy", String(valor));
        $("semanaPago").disabled = valor || !semanas.length;
        $("aceptarPoliticas").disabled = valor;
        $("btnActualizarPagos").disabled = valor || !autenticado;
        document.querySelectorAll(".pago-item button").forEach(b => { b.disabled = valor; });
        actualizarSemana();
    }
    function actualizarSemana() {
        const semana = semanas.find(s => s.inicioSemana === $("semanaPago").value);
        $("aceptarPoliticas").required = configurado;
        $("btnPagarClase").disabled = ocupado || !autenticado || !semana?.puedePagar || !versionPoliticas || configurado && !$("aceptarPoliticas").checked;
        $("btnPagarClase").textContent = ocupado ? "VERIFICANDO…" : !configurado ? "CONSULTAR DISPONIBILIDAD DEL PAGO" : "CONTINUAR A MERCADO PAGO ↗";
        if (!semana) return;
        $("subtotalPago").textContent = moneda.format(semana.subtotal) + " MXN";
        $("ivaPago").textContent = moneda.format(semana.iva) + " MXN";
        $("totalPago").textContent = moneda.format(semana.total) + " MXN";
        $("cuposPago").textContent = `${semana.cuposDisponibles} de ${semana.cupoMaximo} cupos disponibles en esta semana.`;
        $("sesionesPago").replaceChildren();
        const dias = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
        for (const h of semana.horarios) {
            const dia = new Date(semana.inicioSemana + "T12:00:00Z"); dia.setUTCDate(dia.getUTCDate() + h.diaSemana - 1);
            const li = nodo("li", "", `${dias[h.diaSemana]} ${fecha(dia.toISOString().slice(0, 10))} · ${h.horaInicio} – ${h.horaFin}`);
            li.append(nodo("small", "", h.nombreCancha || "Cancha por confirmar")); $("sesionesPago").append(li);
        }
        $("ayudaPago").textContent = !autenticado ? "Inicia sesión desde el acceso de usuarios para pagar." :
            semana.precio <= 0 ? "Esta clase no requiere un pago. Consulta al club para inscribirte." :
            semana.cuposDisponibles === 0 ? "Esta semana ya no tiene cupos. Selecciona otra semana." :
            !semana.puedePagar ? "Las sesiones de esta semana ya comenzaron. Selecciona otra semana." : !configurado ? motivoPago :
            !$("aceptarPoliticas").checked ? "Lee y acepta las políticas para habilitar el pago de esta clase y semana." :
            modoLocal ? "El pago se abrirá en otra pestaña. Vuelve aquí para consultar la confirmación y tu QR." :
            "Elige tu forma de pago en Mercado Pago. La inscripción queda pendiente hasta confirmar el pago.";
    }
    async function cargarEstado() {
        const estado = await api("/api/Pagos/estado");
        configurado = estado.habilitado === true; modoLocal = estado.retornoLocal === true;
        if (estado.mensaje) motivoPago = estado.mensaje;
        actualizarSemana();
    }
    async function cargarClase() {
        if (!idClase) return;
        if (!/^[1-9]\d*$/.test(idClase) || !Number.isSafeInteger(Number(idClase))) throw new Error("La clase seleccionada no es válida.");
        const resultado = await api(`/api/Pagos/clases/${encodeURIComponent(idClase)}/semanas`);
        semanas = resultado.semanas; configurado = resultado.habilitado;
        modoLocal = resultado.retornoLocal === true;
        if (resultado.mensaje) motivoPago = resultado.mensaje;
        if (!semanas.length) throw new Error("La clase no tiene semanas disponibles.");
        $("seleccionPago").hidden = false;
        $("tituloClasePago").textContent = semanas[0].nombreClase;
        $("profesorPago").textContent = "Profesor: " + semanas[0].entrenadorNombre;
        $("semanaPago").replaceChildren(...semanas.map(s => new Option(periodo(s) + (s.puedePagar ? "" : " · No disponible"), s.inicioSemana)));
        $("semanaPago").value = semanas.find(s => s.puedePagar)?.inicioSemana || semanas[0].inicioSemana;
        $("semanaPago").disabled = false; actualizarSemana();
    }
    async function cargarPoliticas() {
        const politicas = await api("/api/Pagos/politicas");
        const contenido = $("politicasPago"); contenido.replaceChildren();
        for (const apartado of politicas.apartados) contenido.append(nodo("h4", "", apartado.titulo), nodo("p", "", apartado.texto));
        contenido.append(nodo("small", "pagos-muted", "Versión " + politicas.version));
        versionPoliticas = politicas.version; actualizarSemana();
    }
    function mostrarConfirmacion(pago) {
        if (pago.estado !== "APROBADO" || !pago.codigoAcceso || !pago.inscripcionVigente) {
            if (confirmacionVisible === pago.idCobro) { $("confirmacionPago").hidden = true; confirmacionVisible = null; $("qrAccesoPago").removeAttribute("src"); }
            return;
        }
        confirmacionVisible = pago.idCobro;
        $("confirmacionPago").hidden = false;
        const utilizado = pago.estadoUsoAcceso === "UTILIZADO";
        $("tituloConfirmacionPago").textContent = utilizado ? "ASISTENCIA COMPLETADA" : "¡PAGO CONFIRMADO!";
        $("detalleConfirmacionPago").textContent = `Ya estás inscrito en ${pago.nombreClase}. Semana ${periodo(pago)}. Total: ${moneda.format(pago.importe)} MXN.`;
        $("pedidoConfirmacionPago").textContent = "Pedido: " + pago.codigoPedido;
        $("vigenciaAccesoPago").textContent = `Válido para esta clase del ${periodo(pago)}. Caduca al terminar el domingo, en horario de Ciudad de México.`;
        $("estadoUsoAccesoPago").textContent = usoAcceso(pago);
        mostrarSesionesAcceso(pago, $("sesionesAccesoPago"));
        $("detalleQrPago").hidden = utilizado;
        $("codigoAccesoPago").textContent = utilizado ? "" : "Código de acceso: " + pago.codigoAcceso;
        const ruta = `/api/Pagos/${encodeURIComponent(pago.idCobro)}/acceso/qr`;
        if (utilizado) { $("qrAccesoPago").removeAttribute("src"); $("descargarQrPago").removeAttribute("href"); }
        else { $("qrAccesoPago").src = ruta; $("descargarQrPago").href = ruta; }
        $("correoConfirmacionPago").textContent = pago.correoConfirmacion === "ENVIADO" ? "Enviamos a tu correo la confirmación, el pedido y tu QR de acceso." :
            pago.correoConfirmacion === "PENDIENTE" ? "La confirmación y tu QR están en la cola de envío al correo de tu compra. Tu acceso ya está disponible aquí." : "Tu acceso ya está disponible para descargar.";
    }
    function renderizarHistorial() {
        const lista = $("historialPagos"); lista.replaceChildren();
        if (!autenticado) { lista.append(nodo("p", "pagos-muted", "Tu historial aparecerá al iniciar sesión.")); return; }
        if (!pagos.length) { lista.append(nodo("p", "pagos-muted", "Aún no tienes pagos registrados. Elige una clase para pagar su semana.")); return; }
        for (const pago of pagos) {
            const seleccionado = pago.idCobro.replaceAll("-", "") === cobroRetorno?.replaceAll("-", "");
            const card = nodo("article", "pago-item" + (seleccionado ? " pago-item--seleccionado" : ""));
            card.dataset.cobro = pago.idCobro;
            const top = nodo("div", "pago-item__top");
            top.append(nodo("h3", "", pago.nombreClase), nodo("strong", "", moneda.format(pago.importe) + " MXN"));
            const tipo = pago.estado === "APROBADO" ? "aprobado" : ["RECHAZADO", "CANCELADO", "REVISION", "EN_REVISION"].includes(pago.estado) ? "error" : "pendiente";
            card.append(top, nodo("p", "pagos-muted", periodo(pago)), nodo("p", "pago-estado pago-estado--" + tipo, estados[pago.estado] || "Estado por verificar"));
            card.append(nodo("p", "pagos-muted", `Subtotal: ${moneda.format(pago.subtotal)} · IVA: ${moneda.format(pago.iva)} MXN`));
            card.append(nodo("small", "pago-codigo", "Pedido: " + pago.codigoPedido));
            if (pago.estado === "APROBADO" || pago.sesionesUtilizadas > 0) {
                if (pago.inscripcionVigente || pago.sesionesUtilizadas > 0) card.append(nodo("p", "pago-uso-acceso", usoAcceso(pago)));
                const sesiones = nodo("ul", "pago-sesiones-acceso"); mostrarSesionesAcceso(pago, sesiones); card.append(sesiones);
            }
            if (pago.estadoAcceso === "VENCIDO") card.append(nodo("p", "pagos-muted", "Acceso vencido: terminó la semana pagada."));
            if (pago.estado === "REVISION") card.append(nodo("p", "pagos-muted", "El pago se recibió, pero la clase cambió o perdió disponibilidad. Consulta al club antes de asistir."));
            if (pago.estado === "APROBADO" && !pago.claseDisponible) card.append(nodo("p", "pagos-muted", "La clase o sus horarios cambiaron después de la compra. Consulta al club antes de asistir."));
            const acciones = nodo("div", "pago-item__acciones");
            if (pago.codigoAcceso && pago.inscripcionVigente) {
                const acceso = nodo("button", "pagos-btn", pago.estadoUsoAcceso === "UTILIZADO" ? "VER ASISTENCIAS" : "VER ACCESO Y QR"); acceso.type = "button";
                acceso.addEventListener("click", () => { mostrarConfirmacion(pago); $("confirmacionPago").scrollIntoView({ block: "start" }); });
                acciones.append(acceso);
            }
            const refrescar = nodo("button", "pagos-btn pagos-btn--secundario", pago.estado === "CREANDO" ? "REINTENTAR INICIO" : "VERIFICAR ESTADO");
            refrescar.type = "button"; refrescar.disabled = ocupado;
            refrescar.addEventListener("click", () => operar(pago.idCobro, false)); acciones.append(refrescar);
            if (pago.puedeContinuar) {
                const continuar = nodo("button", "pagos-btn", "CONTINUAR PAGO ↗"); continuar.type = "button"; continuar.disabled = ocupado;
                continuar.addEventListener("click", () => operar(pago.idCobro, true)); acciones.append(continuar);
            }
            card.append(acciones); lista.append(card);
        }
    }
    async function cargarHistorial() {
        if (autenticado) pagos = await api("/api/Pagos"); renderizarHistorial();
        const seleccionado = pagos.find(p => p.idCobro === confirmacionVisible || p.idCobro.replaceAll("-", "") === cobroRetorno?.replaceAll("-", ""));
        if (seleccionado) mostrarConfirmacion(seleccionado);
    }
    function abrirCheckout(pago) {
        if (!pago.puedeContinuar || !pago.urlCheckout) return false;
        const url = new URL(pago.urlCheckout);
        if (url.protocol !== "https:" || !["www.mercadopago.com.mx", "mercadopago.com.mx"].includes(url.hostname) || url.username || url.password || url.port || !url.pathname.startsWith("/checkout/"))
            throw new Error("El enlace de Mercado Pago no es válido.");
        if (modoLocal || pago.retornoLocal) {
            cobroLocal = pago.idCobro;
            const enlace = $("continuarPagoLocal");
            enlace.href = url.href; enlace.hidden = false;
            aviso("Completa el pago en la pestaña de Mercado Pago y vuelve aquí para ver su estado. También puedes usar el enlace Continuar pago.");
            window.open(url.href, "_blank", "noopener,noreferrer");
            clearTimeout(temporizadorConfirmacion);
            temporizadorConfirmacion = setTimeout(() => confirmarRetorno(pago.idCobro), 5000);
            return true;
        }
        location.assign(url.href); return true;
    }
    async function operar(cobro, continuar) {
        if (ocupado) return; bloqueo(true); aviso("Verificando el estado con Mercado Pago…");
        try {
            const pago = await api(`/api/Pagos/${encodeURIComponent(cobro)}/actualizar`, "POST");
            await cargarHistorial();
            aviso(pago.estado === "APROBADO" ? "Pago aprobado. Tu inscripción quedó registrada." : estados[pago.estado] || "Estado actualizado.");
            if (continuar) abrirCheckout(pago);
            mostrarConfirmacion(pago);
            if (!["CREANDO", "PENDIENTE"].includes(pago.estado) && cobroLocal === pago.idCobro) {
                cobroLocal = null; $("continuarPagoLocal").hidden = true;
            }
            return pago;
        } catch (e) { aviso(e.message, true); }
        finally { bloqueo(false); }
    }
    async function confirmarRetorno(cobro, intentos = 0) {
        if (!autenticado) return;
        if (ocupado) {
            temporizadorConfirmacion = setTimeout(() => confirmarRetorno(cobro, intentos), 5000);
            return;
        }
        const pago = await operar(cobro, false);
        if (pago && ["CREANDO", "PENDIENTE"].includes(pago.estado) && intentos < 23)
            temporizadorConfirmacion = setTimeout(() => confirmarRetorno(cobro, intentos + 1), 5000);
    }
    $("semanaPago").addEventListener("change", () => { $("aceptarPoliticas").checked = false; actualizarSemana(); });
    $("aceptarPoliticas").addEventListener("change", actualizarSemana);
    $("formPago").addEventListener("submit", async e => {
        e.preventDefault(); if (ocupado || $("btnPagarClase").disabled) return;
        const semana = semanas.find(s => s.inicioSemana === $("semanaPago").value);
        bloqueo(true); aviso("Preparando tu pago semanal…");
        try {
            if (!configurado) {
                const estado = await api("/api/Pagos/estado");
                configurado = estado.habilitado === true;
                motivoPago = estado.mensaje || motivoPago;
                if (!configurado) { aviso(motivoPago, true); return; }
            }
            if (!$("aceptarPoliticas").checked) throw new Error("Lee y acepta las políticas antes de continuar con el pago.");
            const pago = await api("/api/Pagos", "POST", { idClase: Number(idClase), inicioSemana: semana.inicioSemana, precioEsperado: semana.precio,
                totalEsperado: semana.total, aceptaPoliticas: true, versionPoliticas });
            await cargarHistorial();
            if (!abrirCheckout(pago)) aviso(estados[pago.estado] || "Consulta el estado en tu historial.");
        } catch (e) { aviso(e.message, true); try { await cargarHistorial(); } catch { /* Conserva el error de inicio. */ } }
        finally { bloqueo(false); }
    });
    $("btnActualizarPagos").addEventListener("click", async () => {
        if (ocupado) return; bloqueo(true);
        try { await cargarHistorial(); aviso("Historial actualizado. Usa «Verificar estado» para consultar un pago con Mercado Pago."); }
        catch (e) { aviso(e.message, true); } finally { bloqueo(false); }
    });
    try { const sesion = await api("/api/LoginUsuario/sesion"); autenticado = sesion.autenticado === true && sesion.esUsuario !== false; }
    catch (e) { aviso(e.message, true); }
    sesionVisible();
    await Promise.allSettled([cargarEstado().catch(e => aviso(e.message, true)), cargarClase().catch(e => aviso(e.message, true)), cargarPoliticas().catch(e => aviso("No se pudieron cargar las políticas. Actualiza la página antes de pagar.", true)), cargarHistorial().catch(e => { $("historialPagos").textContent = "No se pudo cargar el historial. Pulsa Actualizar para reintentar."; aviso(e.message, true); })]);
    if (autenticado && cobroRetorno && /^(?:[a-f0-9]{32}|[a-f0-9-]{36})$/i.test(cobroRetorno)) {
        // Los parámetros de retorno nunca aprueban un pago. El servidor consulta la orden canónica.
        await confirmarRetorno(cobroRetorno);
    }
    function comprobarAlVolver() {
        if (!document.hidden && cobroLocal && autenticado && !ocupado) {
            clearTimeout(temporizadorConfirmacion);
            void confirmarRetorno(cobroLocal);
        } else actualizarAsistencias();
    }
    let consultandoAsistencias = false;
    async function actualizarAsistencias() {
        if (document.hidden || !autenticado || ocupado || consultandoAsistencias || !pagos.some(p => p.estado === "APROBADO" && p.inscripcionVigente)) return;
        consultandoAsistencias = true;
        try { await cargarHistorial(); } catch { /* Se puede reintentar con Actualizar sin interrumpir la compra. */ }
        finally { consultandoAsistencias = false; }
    }
    const relojAsistencia = setInterval(actualizarAsistencias, 15000);
    window.addEventListener("pagehide", () => clearInterval(relojAsistencia), { once: true });
    window.addEventListener("focus", comprobarAlVolver);
    document.addEventListener("visibilitychange", comprobarAlVolver);
    window.addEventListener("pagehide", () => clearTimeout(temporizadorConfirmacion), { once: true });
});
