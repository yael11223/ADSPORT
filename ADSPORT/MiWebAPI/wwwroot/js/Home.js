/* ==========================================================
   ADSPORT - HOME.JS
   EXPERIENCIA DEPORTIVA INTERACTIVA (IMÁGENES AL SCROLL)
   ========================================================== */

document.addEventListener("DOMContentLoaded", () => {

    "use strict";

    const CONFIG = {
        loader: {
            duracion: 2400,
            transicion: 850
        },
        carrusel: {
            intervalo: 5000
        },
        tarjetas: {
            escalaMinima: 0.92,
            separacion: 24,
            distanciaAnimacion: 150
        }
    };

    function limitar(valor, minimo = 0, maximo = 1) {
        return Math.min(maximo, Math.max(minimo, valor));
    }

    function formatoNumero(numero) {
        return String(numero).padStart(2, "0");
    }

    function desplazamientoSuave(elemento) {
        if (!elemento) return;
        elemento.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    /* PANTALLA DE CARGA */
    const introLoader = document.getElementById("introLoader");
    let loaderFinalizado = false;

    if (introLoader) {
        document.body.style.overflow = "hidden";
    }

    function finalizarLoader() {
        if (!introLoader || loaderFinalizado) return;
        loaderFinalizado = true;
        introLoader.classList.add("oculto");
        document.body.style.overflow = "";

        setTimeout(() => {
            introLoader.remove();
        }, CONFIG.loader.transicion);
    }

    function iniciarLoader() {
        setTimeout(() => {
            finalizarLoader();
        }, CONFIG.loader.duracion);
    }

    if (document.readyState === "complete") {
        iniciarLoader();
    } else {
        window.addEventListener("load", iniciarLoader, { once: true });
        setTimeout(finalizarLoader, 5000);
    }

    /* CARRUSEL DEPORTIVO */
    const slides = document.querySelectorAll(".hero-slide");
    const indicadoresCarrusel = document.querySelectorAll(".carousel-dot");
    const contadorCarrusel = document.getElementById("heroCounter");
    const heroCarousel = document.querySelector(".hero-carousel");
    let slideActual = 0;
    let intervaloCarrusel = null;

    function mostrarSlide(indice) {
        if (!slides.length) return;
        slideActual = (indice + slides.length) % slides.length;

        slides.forEach((slide, posicion) => {
            const activo = posicion === slideActual;
            slide.classList.toggle("active", activo);
            slide.setAttribute("aria-hidden", String(!activo));
        });

        indicadoresCarrusel.forEach((indicador, posicion) => {
            const activo = posicion === slideActual;
            indicador.classList.toggle("selected", activo);
            indicador.setAttribute("aria-pressed", String(activo));
        });

        if (contadorCarrusel) {
            contadorCarrusel.textContent = `${formatoNumero(slideActual + 1)} / ${formatoNumero(slides.length)}`;
        }
    }

    function detenerCarrusel() {
        if (intervaloCarrusel !== null) {
            clearInterval(intervaloCarrusel);
            intervaloCarrusel = null;
        }
    }

    function iniciarCarrusel() {
        detenerCarrusel();
        if (slides.length <= 1 || document.hidden) return;

        intervaloCarrusel = setInterval(() => {
            mostrarSlide(slideActual + 1);
        }, CONFIG.carrusel.intervalo);
    }

    indicadoresCarrusel.forEach(indicador => {
        indicador.addEventListener("click", () => {
            const indice = Number(indicador.dataset.index);
            if (!Number.isInteger(indice)) return;
            mostrarSlide(indice);
            iniciarCarrusel();
        });
    });

    if (heroCarousel) {
        heroCarousel.addEventListener("mouseenter", detenerCarrusel);
        heroCarousel.addEventListener("mouseleave", iniciarCarrusel);
    }

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            detenerCarrusel();
        } else {
            iniciarCarrusel();
        }
    });

    mostrarSlide(0);
    iniciarCarrusel();

    /* NAVEGACIÓN */
    const btnExplorar = document.getElementById("btnExplorar");
    const bienvenida = document.getElementById("bienvenida");
    const btnVerHorarios = document.getElementById("btnVerHorarios");
    const seccionClases = document.getElementById("clases");

    btnExplorar?.addEventListener("click", () => {
        desplazamientoSuave(bienvenida);
    });

    btnVerHorarios?.addEventListener("click", () => {
        desplazamientoSuave(seccionClases);
    });

    /* SECUENCIA DE IMÁGENES AL SCROLL */
    const videoSection = document.querySelector(".video-scroll-section");
    const imagenesExperiencia = document.querySelectorAll(".exp-image");
    const escenas = document.querySelectorAll(".video-scene");
    const indicadoresEscenas = document.querySelectorAll(".scene-indicator");
    const barraProgreso = document.getElementById("videoProgressBar");
    const porcentajeProgreso = document.getElementById("videoProgressPercent");
    const btnAnterior = document.getElementById("videoAnterior");
    const btnSiguiente = document.getElementById("videoSiguiente");

    let escenaActual = -1;

    function calcularProgresoSeccion() {
        if (!videoSection) return 0;
        const rect = videoSection.getBoundingClientRect();
        const distanciaTotal = videoSection.offsetHeight - window.innerHeight;
        if (distanciaTotal <= 0) return 0;

        const progreso = -rect.top / distanciaTotal;
        return limitar(progreso);
    }

    function cambiarEscena(indice) {
        if (!escenas.length) return;
        const indiceSeguro = limitar(indice, 0, escenas.length - 1);

        escenaActual = indiceSeguro;

        // Cambiar imagen de fondo
        if (imagenesExperiencia.length) {
            imagenesExperiencia.forEach((img, posicion) => {
                const activa = posicion === indiceSeguro;
                img.classList.toggle("active", activa);
            });
        }

        // Cambiar texto de escena
        escenas.forEach((escena, posicion) => {
            const activa = posicion === indiceSeguro;
            escena.classList.toggle("active", activa);
            escena.setAttribute("aria-hidden", String(!activa));
        });

        // Cambiar puntos de navegacion
        indicadoresEscenas.forEach((indicador, posicion) => {
            indicador.classList.toggle("active", posicion === indiceSeguro);
        });
    }

    function actualizarExperiencia() {
        if (!videoSection) return;

        const progreso = calcularProgresoSeccion();
        const porcentaje = Math.round(progreso * 100);

        if (barraProgreso) {
            barraProgreso.style.width = `${porcentaje}%`;
        }

        if (porcentajeProgreso) {
            porcentajeProgreso.textContent = `${porcentaje}%`;
        }

        const totalEscenas = escenas.length || 4;
        const indiceEscena = Math.min(
            totalEscenas - 1,
            Math.floor(progreso * totalEscenas)
        );

        cambiarEscena(indiceEscena);
    }

    function irAEscena(indice) {
        if (!videoSection || !escenas.length) return;

        const indiceSeguro = limitar(indice, 0, escenas.length - 1);
        const distancia = videoSection.offsetHeight - window.innerHeight;
        const inicioSeccion = videoSection.getBoundingClientRect().top + window.scrollY;
        const progresoDestino = (indiceSeguro + 0.08) / escenas.length;

        window.scrollTo({
            top: inicioSeccion + distancia * progresoDestino,
            behavior: "smooth"
        });
    }

    btnAnterior?.addEventListener("click", () => {
        irAEscena(escenaActual - 1);
    });

    btnSiguiente?.addEventListener("click", () => {
        irAEscena(escenaActual + 1);
    });

    indicadoresEscenas.forEach((indicador, indice) => {
        indicador.addEventListener("click", () => {
            irAEscena(indice);
        });
    });

    /* TARJETAS SUPERPUESTAS */
    const tarjetas = [...document.querySelectorAll(".stack-card")];
    const contenedorTarjetas = document.querySelector(".clases-stack");

    function actualizarTarjetas() {
        if (!contenedorTarjetas || !tarjetas.length) return;

        const anchoPantalla = window.innerWidth;
        const esMovil = anchoPantalla <= 768;
        const separacion = esMovil ? 15 : 24;
        const posicionBase = esMovil ? 15 : 65;

        tarjetas.forEach((tarjeta, indice) => {
            const siguienteTarjeta = tarjetas[indice + 1];
            const posicionSticky = posicionBase + indice * separacion;

            if (!siguienteTarjeta) {
                tarjeta.style.scale = "1";
                tarjeta.classList.remove("is-stacked");
                return;
            }

            const siguienteRect = siguienteTarjeta.getBoundingClientRect();
            const distancia = siguienteRect.top - posicionSticky;

            const progreso = limitar(
                1 - (distancia / CONFIG.tarjetas.distanciaAnimacion)
            );

            const escala = 1 - (1 - CONFIG.tarjetas.escalaMinima) * progreso;
            tarjeta.style.scale = escala.toFixed(4);
            tarjeta.classList.toggle("is-stacked", progreso > 0.15);
        });
    }

    /* REVEAL ON SCROLL */
    const selectoresAnimados = [
        ".intro-content",
        ".reserva-info",
        ".reserva-visual",
        ".clases-header",
        ".instalaciones-header",
        ".instalacion-card"
    ];

    const elementosAnimados = [...document.querySelectorAll(selectoresAnimados.join(","))];

    elementosAnimados.forEach(elemento => {
        elemento.classList.add("reveal");
    });

    if ("IntersectionObserver" in window) {
        const observador = new IntersectionObserver(
            (entradas, observer) => {
                entradas.forEach(entrada => {
                    if (entrada.isIntersecting) {
                        entrada.target.classList.add("visible");
                        observer.unobserve(entrada.target);
                    }
                });
            },
            {
                threshold: 0.12,
                rootMargin: "0px 0px -40px 0px"
            }
        );

        elementosAnimados.forEach(elemento => {
            observador.observe(elemento);
        });
    } else {
        elementosAnimados.forEach(elemento => {
            elemento.classList.add("visible");
        });
    }

    /* LOOP CENTRAL SCROLL */
    let actualizacionPendiente = false;

    function actualizarAnimaciones() {
        actualizacionPendiente = false;
        actualizarExperiencia();
        actualizarTarjetas();
    }

    function solicitarActualizacion() {
        if (actualizacionPendiente) return;
        actualizacionPendiente = true;
        requestAnimationFrame(actualizarAnimaciones);
    }

    window.addEventListener("scroll", solicitarActualizacion, { passive: true });
    window.addEventListener("resize", solicitarActualizacion, { passive: true });

    /* RESERVAS */
    const botonesReserva = document.querySelectorAll(".clase-button");

    botonesReserva.forEach(boton => {
        boton.addEventListener("click", () => {
            const deporte = boton.dataset.clase || "deporte";
            alert(
                "ADSPORT\n\n" +
                `Has seleccionado: ${deporte.toUpperCase()}\n\n` +
                "Próximamente podrás reservar tu clase desde esta sección."
            );
        });
    });

    /* INICIALIZAR */
    cambiarEscena(0);
    actualizarAnimaciones();
});