/* ==========================================================
   ADSPORT - HOME.JS
   EXPERIENCIA DEPORTIVA INTERACTIVA

   FUNCIONES:
   1. Pantalla de carga
   2. Carrusel automático
   3. Navegación entre secciones
   4. Vídeo cinematográfico con scroll
   5. Transiciones entre escenas
   6. Tarjetas deportivas superpuestas
   7. Animaciones al desplazarse
   8. Botones de reserva
   ========================================================== */

document.addEventListener("DOMContentLoaded", () => {

    "use strict";

    /* ======================================================
       1. CONFIGURACIÓN GENERAL
       ====================================================== */

    const CONFIG = {

        loader: {
            duracion: 2400,
            transicion: 850
        },

        carrusel: {
            intervalo: 5000
        },

        video: {
            suavizado: 0.15,
            tolerancia: 0.04
        },

        tarjetas: {
            escalaMinima: 0.92,
            separacion: 24,
            distanciaAnimacion: 150
        }

    };


    /* ======================================================
       2. FUNCIONES GENERALES
       ====================================================== */

    function limitar(valor, minimo = 0, maximo = 1) {

        return Math.min(
            maximo,
            Math.max(minimo, valor)
        );

    }


    function interpolar(inicio, final, progreso) {

        return inicio + (final - inicio) * progreso;

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


    /* ======================================================
       3. PANTALLA DE CARGA
       ====================================================== */

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

        window.addEventListener(
            "load",
            iniciarLoader,
            { once: true }
        );

        // Evita que una imagen externa bloquee la página.
        setTimeout(finalizarLoader, 5000);

    }



    /* ======================================================
       4. CARRUSEL DEPORTIVO
       ====================================================== */

    const slides = document.querySelectorAll(".hero-slide");

    const indicadoresCarrusel =
        document.querySelectorAll(".carousel-dot");

    const contadorCarrusel =
        document.getElementById("heroCounter");

    const heroCarousel =
        document.querySelector(".hero-carousel");

    let slideActual = 0;

    let intervaloCarrusel = null;


    function mostrarSlide(indice) {

        if (!slides.length) return;

        slideActual =
            (indice + slides.length) % slides.length;


        slides.forEach((slide, posicion) => {

            const activo = posicion === slideActual;

            slide.classList.toggle("active", activo);

            slide.setAttribute(
                "aria-hidden",
                String(!activo)
            );

        });


        indicadoresCarrusel.forEach((indicador, posicion) => {

            const activo = posicion === slideActual;

            indicador.classList.toggle(
                "selected",
                activo
            );

            indicador.setAttribute(
                "aria-pressed",
                String(activo)
            );

        });


        if (contadorCarrusel) {

            contadorCarrusel.textContent =
                `${formatoNumero(slideActual + 1)} / ${formatoNumero(slides.length)}`;

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

        heroCarousel.addEventListener(
            "mouseenter",
            detenerCarrusel
        );

        heroCarousel.addEventListener(
            "mouseleave",
            iniciarCarrusel
        );

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



    /* ======================================================
       5. BOTONES DE NAVEGACIÓN
       ====================================================== */

    const btnExplorar =
        document.getElementById("btnExplorar");

    const bienvenida =
        document.getElementById("bienvenida");

    const btnVerHorarios =
        document.getElementById("btnVerHorarios");

    const seccionClases =
        document.getElementById("clases");


    btnExplorar?.addEventListener("click", () => {

        desplazamientoSuave(bienvenida);

    });


    btnVerHorarios?.addEventListener("click", () => {

        desplazamientoSuave(seccionClases);

    });



    /* ======================================================
       6. VÍDEO CINEMATOGRÁFICO
       ====================================================== */

    const videoSection =
        document.querySelector(".video-scroll-section");

    const video =
        document.getElementById("videoExperiencia");

    const escenas =
        [...document.querySelectorAll(".video-scene")];

    const indicadoresEscenas =
        [...document.querySelectorAll(".scene-indicator")];

    const barraVideo =
        document.getElementById("videoProgressBar");

    const porcentajeVideo =
        document.getElementById("videoProgressPercent");

    const btnVideoAnterior =
        document.getElementById("videoAnterior");

    const btnVideoSiguiente =
        document.getElementById("videoSiguiente");


    let duracionVideo = 0;

    let videoListo = false;

    let progresoVideo = 0;

    let tiempoSuavizado = 0;

    let escenaActual = -1;

    let videoEnPantalla = false;


    /* ------------------------------------------------------
       6.1. PREPARAR VÍDEO
       ------------------------------------------------------ */

    if (video) {

        video.muted = true;

        video.pause();

        video.preload = "auto";


        video.addEventListener("loadedmetadata", () => {

            duracionVideo = video.duration;

            videoListo =
                Number.isFinite(duracionVideo) &&
                duracionVideo > 0;

            if (videoListo) {

                tiempoSuavizado = progresoVideo * duracionVideo;

                video.currentTime = tiempoSuavizado;

            }

        });


        video.addEventListener("error", () => {

            console.warn(
                "ADSPORT: No se pudo cargar el vídeo. " +
                "Verifica wwwroot/videos/experiencia-adsport.mp4"
            );

        });

    }



    /* ------------------------------------------------------
       6.2. CALCULAR PROGRESO DEL SCROLL
       ------------------------------------------------------ */

    function calcularProgresoVideo() {

        if (!videoSection) return 0;

        const rect =
            videoSection.getBoundingClientRect();

        const distanciaTotal =
            videoSection.offsetHeight - window.innerHeight;

        if (distanciaTotal <= 0) return 0;


        const progreso = -rect.top / distanciaTotal;

        return limitar(progreso);

    }



    /* ------------------------------------------------------
       6.3. CAMBIAR ESCENAS
       ------------------------------------------------------ */

    function cambiarEscena(indice) {

        if (!escenas.length) return;

        const indiceSeguro = limitar(
            indice,
            0,
            escenas.length - 1
        );

        if (escenaActual === indiceSeguro) return;

        escenaActual = indiceSeguro;


        escenas.forEach((escena, posicion) => {

            const activa = posicion === indiceSeguro;

            escena.classList.toggle("active", activa);

            escena.setAttribute(
                "aria-hidden",
                String(!activa)
            );

        });


        indicadoresEscenas.forEach((indicador, posicion) => {

            indicador.classList.toggle(
                "active",
                posicion === indiceSeguro
            );

        });

    }



    /* ------------------------------------------------------
       6.4. ACTUALIZAR INTERFAZ DEL VÍDEO
       ------------------------------------------------------ */

    function actualizarInterfazVideo(progreso) {

        const porcentaje = Math.round(progreso * 100);


        if (barraVideo) {

            barraVideo.style.width = `${porcentaje}%`;

        }


        if (porcentajeVideo) {

            porcentajeVideo.textContent = `${porcentaje}%`;

        }


        const indiceEscena = Math.min(

            escenas.length - 1,

            Math.floor(progreso * escenas.length)

        );


        cambiarEscena(indiceEscena);

    }



    /* ------------------------------------------------------
       6.5. CONTROLAR VÍDEO MEDIANTE SCROLL
       ------------------------------------------------------ */

    function actualizarVideo() {

        if (!videoSection) return;

        progresoVideo = calcularProgresoVideo();

        actualizarInterfazVideo(progresoVideo);


        if (!videoListo || !video) return;


        const tiempoDestino =
            progresoVideo * duracionVideo;


        /*
           Suavizamos el movimiento para evitar
           saltos bruscos entre fotogramas.
        */

        tiempoSuavizado = interpolar(

            tiempoSuavizado,

            tiempoDestino,

            CONFIG.video.suavizado

        );


        /*
           Evitamos solicitar cambios demasiado pequeños.
        */

        if (
            Math.abs(video.currentTime - tiempoSuavizado) >
            CONFIG.video.tolerancia
        ) {

            try {

                video.currentTime = limitar(
                    tiempoSuavizado,
                    0,
                    Math.max(0, duracionVideo - 0.01)
                );

            } catch (error) {

                console.warn(
                    "Error al sincronizar el vídeo:",
                    error
                );

            }

        }

    }



    /* ------------------------------------------------------
       6.6. NAVEGAR ENTRE ESCENAS
       ------------------------------------------------------ */

    function irAEscena(indice) {

        if (!videoSection || !escenas.length) return;

        const indiceSeguro = limitar(
            indice,
            0,
            escenas.length - 1
        );


        const distancia =
            videoSection.offsetHeight - window.innerHeight;


        const inicioSeccion =
            videoSection.getBoundingClientRect().top +
            window.scrollY;


        const progresoDestino =
            (indiceSeguro + 0.08) / escenas.length;


        window.scrollTo({

            top: inicioSeccion +
                distancia * progresoDestino,

            behavior: "smooth"

        });

    }


    btnVideoAnterior?.addEventListener("click", () => {

        irAEscena(escenaActual - 1);

    });


    btnVideoSiguiente?.addEventListener("click", () => {

        irAEscena(escenaActual + 1);

    });


    /* Los indicadores laterales también serán interactivos */

    indicadoresEscenas.forEach((indicador, indice) => {

        indicador.addEventListener("click", () => {

            irAEscena(indice);

        });

    });



    /* ======================================================
       7. TARJETAS SUPERPUESTAS
       ====================================================== */

    const tarjetas =
        [...document.querySelectorAll(".stack-card")];

    const contenedorTarjetas =
        document.querySelector(".clases-stack");


    /*
       Cada tarjeta se va reduciendo ligeramente
       cuando la siguiente se aproxima.

       Esto produce una sensación de profundidad
       durante el apilamiento.
    */

    function actualizarTarjetas() {

        if (!contenedorTarjetas || !tarjetas.length) return;


        const anchoPantalla = window.innerWidth;

        const esMovil = anchoPantalla <= 768;

        const separacion = esMovil ? 15 : 24;

        const posicionBase = esMovil ? 15 : 65;


        tarjetas.forEach((tarjeta, indice) => {

            const siguienteTarjeta = tarjetas[indice + 1];

            const posicionSticky =
                posicionBase + indice * separacion;


            /*
               La última tarjeta permanece
               con su tamaño original.
            */

            if (!siguienteTarjeta) {

                tarjeta.style.scale = "1";

                tarjeta.classList.remove("is-stacked");

                return;

            }


            const siguienteRect =
                siguienteTarjeta.getBoundingClientRect();


            /*
               Medimos la distancia de la siguiente tarjeta
               respecto a la posición sticky de la actual.
            */

            const distancia =
                siguienteRect.top - posicionSticky;


            const progreso = limitar(

                1 - (
                    distancia /
                    CONFIG.tarjetas.distanciaAnimacion
                )

            );


            /*
               Reducir ligeramente la tarjeta anterior
               conforme llega la siguiente.
            */

            const escala = interpolar(

                1,

                CONFIG.tarjetas.escalaMinima,

                progreso

            );


            tarjeta.style.scale = escala.toFixed(4);


            tarjeta.classList.toggle(
                "is-stacked",
                progreso > 0.15
            );

        });

    }



    /* ======================================================
       8. ANIMACIONES AL HACER SCROLL
       ====================================================== */

    const selectoresAnimados = [

        ".intro-content",

        ".reserva-info",

        ".reserva-visual",

        ".clases-header",

        ".instalaciones-header",

        ".instalacion-card"

    ];


    const elementosAnimados = [

        ...document.querySelectorAll(
            selectoresAnimados.join(",")
        )

    ];


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



    /* ======================================================
       9. SISTEMA CENTRAL DE ANIMACIONES
       ====================================================== */

    /*
       requestAnimationFrame permite actualizar
       el vídeo y las tarjetas sin ejecutar
       múltiples cálculos por cada evento scroll.
    */

    let actualizacionPendiente = false;


    function actualizarAnimaciones() {

        actualizacionPendiente = false;

        actualizarVideo();

        actualizarTarjetas();

    }


    function solicitarActualizacion() {

        if (actualizacionPendiente) return;

        actualizacionPendiente = true;

        requestAnimationFrame(actualizarAnimaciones);

    }


    window.addEventListener(

        "scroll",

        solicitarActualizacion,

        { passive: true }

    );


    window.addEventListener(

        "resize",

        solicitarActualizacion,

        { passive: true }

    );


    /*
       Mantener la sincronización del vídeo
       mientras se desplaza la página.
    */

    function cicloVideo() {

        if (videoSection) {

            const rect =
                videoSection.getBoundingClientRect();

            videoEnPantalla =
                rect.bottom > 0 &&
                rect.top < window.innerHeight;


            if (videoEnPantalla) {

                actualizarVideo();

            }

        }

        requestAnimationFrame(cicloVideo);

    }


    requestAnimationFrame(cicloVideo);



    /* ======================================================
       10. BOTONES DE RESERVA
       ====================================================== */

    const botonesReserva =
        document.querySelectorAll(".clase-button");


    botonesReserva.forEach(boton => {

        boton.addEventListener("click", () => {

            const deporte =
                boton.dataset.clase || "deporte";


            /*
               Posteriormente aquí conectaremos
               la API de reservas de ADSPORT.
            */

            alert(

                "ADSPORT\n\n" +

                `Has seleccionado: ${deporte.toUpperCase()}\n\n` +

                "Próximamente podrás reservar " +
                "tu clase desde esta sección."

            );

        });

    });



    /* ======================================================
       11. INICIALIZACIÓN
       ====================================================== */

    cambiarEscena(0);

    actualizarAnimaciones();


    console.log(
        "%c ADSPORT - EXPERIENCIA INICIADA ",
        "background:#ff6a00;color:white;font-weight:bold;padding:10px;"
    );

    console.log("Carrusel deportivo: ACTIVO");

    console.log("Vídeo interactivo: PREPARADO");

    console.log("Tarjetas superpuestas: ACTIVAS");

    console.log("Animaciones de scroll: ACTIVAS");

});