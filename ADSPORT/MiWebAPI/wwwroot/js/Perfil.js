
/* ==========================================================
   ADSPORT - PERFIL DE USUARIO
   Archivo: wwwroot/js/perfil.js

   FUNCIONES:
   1. Verificar la sesión del usuario
   2. Consultar la información del perfil
   3. Mostrar los datos personales
   4. Cargar la fotografía de SQL Server
   5. Utilizar un avatar predeterminado
   6. Mostrar mensajes de error
   ========================================================== */

document.addEventListener("DOMContentLoaded", () => {

    iniciarPerfil();

});


/* ==========================================================
   CONFIGURACIÓN
   ========================================================== */

const API_PERFIL = "/api/Usuario/mi-perfil";

const API_FOTO = "/api/Usuario/mi-foto";

const API_SESION = "/api/LoginUsuario/sesion";

const FOTO_PREDETERMINADA = "/img/perfiles/default.png";


/* ==========================================================
   1. INICIAR PERFIL
   ========================================================== */

async function iniciarPerfil() {

    try {

        mostrarAviso(
            "Cargando información de tu perfil..."
        );

        // Verificar que el usuario inició sesión
        const respuestaSesion = await fetch(API_SESION, {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store"
        });

        if (!respuestaSesion.ok) {

            throw new Error(
                "No fue posible comprobar tu sesión."
            );

        }

        const sesion = await respuestaSesion.json();

        // Si no tiene sesión, regresar al login
        if (!sesion.autenticado) {

            window.location.replace("/LoginUsuario.html");

            return;

        }

        // Consultar información real del usuario
        await cargarInformacionPerfil();

    } catch (error) {

        console.error(
            "Error al iniciar el perfil:",
            error
        );

        mostrarAviso(
            "No fue posible cargar tu perfil. Intenta actualizar la página.",
            "error"
        );

    }

}


/* ==========================================================
   2. CONSULTAR INFORMACIÓN DEL PERFIL
   ========================================================== */

async function cargarInformacionPerfil() {

    const respuesta = await fetch(API_PERFIL, {

        method: "GET",

        credentials: "same-origin",

        cache: "no-store"

    });

    if (respuesta.status === 401) {

        window.location.replace("/LoginUsuario.html");

        return;

    }

    if (!respuesta.ok) {

        throw new Error(
            `Error al consultar el perfil: ${respuesta.status}`
        );

    }

    const usuario = await respuesta.json();

    // Mostrar datos personales
    mostrarInformacionUsuario(usuario);

    // Mostrar fotografía
    cargarFotografiaUsuario(usuario);

    // Ocultar aviso de carga
    ocultarAviso();

}


/* ==========================================================
   3. MOSTRAR DATOS PERSONALES
   ========================================================== */

function mostrarInformacionUsuario(usuario) {

    // Nombre completo
    colocarTexto(
        "lblNombreUsuario",
        usuario.nombreCompleto ||
        usuario.nombre ||
        "Usuario ADSPORT"
    );

    // Correo electrónico
    colocarTexto(
        "lblCorreoUsuario",
        usuario.correo || "No registrado"
    );

    // Teléfono
    colocarTexto(
        "lblTelefonoUsuario",
        usuario.telefono || "No registrado"
    );

    // Identificador de usuario
    colocarTexto(
        "lblIdUsuario",
        usuario.idUsuario ?? "No disponible"
    );

    // Rol del usuario
    colocarTexto(
        "lblRolUsuario",
        usuario.nombreRol || "USUARIO ADSPORT"
    );

    // Estado del usuario
    mostrarEstadoUsuario(usuario.estatus);

}


/* ==========================================================
   4. MOSTRAR ESTADO DEL USUARIO
   ========================================================== */

function mostrarEstadoUsuario(estatus) {

    const elemento = document.getElementById(
        "estadoUsuario"
    );

    if (!elemento) {
        return;
    }

    elemento.classList.remove(
        "active",
        "inactive"
    );

    if (
        estatus === null ||
        estatus === undefined ||
        String(estatus).trim() === ""
    ) {

        elemento.textContent = "Estado no disponible";

        return;

    }

    const estado = String(estatus)
        .trim()
        .toUpperCase();

    if (
        estado === "ACTIVO" ||
        estado === "ACTIVA" ||
        estado === "1" ||
        estado === "TRUE"
    ) {

        elemento.textContent = "● ACTIVO";

        elemento.classList.add("active");

    } else if (
        estado === "INACTIVO" ||
        estado === "INACTIVA" ||
        estado === "0" ||
        estado === "FALSE"
    ) {

        elemento.textContent = "● INACTIVO";

        elemento.classList.add("inactive");

    } else {

        elemento.textContent = estado;

    }

}


/* ==========================================================
   5. CARGAR FOTOGRAFÍA DEL USUARIO
   ========================================================== */

function cargarFotografiaUsuario(usuario) {

    const imagen = document.getElementById(
        "imgPerfilUsuario"
    );

    if (!imagen) {
        return;
    }

    // Si la fotografía falla, mostrar la predeterminada
    imagen.addEventListener("error", () => {

        if (
            !imagen.src.endsWith(FOTO_PREDETERMINADA)
        ) {

            imagen.src = FOTO_PREDETERMINADA;

        }

    });

    // ¿El usuario tiene fotografía en SQL Server?
    if (usuario.tieneFoto === true) {

        imagen.src = API_FOTO;

    } else {

        imagen.src = FOTO_PREDETERMINADA;

    }

}


/* ==========================================================
   6. COLOCAR TEXTO DE FORMA SEGURA
   ========================================================== */

function colocarTexto(id, valor) {

    const elemento = document.getElementById(id);

    if (!elemento) {
        return;
    }

    // textContent evita interpretar datos como HTML
    elemento.textContent = String(valor);

}


/* ==========================================================
   7. MOSTRAR AVISOS
   ========================================================== */

function mostrarAviso(mensaje, tipo = "") {

    const aviso = document.getElementById(
        "perfilAviso"
    );

    if (!aviso) {
        return;
    }

    aviso.hidden = false;

    aviso.classList.remove(
        "is-success",
        "is-error"
    );

    if (tipo === "error") {

        aviso.classList.add("is-error");

    }

    if (tipo === "success") {

        aviso.classList.add("is-success");

    }

    aviso.textContent = mensaje;

}


/* ==========================================================
   8. OCULTAR AVISOS
   ========================================================== */

function ocultarAviso() {

    const aviso = document.getElementById(
        "perfilAviso"
    );

    if (!aviso) {
        return;
    }

    aviso.hidden = true;

    aviso.textContent = "";

}


/* ==========================================================
   FIN - PERFIL DE USUARIO ADSPORT
   ========================================================== */
