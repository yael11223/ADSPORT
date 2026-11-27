/* Inscripciones verificadas de una clase y una semana. */
document.addEventListener("DOMContentLoaded", async () => {
    const clases = document.getElementById("listaMisClases"), proximas = document.getElementById("listaProximasClases");
    if (!clases || !proximas) return;
    const fecha = valor => new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(valor + "T12:00:00Z"));
    function el(tag, texto) { const nodo = document.createElement(tag); nodo.textContent = texto; return nodo; }
    function tarjeta(titulo, detalle) {
        const card = document.createElement("article"); card.className = "perfil-pago-clase";
        card.append(el("h4", titulo), el("p", detalle));
        return card;
    }
    let consultando = false;
    async function cargar() {
    if (consultando) return;
    consultando = true;
    try {
        const r = await fetch("/api/Pagos", { credentials: "same-origin", cache: "no-store" });
        if (!r.ok) throw new Error();
        const pagos = (await r.json()).filter(p => p.estado === "APROBADO" && p.inscripcionVigente);
        clases.replaceChildren(); proximas.replaceChildren();
        for (const p of pagos) {
            const card = tarjeta(p.nombreClase, `${fecha(p.inicioSemana)} – ${fecha(p.finSemana)} · ${p.entrenadorNombre}`);
            const completo = p.estadoUsoAcceso === "UTILIZADO";
            const estado = el("p", completo ? "ACCESO UTILIZADO · ASISTENCIA COMPLETADA" : p.sesionesUtilizadas ? `Asistencia registrada: ${p.sesionesUtilizadas} de ${p.sesionesAcceso.length} sesiones.` : "Pendiente de registrar tu asistencia.");
            estado.className = "pago-uso-acceso"; card.append(estado);
            if (p.codigoAcceso) { const enlace = el("a", completo ? "VER MIS ASISTENCIAS →" : "VER MI ACCESO Y QR →"); enlace.href = "/pagos.html?cobro=" + encodeURIComponent(p.idCobro); card.append(enlace); }
            clases.append(card);
        }
        const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
        const v = tipo => partes.find(p => p.type === tipo).value;
        const ahora = `${v("year")}-${v("month")}-${v("day")}T${v("hour")}:${v("minute")}`;
        const sesiones = pagos.flatMap(p => p.horarios.map(h => {
            const dia = new Date(p.inicioSemana + "T12:00:00Z"); dia.setUTCDate(dia.getUTCDate() + h.diaSemana - 1);
            const fechaSesion = dia.toISOString().slice(0, 10);
            const presente = p.sesionesAcceso?.some(s => s.fecha === fechaSesion && s.horaInicio === h.horaInicio && s.presente);
            return { pago: p, horario: h, fecha: fechaSesion, presente };
        })).filter(s => !s.presente && `${s.fecha}T${s.horario.horaInicio}` > ahora)
            .sort((a, b) => `${a.fecha}T${a.horario.horaInicio}`.localeCompare(`${b.fecha}T${b.horario.horaInicio}`));
        for (const s of sesiones.slice(0, 8)) proximas.append(tarjeta(s.pago.nombreClase,
            `${fecha(s.fecha)} · ${s.horario.horaInicio} – ${s.horario.horaFin} · ${s.horario.nombreCancha || "Cancha por confirmar"}`));
        if (!pagos.length) clases.append(el("p", "Aún no tienes inscripciones semanales confirmadas. Consulta tus pagos o elige una clase."));
        if (!sesiones.length) proximas.append(el("p", "No tienes próximas sesiones confirmadas."));
    } catch {
        clases.replaceChildren(el("p", "No se pudieron consultar tus clases. Reintenta desde Mis clases y pagos."));
        proximas.replaceChildren(el("p", "Consulta Mis clases y pagos para actualizar tu agenda."));
    } finally { consultando = false; }
    }
    await cargar();
    const reloj = setInterval(() => { if (!document.hidden) cargar(); }, 15000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) cargar(); });
    window.addEventListener("focus", cargar);
    window.addEventListener("pagehide", () => clearInterval(reloj), { once: true });
});
