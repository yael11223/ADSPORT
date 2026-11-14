const API_DEPORTE = "/api/Deporte";

const formDeporte = document.getElementById("formDeporte");
const idDeporteInput = document.getElementById("idDeporte");
const nombreDeporteInput = document.getElementById("nombreDeporte");
const descripcionInput = document.getElementById("descripcion");
const imagenDeporteInput = document.getElementById("imagenDeporte");
const contenedorPreview = document.getElementById("contenedorPreview");
const previewImagenDeporte = document.getElementById("previewImagenDeporte");
const alertaApi = document.getElementById("alertaApi");
const tablaBody = document.getElementById("tablaDeportesBody");
const totalRegistros = document.getElementById("totalRegistros");
const tituloFormulario = document.getElementById("tituloFormulario");
const btnGuardar = document.getElementById("btnGuardar");
const btnCancelar = document.getElementById("btnCancelar");

const IMAGEN_PLACEHOLDER = "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=200&q=60";

function leerSesionAdmin() {
    const llaves = ["empleados_usuario", "usuario", "admin_usuario", "user"];
    for (const key of llaves) {
        const raw = sessionStorage.getItem(key) || localStorage.getItem(key);
        if (raw) {
            try {
                return JSON.parse(raw);
            } catch {
                return { rol: raw };
            }
        }
    }
    return null;
}

document.addEventListener("DOMContentLoaded", () => {
    const usuario = leerSesionAdmin();
    if (!usuario) {
        window.location.replace("login.html");
        return;
    }

    const rol = (usuario.nombreRol || usuario.rol || "").toUpperCase().trim();
    if (rol === "USUARIO" || rol === "CLIENTE") {
        window.location.replace("indexUsuario.html");
        return;
    }

    listarDeportes();
});

imagenDeporteInput?.addEventListener("change", () => {
    const archivo = imagenDeporteInput.files?.[0];
    if (!archivo) {
        contenedorPreview.classList.add("d-none");
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        previewImagenDeporte.src = e.target.result;
        contenedorPreview.classList.remove("d-none");
    };
    reader.readAsDataURL(archivo);
});

function mostrarRespuestaApi(numeroError, respuesta) {
    alertaApi.classList.remove("d-none", "alert-success", "alert-danger");
    alertaApi.classList.add(numeroError === 0 ? "alert-success" : "alert-danger");
    alertaApi.innerHTML = `
        <strong>numeroError:</strong> ${numeroError} — <strong>respuesta:</strong> ${respuesta}
    `;
}

function limpiarFormulario() {
    formDeporte.reset();
    formDeporte.classList.remove("was-validated");
    idDeporteInput.value = "0";
    contenedorPreview.classList.add("d-none");
    previewImagenDeporte.src = "";
    tituloFormulario.textContent = "REGISTRAR DEPORTE";
    btnGuardar.textContent = "GUARDAR DEPORTE";
    btnCancelar.classList.add("d-none");
}

btnCancelar.addEventListener("click", () => {
    limpiarFormulario();
    alertaApi.classList.add("d-none");
});

async function subirImagenDeporte(idDeporte, archivo) {
    const formData = new FormData();
    formData.append("archivo", archivo);

    const res = await fetch(`${API_DEPORTE}/${idDeporte}/imagen`, {
        method: "POST",
        body: formData
    });
    return await res.json();
}

formDeporte.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nombreVal = nombreDeporteInput.value.trim();
    const descVal = descripcionInput.value.trim();
    const archivoImagen = imagenDeporteInput.files?.[0] || null;

    if (!nombreVal || !descVal) {
        formDeporte.classList.add("was-validated");
        mostrarRespuestaApi(1, "Todos los campos marcados con * son obligatorios.");
        return;
    }

    const id = parseInt(idDeporteInput.value, 10) || 0;
    const esEdicion = id > 0;

    try {
        const url = esEdicion ? `${API_DEPORTE}/${id}` : API_DEPORTE;
        const metodo = esEdicion ? "PUT" : "POST";

        const response = await fetch(url, {
            method: metodo,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                idDeporte: id,
                nombreDeporte: nombreVal,
                descripcion: descVal
            })
        });

        const data = await response.json();

        if (data.numeroError === 0) {
            let idDestino = id;

            // Si fue registro nuevo, obtener el ID recién creado para vincular su imagen
            if (!esEdicion && archivoImagen) {
                const resLista = await fetch(API_DEPORTE, { cache: "no-store" });
                const listaActual = await resLista.json();
                const creado = listaActual
                    .filter(d => d.nombreDeporte.trim().toLowerCase() === nombreVal.toLowerCase())
                    .sort((a, b) => b.idDeporte - a.idDeporte)[0];
                if (creado) {
                    idDestino = creado.idDeporte;
                }
            }

            if (archivoImagen && idDestino > 0) {
                const resImg = await subirImagenDeporte(idDestino, archivoImagen);
                if (resImg.numeroError !== 0) {
                    mostrarRespuestaApi(resImg.numeroError, `${data.respuesta} (Aviso imagen: ${resImg.respuesta})`);
                } else {
                    mostrarRespuestaApi(0, `${data.respuesta} e imagen cargada.`);
                }
            } else {
                mostrarRespuestaApi(data.numeroError, data.respuesta);
            }

            limpiarFormulario();
            await listarDeportes();
        } else {
            mostrarRespuestaApi(data.numeroError, data.respuesta);
        }
    } catch (error) {
        mostrarRespuestaApi(-1, "Error de conexión con la API: " + error.message);
    }
});

async function listarDeportes() {
    try {
        const response = await fetch(API_DEPORTE, { cache: "no-store" });
        const lista = await response.json();

        totalRegistros.textContent = `${lista.length} registro(s)`;

        if (!lista || lista.length === 0) {
            tablaBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted">No hay deportes registrados todavía.</td>
                </tr>
            `;
            return;
        }

        tablaBody.innerHTML = lista.map(item => `
            <tr>
                <td>${item.idDeporte}</td>
                <td>
                    <img src="${item.imagenUrl || IMAGEN_PLACEHOLDER}"
                         alt="${item.nombreDeporte}"
                         style="width: 56px; height: 40px; object-fit: cover; border-radius: 6px; border: 1px solid #333;">
                </td>
                <td class="fw-bold">${item.nombreDeporte}</td>
                <td>${item.descripcion || "-"}</td>
                <td>${item.fechaUltimaModificacion || "-"}</td>
                <td class="text-center">
                    <button type="button" class="btn btn-sm btn-warning me-1" onclick="cargarParaEditar(${item.idDeporte})">Editar</button>
                    <button type="button" class="btn btn-sm btn-danger" onclick="eliminarDeporte(${item.idDeporte})">Eliminar</button>
                </td>
            </tr>
        `).join("");
    } catch (error) {
        tablaBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-danger">Error al cargar los datos: ${error.message}</td>
            </tr>
        `;
    }
}

async function cargarParaEditar(id) {
    try {
        const response = await fetch(`${API_DEPORTE}/${id}`, { cache: "no-store" });
        const deporte = await response.json();

        idDeporteInput.value = deporte.idDeporte;
        nombreDeporteInput.value = deporte.nombreDeporte;
        descripcionInput.value = deporte.descripcion || "";
        imagenDeporteInput.value = "";

        if (deporte.imagenUrl) {
            previewImagenDeporte.src = deporte.imagenUrl;
            contenedorPreview.classList.remove("d-none");
        } else {
            contenedorPreview.classList.add("d-none");
        }

        tituloFormulario.textContent = `EDITAR DEPORTE #${deporte.idDeporte}`;
        btnGuardar.textContent = "ACTUALIZAR DEPORTE";
        btnCancelar.classList.remove("d-none");
        alertaApi.classList.add("d-none");
    } catch (error) {
        mostrarRespuestaApi(-1, "No se pudo cargar el deporte: " + error.message);
    }
}

async function eliminarDeporte(id) {
    if (!confirm("¿Seguro que deseas eliminar este deporte del catálogo?")) return;

    try {
        const response = await fetch(`${API_DEPORTE}/${id}`, { method: "DELETE" });
        const data = await response.json();

        mostrarRespuestaApi(data.numeroError, data.respuesta);

        if (data.numeroError === 0) {
            await listarDeportes();
        }
    } catch (error) {
        mostrarRespuestaApi(-1, "Error al eliminar: " + error.message);
    }
}