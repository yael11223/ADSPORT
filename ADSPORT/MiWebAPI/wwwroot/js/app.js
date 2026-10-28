
const formulario = document.getElementById("formEntrenador");
const tabla = document.getElementById("tablaEntrenadores");
const filtro = document.getElementById("txtFiltro");
const mensaje = document.getElementById("mensaje");
const sinResultados = document.getElementById("sinResultados");
const tituloFormulario = document.getElementById("tituloFormulario");
const btnGuardar = document.getElementById("btnGuardar");
const btnCancelar = document.getElementById("btnCancelar");
const btnRecargar = document.getElementById("btnRecargar");

let usuarios = [];

document.addEventListener("DOMContentLoaded", obtenerUsuarios);
formulario.addEventListener("submit", guardarUsuario);
filtro.addEventListener("input", aplicarFiltro);
btnCancelar.addEventListener("click", limpiarFormulario);
btnRecargar.addEventListener("click", obtenerUsuarios);


async function solicitar(url, opciones = {}) {
  const respuesta = await fetch(url, opciones);

  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    throw new Error(detalle || `Error HTTP ${respuesta.status}`);
  }

  if (respuesta.status === 204) {
    return null;
  }

  return respuesta.json();
}

async function obtenerUsuarios() {
  cambiarEstadoCarga(true);

  try {
      usuarios = await solicitar(API_URL);
    aplicarFiltro();
  } catch (error) {
    mostrarMensaje(
      "No fue posible consultar la API. Confirma que el proyecto .NET se encuentre ejecutándose.",
      "danger"
    );
    console.error(error);
  } finally {
    cambiarEstadoCarga(false);
  }
}

function mostrarUsuarios(lista) {
    tabla.innerHTML = "";
    sinResultados.classList.toggle("d-none", lista.length > 0);

    lista.forEach((usuario) => {
        const fila = document.createElement("tr");

        const nombreCompleto = [
            usuario.nombre,
            usuario.apellidoPaterno,
            usuario.apellidoMaterno
        ].filter(Boolean).join(" ");

        fila.innerHTML = `
      <td>${escaparHtml(nombreCompleto)}</td>
      <td>${escaparHtml(usuario.correo)}</td>
      <td>${escaparHtml(usuario.telefono)}</td>
      <td>${escaparHtml(usuario.nombreRol)}</td>
      <td>${escaparHtml(usuario.estatus)}</td>
      <td class="text-center acciones">
        <button class="btn btn-sm btn-outline-primary" data-accion="editar"
                data-id="${usuario.idUsuario}">Editar</button>
        <button class="btn btn-sm btn-outline-danger" data-accion="eliminar"
                data-id="${usuario.idUsuario}">Eliminar</button>
      </td>`;

        tabla.appendChild(fila);
    });
}

tabla.addEventListener("click", (evento) => {
  const boton = evento.target.closest("button[data-accion]");
  if (!boton) return;

  const id = Number(boton.dataset.id);
  if (boton.dataset.accion === "editar") cargarEmpleado(id);
  if (boton.dataset.accion === "eliminar") eliminarEmpleado(id);
});


async function cargarEmpleado(id) {
    try {
        const empleado = await solicitar(`${API_URL}/${id}`);

        document.getElementById("idEntrenador").value = empleado.idUsuario;
        document.getElementById("entrenadorNombre").value = empleado.nombre ?? "";
        document.getElementById("entrenadorPaterno").value = empleado.apellidoPaterno ?? "";
        document.getElementById("entrenadorMaterno").value = empleado.apellidoMaterno ?? "";
        document.getElementById("entrenadorCorreo").value = empleado.correo ?? "";
        document.getElementById("entrenadorTelefono").value = empleado.telefono ?? "";
        document.getElementById("entrenadorRol").value = empleado.idRol ?? "";
        document.getElementById("entrenadorEstatus").value = empleado.estatus ?? "";
        document.getElementById("entrenadorQR").value = empleado.codigoQr ?? "";

        tituloFormulario.textContent = "Editar empleado";
        btnGuardar.textContent = "Actualizar";
        btnCancelar.classList.remove("d-none");

        formulario.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    } catch (error) {
        mostrarMensaje("No fue posible obtener al empleado.", "danger");
        console.error(error);
    }
}



async function guardarUsuario(evento) {
    evento.preventDefault();

    if (!formulario.checkValidity()) {
        formulario.classList.add("was-validated");
        return;
    }

    const usuario = leerFormulario();
    const esNuevo = usuario.idUsuario === 0;

    try {
        btnGuardar.disabled = true;
        btnGuardar.textContent = esNuevo ? "Guardando..." : "Actualizando...";

        const resultado = await solicitar(API_URL, {
            method: esNuevo ? "POST" : "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(usuario)
        });

        if (resultado.numeroError !== 0) {
            throw new Error(
                `Error ${resultado.numeroError}: ${resultado.respuesta}`
            );
        }

        mostrarMensaje(resultado.respuesta, "success");
        limpiarFormulario();
        await obtenerUsuarios();

    } catch (error) {
        mostrarMensaje(
            error.message || "No fue posible guardar el usuario.",
            "danger"
        );
        console.error(error);
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.textContent = "Guardar";
    }
}



async function eliminarEmpleado(id) {
    const empleado = usuarios.find(
        (item) => Number(item.idUsuario) === Number(id)
    );

    const nombre = [
        empleado?.nombre,
        empleado?.apellidoPaterno,
        empleado?.apellidoMaterno
    ].filter(Boolean).join(" ") || "seleccionado";

    if (!confirm(`¿Deseas eliminar al empleado ${nombre}?`)) return;

    try {
        const resultado = await solicitar(`${API_URL}/${id}`, {
            method: "DELETE"
        });

        if (resultado.numeroError !== 0) {
            throw new Error(
                `Error ${resultado.numeroError}: ${resultado.respuesta}`
            );
        }

        mostrarMensaje(resultado.respuesta, "success");
        await obtenerUsuarios();

    } catch (error) {
        mostrarMensaje(
            error.message || "No fue posible eliminar al empleado.",
            "danger"
        );
        console.error(error);
    }
}


function leerFormulario() {
  return {
      idUsuario: Number(document.getElementById("idEntrenador").value),
      idRol: Number(document.getElementById("entrenadorRol").value),
      nombre: document.getElementById("entrenadorNombre").value.trim(),
      apellidoPaterno: document.getElementById("entrenadorPaterno").value.trim(),
      apellidoMaterno: document.getElementById("entrenadorMaterno").value.trim(),
      correo: document.getElementById("entrenadorCorreo").value.trim(),
      telefono: Number(document.getElementById("entrenadorTelefono").value),
      estatus: document.getElementById("entrenadorEstatus").value,
      codigoQr: document.getElementById("entrenadorQR").value.trim()
  };
}

function limpiarFormulario() {
  formulario.reset();
  formulario.classList.remove("was-validated");
  document.getElementById("idEmpleado").value = "0";
  tituloFormulario.textContent = "Nuevo empleado";
  btnGuardar.textContent = "Guardar";
  btnCancelar.classList.add("d-none");
}


function aplicarFiltro() {
    const texto = filtro.value.trim().toLowerCase();

    const resultados = usuarios.filter((usuario) => {
        const nombreCompleto = [
            usuario.nombre,
            usuario.apellidoPaterno,
            usuario.apellidoMaterno
        ].filter(Boolean).join(" ");

        return nombreCompleto.toLowerCase().includes(texto) ||
            (usuario.correo ?? "").toLowerCase().includes(texto);
    });

    mostrarUsuarios(resultados);
}


function cambiarEstadoCarga(cargando) {
  btnRecargar.disabled = cargando;
  btnRecargar.textContent = cargando ? "Cargando..." : "Recargar";
}

function mostrarMensaje(texto, tipo) {
  mensaje.textContent = texto;
  mensaje.className = `alert alert-${tipo}`;

  window.clearTimeout(mostrarMensaje.temporizador);
  mostrarMensaje.temporizador = window.setTimeout(() => {
    mensaje.classList.add("d-none");
  }, 4500);
}

function convertirFechaParaInput(fecha) {
  if (!fecha) return "";
  return fecha.substring(0, 10);
}

function formatearMoneda(valor) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN"
  }).format(valor ?? 0);
}

function escaparHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
