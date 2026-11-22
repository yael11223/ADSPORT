"use strict";
(() => {
    function iniciar() {
        const body = document.body;
        if (!body || body.classList.contains("ads-motion")) return;
        body.classList.add("ads-motion");
        const preferencia = window.matchMedia("(prefers-reduced-motion: reduce)");
        const puedeAnimar = typeof Element.prototype.animate === "function";
        const entradas = [
            ".employee-header", ".sports-admin-heading", ".dashboard-hero", ".section-heading",
            ".instalaciones-portada", ".instalaciones-controles", ".profile-header", ".profile-welcome",
            ".employee-panel", ".sports-panel", ".dashboard-card", ".profile-card",
            ".admin-court-card", ".admin-class-card", ".admin-day", ".admin-session",
            ".admin-slot", ".admin-schedule-row", ".trainer-class", ".trainer-agenda-day",
            ".trainer-schedule-row", ".instalacion-tarjeta", ".sports-preview", ".admin-court-preview",
            "#listaUsuarios > tr", "#tablaDeportesBody > tr",
            "#formSolicitarRecuperacion", "#formRestablecerPassword", "#recuperacionCompletada"
        ].join(",");
        const avisos = ".admin-notice,.trainer-notice,.sports-notice,.instalaciones-estado,.recuperacion-aviso";
        const preparadas = new WeakSet(), vistas = new WeakSet(), firmasAviso = new WeakMap();
        const activas = new Map(), pendientes = new Set();
        let frame = 0;

        function visible(elemento) {
            return elemento.isConnected && !elemento.closest("[hidden],dialog:not([open])")
                && elemento.getClientRects().length > 0;
        }

        function reproducir(elemento, frames, duracion, retraso = 0) {
            if (!puedeAnimar || preferencia.matches || !visible(elemento)
                || elemento.contains(document.activeElement)) return;
            activas.get(elemento)?.cancel();
            const animacion = elemento.animate(frames, {
                duration: duracion, delay: retraso, easing: "cubic-bezier(.2,.75,.25,1)", fill: "backwards"
            });
            activas.set(elemento, animacion);
            const limpiar = () => { if (activas.get(elemento) === animacion) activas.delete(elemento); };
            animacion.finished.then(limpiar, limpiar);
        }

        function entrar(elemento, orden) {
            if (vistas.has(elemento) || !visible(elemento)) return;
            vistas.add(elemento);
            const fila = elemento.tagName === "TR";
            reproducir(elemento, fila ? [{ opacity: 0 }, { opacity: 1 }]
                : [{ opacity: 0, transform: "translateY(16px)" }, { opacity: 1, transform: "translateY(0)" }],
                fila ? 320 : 480, Math.min(orden, 6) * 35);
        }

        const intersecciones = "IntersectionObserver" in window ? new IntersectionObserver(registros => {
            let orden = 0;
            registros.forEach(({ target, isIntersecting }) => {
                if (!isIntersecting || !visible(target)) return;
                entrar(target, orden++);
                intersecciones.unobserve(target);
            });
        }, { threshold: .08 }) : null;

        function preparar(elemento) {
            if (preparadas.has(elemento)) return;
            preparadas.add(elemento);
            if (intersecciones) intersecciones.observe(elemento);
            else if (visible(elemento)) entrar(elemento, 0);
        }

        function estadoCarga(elemento) {
            if (!elemento.matches("button," + avisos)) return;
            const texto = elemento.textContent.trim();
            const temporal = /\b(?:guardando|enviando|procesando|cargando|actualizando|comprobando|iniciando\s+sesión)\b/i.test(texto);
            const ocupado = elemento.getAttribute("aria-busy") === "true"
                || temporal && (elemento.tagName !== "BUTTON" || elemento.disabled);
            if (ocupado) elemento.setAttribute("data-ads-loading", "true");
            else elemento.removeAttribute("data-ads-loading");
        }

        function actualizarAviso(elemento) {
            estadoCarga(elemento);
            if (!visible(elemento)) { firmasAviso.delete(elemento); return; }
            const texto = elemento.textContent.trim();
            if (!texto || firmasAviso.get(elemento) === texto) return;
            firmasAviso.set(elemento, texto);
            reproducir(elemento, [{ opacity: 0, transform: "translateY(5px)" },
                { opacity: 1, transform: "translateY(0)" }], 240);
        }

        function examinar(raiz) {
            if (!(raiz instanceof Element) || !raiz.isConnected) return;
            if (raiz.matches(entradas)) preparar(raiz);
            raiz.querySelectorAll(entradas).forEach(preparar);
            if (raiz.matches(avisos)) actualizarAviso(raiz);
            raiz.querySelectorAll(avisos).forEach(actualizarAviso);
            if (raiz.matches("button")) estadoCarga(raiz);
            raiz.querySelectorAll("button").forEach(estadoCarga);
            if (!intersecciones) {
                if (raiz.matches(entradas) && visible(raiz)) entrar(raiz, 0);
                raiz.querySelectorAll(entradas).forEach(elemento => { if (visible(elemento)) entrar(elemento, 0); });
            }
        }

        function programar(raiz) {
            if (!(raiz instanceof Element)) return;
            pendientes.add(raiz);
            if (frame) return;
            frame = requestAnimationFrame(() => {
                frame = 0;
                pendientes.forEach(examinar);
                pendientes.clear();
            });
        }

        function retirar(raiz) {
            if (!(raiz instanceof Element) || raiz.isConnected) return;
            const limpiar = elemento => {
                intersecciones?.unobserve(elemento);
                activas.get(elemento)?.cancel();
                activas.delete(elemento);
            };
            limpiar(raiz);
            raiz.querySelectorAll(entradas + "," + avisos).forEach(limpiar);
        }

        // Solo atiende nuevas piezas y atributos de visibilidad/estado; ignora sus propios estilos y clases.
        const cambios = new MutationObserver(registros => {
            registros.forEach(registro => {
                if (registro.type === "attributes") { programar(registro.target); return; }
                registro.addedNodes.forEach(nodo => { if (nodo instanceof Element) programar(nodo); });
                registro.removedNodes.forEach(retirar);
                const contenedor = registro.target instanceof Element ? registro.target : registro.target.parentElement;
                const aviso = contenedor?.closest(avisos), boton = contenedor?.closest("button");
                if (aviso) programar(aviso);
                if (boton) programar(boton);
            });
        });

        examinar(body);
        cambios.observe(body, { subtree: true, childList: true, attributes: true,
            attributeFilter: ["hidden", "open", "disabled", "aria-busy"] });
        preferencia.addEventListener("change", () => {
            if (preferencia.matches) {
                activas.forEach(animacion => animacion.cancel());
                activas.clear();
            }
        });
        document.addEventListener("focusin", evento => {
            // Al entrar con teclado o empezar a escribir, el campo conserva su posición final.
            activas.forEach((animacion, elemento) => {
                if (elemento.contains(evento.target)) {
                    animacion.cancel();
                    activas.delete(elemento);
                }
            });
        });
        window.addEventListener("pagehide", () => {
            if (frame) cancelAnimationFrame(frame);
            frame = 0; pendientes.clear();
            activas.forEach(animacion => animacion.cancel()); activas.clear();
        });
        window.addEventListener("pageshow", evento => { if (evento.persisted) examinar(body); });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
    else iniciar();
})();
