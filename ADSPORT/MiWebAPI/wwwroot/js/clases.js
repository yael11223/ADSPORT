/* ==========================================================
   ADSPORT — SECCIÓN DE CLASES (LÓGICA INTERACTIVA)
   ========================================================== */

document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    // 1. Mostrar/Ocultar subsección de profesores al hacer clic en "Siguiente"
    const btnsSiguiente = document.querySelectorAll(".btn-siguiente");

    btnsSiguiente.forEach(btn => {
        btn.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();

            const targetSelector = this.getAttribute("data-target");
            const panelProfesores = document.querySelector(targetSelector);

            if (panelProfesores) {
                panelProfesores.classList.toggle("d-none");

                // Desplazamiento suave hacia el panel desplegado
                if (!panelProfesores.classList.contains("d-none")) {
                    panelProfesores.scrollIntoView({ behavior: "smooth", block: "nearest" });
                }
            }
        });
    });

    // 2. Cambiar dinámicamente los datos del profesor al hacer clic en su avatar
    const avatares = document.querySelectorAll(".profe-avatar-item");

    avatares.forEach(item => {
        item.addEventListener("click", function () {
            const panelPadre = this.closest(".profesores-desplegable");

            // Marcar avatar activo
            panelPadre.querySelectorAll(".profe-avatar-item").forEach(a => a.classList.remove("active"));
            this.classList.add("active");

            // Obtener atributos data-*
            const nombre = this.getAttribute("data-nombre");
            const exp = this.getAttribute("data-exp");
            const precio = this.getAttribute("data-precio");
            const desc = this.getAttribute("data-desc");
            const horarios = JSON.parse(this.getAttribute("data-horarios") || "[]");

            // Actualizar vista izquierda (descripción breve)
            panelPadre.querySelector(".profe-nombre-lbl").textContent = nombre;
            panelPadre.querySelector(".profe-desc-lbl").textContent = desc;

            // Actualizar tarjeta derecha (bloques Figma)
            panelPadre.querySelector(".det-nombre").textContent = nombre;
            panelPadre.querySelector(".det-exp").textContent = exp;
            panelPadre.querySelector(".det-precio").textContent = precio;

            // Cargar filas de horarios dinámicamente
            const contenedorHorarios = panelPadre.querySelector(".lista-horarios");
            contenedorHorarios.innerHTML = "";

            horarios.forEach(h => {
                contenedorHorarios.innerHTML += `
                    <div class="figma-horario-row">
                        <span class="det-lugares">${h.lugares}</span>
                        <span class="det-hora">${h.hora}</span>
                        <span class="det-dias">${h.dias}</span>
                    </div>
                `;
            });
        });
    });
});