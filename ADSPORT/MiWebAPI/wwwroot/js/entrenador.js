"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const porId = (id) => document.getElementById(id);
    const dias = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    const moneda = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
    const modalClase = porId("modalNuevaClase");
    const modalPassword = porId("modalPasswordEntrenador");
    const formClase = porId("formNuevaClase");
    const formPassword = porId("formPasswordEntrenador");
    let clases = [];
    let canchas = [];
    let disponibilidad = null;
    let consultandoCancha = false;
    let consultaCancha = 0;
    let claseEditando = null;
    let numeroHorario = 0;
    let cargando = false;
    let guardandoClase = false;
    let guardandoPassword = false;

    function elemento(etiqueta, clase, texto) {
        const nodo = document.createElement(etiqueta);
        if (clase) nodo.className = clase;
        if (texto !== undefined && texto !== null) nodo.textContent = String(texto);
        return nodo;
    }

    function aviso(id, texto, error = false) {
        const nodo = porId(id);
        nodo.textContent = texto;
        nodo.hidden = !texto;
        nodo.classList.toggle("trainer-notice--error", error);
    }

    async function solicitar(ruta, opciones = {}) {
        let respuesta;
        try {
            respuesta = await fetch(ruta, { credentials: "same-origin", cache: "no-store", ...opciones });
        } catch {
            throw new Error("No fue posible conectar con ADSPORT. Revisa tu conexión e intenta nuevamente.");
        }
        const datos = await respuesta.json().catch(() => null);
        if (respuesta.status === 401) {
            porId("panelEntrenador").hidden = true;
            window.location.replace("/loginEntrenador.html");
            throw new Error("Tu sesión terminó. Inicia sesión nuevamente.");
        }
        if (!respuesta.ok) {
            if (respuesta.status === 403) {
                porId("panelEntrenador").hidden = true;
                porId("accesoEntrenador").hidden = false;
            }
            const errores = datos?.errors ? Object.values(datos.errors).flat().join(" ") : "";
            throw new Error(datos?.respuesta || errores || (respuesta.status === 403
                ? "Esta cuenta no tiene acceso activo de entrenador. Inicia sesión con tus credenciales de entrenador."
                : "No fue posible completar la solicitud. Intenta nuevamente."));
        }
        if (datos === null) throw new Error("ADSPORT no devolvió una respuesta válida.");
        return datos;
    }

    async function modificar(ruta, metodo, datos) {
        // Se solicita después de autenticar y antes de cada cambio: el token corresponde a la sesión vigente.
        const csrf = await solicitar("/api/Entrenador/csrf");
        if (!csrf.token) throw new Error("No fue posible validar tu sesión. Actualiza la página.");
        return solicitar(ruta, {
            method: metodo,
            headers: { "Content-Type": "application/json", "X-CSRF-TOKEN": csrf.token },
            body: JSON.stringify(datos)
        });
    }

    function mostrarPerfil(perfil) {
        porId("lblNombreEntrenador").textContent = perfil.nombreCompleto || "Entrenador ADSPORT";
        porId("correoPerfilEntrenador").textContent = perfil.correo || "No registrado";
        porId("telefonoPerfilEntrenador").textContent = perfil.telefono || "No registrado";
        const estado = porId("estadoEntrenador");
        estado.textContent = ["1", "TRUE"].includes(String(perfil.estatus).toUpperCase()) ? "Activo" : perfil.estatus || "Estado no disponible";
        estado.classList.add("active"); // El servidor solo autoriza cuentas activas en este panel.
        const foto = porId("fotoEntrenador");
        foto.onerror = () => {
            foto.onerror = null;
            foto.src = "/Accet/perfil.png";
        };
        foto.src = perfil.tieneFoto && perfil.fotoUrl ? perfil.fotoUrl : "/Accet/perfil.png";
    }

    async function cargarClases() {
        const resultado = await solicitar("/api/Entrenador/clases");
        if (!Array.isArray(resultado)) throw new Error("No fue posible leer tus clases.");
        clases = resultado;
        renderizarClases();
        renderizarAgenda();
        const disciplinas = porId("disciplinasEntrenador");
        disciplinas.replaceChildren();
        const nombres = [...new Set(clases.map((clase) => clase.nombreDeporte).filter(Boolean))];
        nombres.forEach((nombre) => disciplinas.append(elemento("span", "discipline-tag", nombre)));
        if (!nombres.length) disciplinas.append(elemento("span", "trainer-muted", "Tus disciplinas aparecerán al agregar clases."));
        porId("totalClasesDisponibles").textContent = clases.filter((clase) => clase.disponible && clase.deporteActivo !== false).length;
        porId("totalInscripciones").textContent = clases.reduce((total, clase) => total + (Number(clase.alumnosInscritos) || 0), 0);
    }

    function renderizarClases() {
        const lista = porId("listaClasesEntrenador");
        lista.replaceChildren();
        if (!clases.length) {
            lista.append(elemento("p", "trainer-empty", "Aún no tienes clases. Agrega la primera para organizar tus horarios y publicarla en el catálogo."));
            return;
        }
        clases.forEach((clase) => {
            const deporteActivo = clase.deporteActivo !== false;
            const tarjeta = elemento("article", "trainer-class" + (clase.disponible && deporteActivo ? "" : " trainer-class--inactive"));
            const superior = elemento("div", "trainer-class__top");
            superior.append(elemento("span", "trainer-class__sport", clase.nombreDeporte || "Disciplina sin asignar"),
                elemento("span", "trainer-class__status", !deporteActivo ? "Deporte inactivo" : clase.disponible ? "Disponible" : "No disponible"));
            tarjeta.append(superior, elemento("h3", "", clase.nombreClase || "Clase sin nombre"),
                elemento("p", "trainer-class__description", clase.descripcion || "Agrega una descripción al editar esta clase."));
            const detalles = elemento("div", "trainer-class__details");
            detalles.append(elemento("span", "", clase.precio === null || clase.precio === undefined ? "Precio por completar" : moneda.format(clase.precio) + " / clase"),
                elemento("span", "", (Number(clase.alumnosInscritos) || 0) + " alumnos inscritos"),
                elemento("span", "", clase.cupoMaximo ? "Capacidad: " + clase.cupoMaximo : "Capacidad por completar"));
            if (clase.cuposDisponibles !== null && clase.cuposDisponibles !== undefined) detalles.append(elemento("span", "", clase.cuposDisponibles + " cupos disponibles"));
            if (clase.nombreCancha) detalles.append(elemento("span", "", clase.nombreCancha));
            else detalles.append(elemento("span", "", "Sin cancha asignada: edita la clase."));
            if (clase.ubicacion && clase.ubicacion !== clase.nombreCancha) detalles.append(elemento("span", "", clase.ubicacion));
            tarjeta.append(detalles);
            const horarios = elemento("ul", "trainer-class__schedules");
            (clase.horarios || []).forEach((horario) => horarios.append(elemento("li", "", textoHorario(horario))));
            if (!horarios.childElementCount) horarios.append(elemento("li", "", "Horarios por completar. Edita esta clase para asignarlos."));
            tarjeta.append(horarios);
            const acciones = elemento("div", "trainer-class__actions");
            const editar = elemento("button", "trainer-button trainer-button--quiet", "Editar clase");
            editar.type = "button";
            editar.addEventListener("click", () => abrirEditor(clase));
            const disponibilidad = elemento("button", "trainer-button trainer-button--quiet", clase.disponible ? "Desactivar" : "Publicar clase");
            const eliminar = elemento("button", "trainer-button trainer-button--quiet", "Eliminar clase");
            eliminar.type = "button";
            eliminar.addEventListener("click", async () => {
                if (!confirm("¿Eliminar definitivamente la clase «" + clase.nombreClase + "» y sus horarios? Las reservas y pagos se conservarán.")) return;
                eliminar.disabled = true; editar.disabled = true; disponibilidad.disabled = true;
                try {
                    await modificar("/api/Entrenador/clases/" + encodeURIComponent(clase.idClase), "DELETE");
                    await cargarClases();
                    aviso("avisoEntrenador", "Clase eliminada definitivamente.");
                } catch (error) { aviso("avisoEntrenador", error.message, true); }
                finally { eliminar.disabled = false; editar.disabled = false; disponibilidad.disabled = false; }
            });
            disponibilidad.type = "button";
            if (!deporteActivo && !clase.disponible) {
                disponibilidad.disabled = true;
                disponibilidad.title = "Edita la clase para seleccionar un deporte activo antes de publicarla.";
            }
            if (!deporteActivo) tarjeta.append(elemento("p", "trainer-muted", "El administrador desactivó este deporte. La clase conserva sus datos y puedes editarla para cambiar de disciplina."));
            disponibilidad.addEventListener("click", async () => {
                disponibilidad.disabled = true;
                editar.disabled = true;
                try {
                    await modificar("/api/Entrenador/clases/" + encodeURIComponent(clase.idClase) + "/disponibilidad", "PUT", { disponible: !clase.disponible });
                    aviso("avisoEntrenador", clase.disponible ? "Clase desactivada. Sus datos se conservaron." : "Clase disponible en el catálogo.");
                    await cargarClases();
                } catch (error) {
                    aviso("avisoEntrenador", error.message, true);
                } finally {
                    disponibilidad.disabled = false;
                    editar.disabled = false;
                }
            });
            acciones.append(editar, disponibilidad, eliminar);
            tarjeta.append(acciones);
            lista.append(tarjeta);
        });
    }

    function textoHorario(horario) {
        return (dias[horario.diaSemana] || "Día sin asignar") + " · " + String(horario.horaInicio || "").slice(0, 5) + " – " + String(horario.horaFin || "").slice(0, 5);
    }

    function renderizarAgenda() {
        const agenda = porId("agendaEntrenador");
        agenda.replaceChildren();
        for (let dia = 1; dia <= 7; dia++) {
            const sesiones = clases.filter((clase) => clase.disponible && clase.deporteActivo !== false).flatMap((clase) =>
                (clase.horarios || []).filter((horario) => horario.diaSemana === dia).map((horario) => ({ clase, horario }))
            ).sort((a, b) => String(a.horario.horaInicio).localeCompare(String(b.horario.horaInicio)));
            if (!sesiones.length) continue;
            const bloque = elemento("section", "trainer-agenda-day");
            bloque.append(elemento("h3", "", dias[dia]));
            sesiones.forEach(({ clase, horario }) => {
                const sesion = elemento("p", "", clase.nombreClase);
                sesion.append(elemento("small", "", String(horario.horaInicio).slice(0, 5) + " – " + String(horario.horaFin).slice(0, 5) + (horario.nombreCancha || clase.nombreCancha ? " · " + (horario.nombreCancha || clase.nombreCancha) : " · Sin cancha asignada")));
                bloque.append(sesion);
            });
            agenda.append(bloque);
        }
        if (!agenda.childElementCount) agenda.append(elemento("p", "trainer-empty", "No tienes horarios publicados. Agrega o activa una clase para ver tu agenda semanal."));
    }


    function actualizarBotonesHorarios() {
        const filas = porId("horariosEditor").querySelectorAll(".trainer-schedule-row");
        filas.forEach(fila => { fila.querySelector("button").disabled = filas.length <= 1 || guardandoClase; });
        porId("btnAgregarHorario").disabled = filas.length >= 21 || consultandoCancha || !disponibilidad?.disponibles.length || guardandoClase;
        porId("btnGuardarClase").disabled = consultandoCancha || !disponibilidad?.disponibles.length || guardandoClase;
    }

    const minutos = hora => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
    const textoHora = valor => String(Math.floor(valor / 60)).padStart(2, "0") + ":" + String(valor % 60).padStart(2, "0");

    function opcionesHoras(select, valores, preferida) {
        select.replaceChildren(new Option("Selecciona una hora", ""));
        [...new Set(valores)].sort((a, b) => a - b).forEach(valor => select.add(new Option(textoHora(valor), textoHora(valor))));
        select.value = preferida && [...select.options].some(o => o.value === preferida) ? preferida : "";
    }

    function agregarHorario(horario = {}) {
        if (porId("horariosEditor").childElementCount >= 21) return;
        const fila = elemento("div", "trainer-schedule-row");
        const identificador = ++numeroHorario;
        ["dia", "inicio", "fin"].forEach((campo, indice) => {
            const grupo = elemento("div"), label = elemento("label", "", ["Día", "Inicio disponible", "Hora final"][indice]);
            const select = elemento("select");
            select.id = "horario-" + identificador + "-" + campo; label.htmlFor = select.id;
            select.dataset.campo = campo; select.required = true;
            grupo.append(label, select); fila.append(grupo);
        });
        const dia = fila.querySelector('[data-campo="dia"]');
        const inicio = fila.querySelector('[data-campo="inicio"]');
        const fin = fila.querySelector('[data-campo="fin"]');
        dia.add(new Option("Selecciona un día", ""));
        [...new Set((disponibilidad?.disponibles || []).map(h => h.diaSemana))].sort((a,b) => a-b).forEach(d => dia.add(new Option(dias[d], String(d))));
        dia.value = horario.diaSemana && [...dia.options].some(o => o.value === String(horario.diaSemana))
            ? String(horario.diaSemana) : dia.options[1]?.value || "";

        function finales(preferida = "") {
            const valor = inicio.value ? minutos(inicio.value) : null;
            const rango = (disponibilidad?.disponibles || []).find(h => h.diaSemana === Number(dia.value) &&
                valor !== null && minutos(h.horaInicio) <= valor && minutos(h.horaFin) > valor);
            const valores = [];
            if (rango) {
                const limite = minutos(rango.horaFin);
                for (let m = Math.ceil((valor + 1) / 15) * 15; m <= limite; m += 15) valores.push(m);
                valores.push(limite);
                if (preferida && minutos(preferida) > valor && minutos(preferida) <= limite) valores.push(minutos(preferida));
            }
            opcionesHoras(fin, valores, preferida);
        }
        function inicios(preferida = "", finalPreferida = "") {
            const rangos = (disponibilidad?.disponibles || []).filter(h => h.diaSemana === Number(dia.value));
            const valores = [];
            rangos.forEach(h => {
                const desde = minutos(h.horaInicio), hasta = minutos(h.horaFin);
                valores.push(desde);
                for (let m = Math.ceil(desde / 15) * 15; m < hasta; m += 15) valores.push(m);
            });
            if (preferida && rangos.some(h => minutos(h.horaInicio) <= minutos(preferida) && minutos(h.horaFin) > minutos(preferida)))
                valores.push(minutos(preferida));
            opcionesHoras(inicio, valores, preferida); finales(finalPreferida);
        }
        dia.addEventListener("change", () => inicios());
        inicio.addEventListener("change", () => finales());
        inicios(horario.horaInicio, horario.horaFin);
        const quitar = elemento("button", "trainer-button trainer-button--quiet", "Quitar");
        quitar.type = "button"; quitar.setAttribute("aria-label", "Quitar este horario");
        quitar.addEventListener("click", () => { fila.remove(); actualizarBotonesHorarios(); });
        fila.append(quitar); porId("horariosEditor").append(fila);
        actualizarBotonesHorarios();
    }

    function leerFilas() {
        return [...porId("horariosEditor").querySelectorAll(".trainer-schedule-row")].map(fila => ({
            diaSemana: Number(fila.querySelector('[data-campo="dia"]').value),
            horaInicio: fila.querySelector('[data-campo="inicio"]').value,
            horaFin: fila.querySelector('[data-campo="fin"]').value
        }));
    }

    async function consultarCancha(horarios = []) {
        const actual = ++consultaCancha, id = porId("claseCancha").value;
        disponibilidad = null; consultandoCancha = true;
        porId("horariosEditor").replaceChildren(); porId("franjasCanchaClase").replaceChildren();
        actualizarBotonesHorarios();
        aviso("avisoCanchaClase", id ? "Consultando los horarios libres de la cancha…" : "Selecciona un deporte y una cancha para consultar sus horarios.");
        if (!id) { consultandoCancha = false; actualizarBotonesHorarios(); return; }
        try {
            const params = new URLSearchParams();
            if (claseEditando) params.set("excluirClase", claseEditando.idClase);
            const datos = await solicitar("/api/Cancha/" + encodeURIComponent(id) + "/disponibilidad?" + params);
            if (actual !== consultaCancha) return;
            disponibilidad = datos;
            datos.disponibles.forEach(h => porId("franjasCanchaClase").append(elemento("li", "", textoHorario(h))));
            if (!datos.disponibles.length) {
                aviso("avisoCanchaClase", "No hay horarios libres. Selecciona otra cancha o consulta al administrador.", true);
            } else {
                aviso("avisoCanchaClase", "Estas franjas están libres para la cancha y para ti. Elige el inicio y el final de cada sesión.");
                (horarios.length ? horarios : [{}]).forEach(agregarHorario);
            }
        } catch (error) {
            if (actual === consultaCancha) aviso("avisoCanchaClase", error.message, true);
        } finally {
            if (actual === consultaCancha) { consultandoCancha = false; actualizarBotonesHorarios(); }
        }
    }

    function poblarCanchas(idCancha = null) {
        const select = porId("claseCancha");
        const candidatas = canchas.filter(c => String(c.idDeporte) === porId("claseDeporte").value);
        select.replaceChildren(new Option(candidatas.length ? "Selecciona una cancha" : "No hay canchas habilitadas para este deporte", ""));
        candidatas.forEach(c => select.add(new Option(c.nombre + (c.ubicacion ? " · " + c.ubicacion : ""), String(c.idCancha))));
        select.value = candidatas.some(c => String(c.idCancha) === String(idCancha)) ? String(idCancha) :
            candidatas.length === 1 ? String(candidatas[0].idCancha) : "";
    }

    function abrirEditor(clase = null) {
        claseEditando = clase; formClase.reset();
        aviso("avisoEditorClase", "");
        porId("tituloEditorClase").textContent = clase ? "EDITAR CLASE" : "NUEVA CLASE";
        porId("claseNombre").value = clase?.nombreClase || "";
        porId("claseDeporte").value = clase ? String(clase.idDeporte) : "";
        porId("claseDescripcion").value = clase?.descripcion || "";
        porId("clasePrecio").value = clase?.precio ?? "";
        porId("claseCupo").value = clase?.cupoMaximo ?? "";
        porId("claseDisponible").checked = clase ? clase.disponible : true;
        poblarCanchas(clase?.idCancha);
        modalClase.showModal();
        consultarCancha(clase?.horarios || []);
    }

    function leerClase() {
        const horarios = [...porId("horariosEditor").querySelectorAll(".trainer-schedule-row")].map((fila) => ({
            diaSemana: Number(fila.querySelector('[data-campo="dia"]').value),
            horaInicio: fila.querySelector('[data-campo="inicio"]').value,
            horaFin: fila.querySelector('[data-campo="fin"]').value
        }));
        horarios.forEach((horario, indice) => {
            if (!horario.horaInicio || !horario.horaFin || horario.horaInicio >= horario.horaFin) throw new Error("Revisa el horario " + (indice + 1) + ": la hora final debe ser posterior a la inicial.");
            if (horarios.some((otro, otroIndice) => otroIndice < indice && otro.diaSemana === horario.diaSemana && otro.horaInicio < horario.horaFin && horario.horaInicio < otro.horaFin)) throw new Error("Los horarios de esta clase se cruzan. Ajusta los días u horas.");
        });
        const datos = {
            idDeporte: Number(porId("claseDeporte").value),
            nombreClase: porId("claseNombre").value.trim(),
            descripcion: porId("claseDescripcion").value.trim(),
            precio: Number(porId("clasePrecio").value),
            cupoMaximo: Number(porId("claseCupo").value),
            idCancha: Number(porId("claseCancha").value),
            disponible: porId("claseDisponible").checked,
            horarios
        };
        if (!datos.idCancha) throw new Error("Selecciona una cancha para esta clase.");
        if (!horarios.length || horarios.some(h => !(disponibilidad?.disponibles || []).some(libre =>
            libre.diaSemana === h.diaSemana && libre.horaInicio <= h.horaInicio && libre.horaFin >= h.horaFin)))
            throw new Error("Selecciona horarios dentro de una franja disponible.");
        if (datos.nombreClase.length < 2 || !datos.descripcion) throw new Error("Completa el nombre y la descripción de la clase.");
        return datos;
    }

    function bloquearFormulario(form, bloqueado) {
        form.querySelectorAll('button[type="submit"]').forEach(boton => {
            if (bloqueado) boton.setAttribute("aria-busy", "true");
            else boton.removeAttribute("aria-busy");
        });
        form.querySelectorAll("input, select, textarea, button").forEach((campo) => { campo.disabled = bloqueado; });
    }

    formClase.addEventListener("submit", async (evento) => {
        evento.preventDefault();
        if (guardandoClase || !formClase.reportValidity()) return;
        aviso("avisoEditorClase", "");
        let datos;
        try { datos = leerClase(); } catch (error) { aviso("avisoEditorClase", error.message, true); return; }
        guardandoClase = true;
        bloquearFormulario(formClase, true);
        porId("btnGuardarClase").textContent = "Guardando…";
        try {
            const ruta = "/api/Entrenador/clases" + (claseEditando ? "/" + encodeURIComponent(claseEditando.idClase) : "");
            await modificar(ruta, claseEditando ? "PUT" : "POST", datos);
            modalClase.close();
            aviso("avisoEntrenador", claseEditando ? "Clase actualizada correctamente." : "Clase creada correctamente.");
            await cargarClases();
        } catch (error) {
            if (modalClase.open) aviso("avisoEditorClase", error.message, true);
            else aviso("avisoEntrenador", "La clase se guardó, pero no fue posible actualizar el panel. Usa Actualizar panel.", true);
        } finally {
            guardandoClase = false;
            bloquearFormulario(formClase, false);
            porId("btnGuardarClase").textContent = "Guardar clase";
            actualizarBotonesHorarios();
        }
    });

    formPassword.addEventListener("submit", async (evento) => {
        evento.preventDefault();
        if (guardandoPassword || !formPassword.reportValidity()) return;
        const passwordActual = porId("passwordActual").value;
        const passwordNueva = porId("passwordNueva").value;
        const confirmarPassword = porId("confirmarPassword").value;
        if (passwordNueva !== confirmarPassword) { aviso("avisoPasswordEntrenador", "La confirmación no coincide con la contraseña nueva.", true); return; }
        if (passwordNueva === passwordActual) { aviso("avisoPasswordEntrenador", "Elige una contraseña diferente a la actual.", true); return; }
        if (passwordNueva.length < 8 || !/\p{Lu}/u.test(passwordNueva) || !/\p{Ll}/u.test(passwordNueva) || !/\p{Nd}/u.test(passwordNueva) || !/[^\p{L}\p{N}]/u.test(passwordNueva) || new TextEncoder().encode(passwordNueva).length > 72) {
            aviso("avisoPasswordEntrenador", "La contraseña debe cumplir los requisitos indicados debajo del campo.", true);
            return;
        }
        guardandoPassword = true;
        bloquearFormulario(formPassword, true);
        porId("btnGuardarPassword").textContent = "Actualizando…";
        try {
            await modificar("/api/Entrenador/password", "PUT", { passwordActual, passwordNueva, confirmarPassword });
            modalPassword.close();
            aviso("avisoEntrenador", "Tu contraseña se actualizó correctamente. Utiliza la nueva contraseña en tu próximo inicio de sesión.");
        } catch (error) {
            aviso("avisoPasswordEntrenador", error.message, true);
        } finally {
            guardandoPassword = false;
            bloquearFormulario(formPassword, false);
            porId("btnGuardarPassword").textContent = "Actualizar contraseña";
        }
    });

    porId("claseDeporte").addEventListener("change", () => { poblarCanchas(); consultarCancha(); });
    porId("claseCancha").addEventListener("change", () => consultarCancha());
    porId("btnActualizarCanchaClase").addEventListener("click", () => consultarCancha(leerFilas()));
    porId("btnNuevaClase").addEventListener("click", () => abrirEditor());
    porId("btnAgregarHorario").addEventListener("click", () => agregarHorario());
    porId("btnAbrirPassword").addEventListener("click", () => { formPassword.reset(); aviso("avisoPasswordEntrenador", ""); modalPassword.showModal(); });
    document.querySelectorAll("[data-cerrar-dialog]").forEach((boton) => boton.addEventListener("click", () => {
        if ((boton.dataset.cerrarDialog === modalClase.id && guardandoClase) || (boton.dataset.cerrarDialog === modalPassword.id && guardandoPassword)) return;
        porId(boton.dataset.cerrarDialog).close();
    }));
    modalClase.addEventListener("cancel", (evento) => { if (guardandoClase) evento.preventDefault(); });
    modalPassword.addEventListener("cancel", (evento) => { if (guardandoPassword) evento.preventDefault(); });
    modalPassword.addEventListener("close", () => formPassword.reset());

    async function iniciar() {
        if (cargando) return;
        cargando = true;
        porId("btnActualizarEntrenador").disabled = true;
        porId("btnNuevaClase").disabled = true;
        aviso("avisoEntrenador", "Cargando tu panel…");
        porId("accesoEntrenador").hidden = true;
        try {
            const perfil = await solicitar("/api/Entrenador/perfil");
            mostrarPerfil(perfil);
            const [deportes, canchasActuales] = await Promise.all([solicitar("/api/Clases/deportes"), solicitar("/api/Cancha"), cargarClases()]);
            canchas = canchasActuales;
            if (!Array.isArray(deportes)) throw new Error("No fue posible cargar las disciplinas.");
            const select = porId("claseDeporte");
            select.replaceChildren(new Option("Selecciona un deporte", ""));
            deportes.forEach((deporte) => select.append(new Option(deporte.nombreDeporte, String(deporte.idDeporte))));
            porId("panelEntrenador").hidden = false;
            porId("btnNuevaClase").disabled = !deportes.length || !canchas.length;
            aviso("avisoEntrenador", !deportes.length ? "Solicita al administrador que registre los deportes." : !canchas.length ? "Solicita al administrador que registre canchas y horarios para agregar clases." : "");
        } catch (error) {
            aviso("avisoEntrenador", error.message, true);
        } finally {
            cargando = false;
            porId("btnActualizarEntrenador").disabled = false;
        }
    }
    porId("btnActualizarEntrenador").addEventListener("click", iniciar);
    iniciar();
});
