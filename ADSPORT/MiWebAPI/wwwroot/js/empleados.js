document.addEventListener("DOMContentLoaded", () => {
    cargarRoles();
    configurarFormularioRol();
});

// 1. CARGAR ROLES EN EL SELECTOR DEL FORMULARIO DE ENTRENADORES
async function cargarRoles() {
    try {
        const respuesta = await fetch("/api/Rol");
        if (!respuesta.ok) throw new Error("Error al obtener la lista de roles.");

        const roles = await respuesta.json();
        const selectRol = document.getElementById("entrenadorRol");

        if (selectRol) {
            selectRol.innerHTML = '<option value="">Seleccionar rol</option>';
            roles.forEach(rol => {
                selectRol.innerHTML += `<option value="${rol.idRol}">${rol.nombreRol}</option>`;
            });
        }
    } catch (error) {
        console.error("Error al cargar los roles:", error);
    }
}

// 2. CREAR UN NUEVO ROL DESDE EL MODAL Y GUARDARLO EN SQL SERVER
function configurarFormularioRol() {
    const formRol = document.getElementById("formNuevoRol");
    if (!formRol) return;

    formRol.addEventListener("submit", async (evento) => {
        evento.preventDefault();

        const nombreRolInput = document.getElementById("nombreRol");
        const mensajeRol = document.getElementById("mensajeRol");
        const nombre = nombreRolInput.value.trim();

        if (!nombre) return;

        try {
            const respuesta = await fetch("/api/Rol", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nombreRol: nombre })
            });

            const resultado = await respuesta.json();

            mensajeRol.classList.remove("d-none", "text-danger", "text-success");

            if (resultado.isSuccess) {
                mensajeRol.textContent = resultado.respuesta || "Rol registrado correctamente.";
                mensajeRol.classList.add("text-success");

                // Limpiar campo de entrada y actualizar el combo de roles
                nombreRolInput.value = "";
                await cargarRoles();

                // Cierra el modal automáticamente a los 1.5 segundos
                setTimeout(() => {
                    const modalElement = document.getElementById("modalNuevoRol");
                    const modalInstance = bootstrap.Modal.getInstance(modalElement);
                    if (modalInstance) modalInstance.hide();
                    mensajeRol.classList.add("d-none");
                }, 1500);
            } else {
                mensajeRol.textContent = resultado.respuesta || "No se pudo registrar el rol.";
                mensajeRol.classList.add("text-danger");
            }
        } catch (error) {
            console.error("Error al guardar el rol:", error);
            mensajeRol.textContent = "Ocurrió un error de conexión con el servidor.";
            mensajeRol.classList.remove("d-none");
            mensajeRol.classList.add("text-danger");
        }
    });
}