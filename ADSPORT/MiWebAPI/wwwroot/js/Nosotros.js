/* ==========================================================
   ADSPORT - NOSOTROS.JS
   PREMIUM SPORTS EXPERIENCE

   Tecnologías:
   - JavaScript ES6+
   - GSAP
   - ScrollTrigger
   - Bootstrap 5

   Funcionalidades:
   01. Pantalla de carga
   02. Barra de progreso
   03. Cursor personalizado
   04. Títulos animados
   05. Animaciones de entrada
   06. Transiciones cinematográficas
   07. Objetos deportivos con parallax
   08. Efectos 3D
   09. Botones magnéticos
   10. Animaciones de comunidad
   11. Estilo de vida
   12. Navegación
   ========================================================== */

document.addEventListener("DOMContentLoaded", () => {

    "use strict";

    /* ======================================================
       01. CONFIGURACIÓN GENERAL
       ====================================================== */

    const CONFIG = {

        loader: {
            duration: 2200,
            transition: 900
        },

        cursor: {
            speed: 0.18
        },

        magnetic: {
            strength: 0.25
        },

        animation: {
            duration: 1.2,
            stagger: 0.08,
            ease: "power3.out"
        },

        parallax: {
            intensity: 0.3
        }

    };


    /* ======================================================
       02. DETECTAR DISPOSITIVO
       ====================================================== */

    const isMobile = window.matchMedia(
        "(max-width: 991px)"
    ).matches;

    const isTouch = window.matchMedia(
        "(hover: none), (pointer: coarse)"
    ).matches;

    const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    ).matches;

    const hasGSAP =
        typeof window.gsap !== "undefined";

    const hasScrollTrigger =
        typeof window.ScrollTrigger !== "undefined";


    if (hasGSAP && hasScrollTrigger) {

        gsap.registerPlugin(ScrollTrigger);

    }


    /* ======================================================
       03. FUNCIONES GENERALES
       ====================================================== */

    function clamp(value, min = 0, max = 1) {

        return Math.min(
            max,
            Math.max(min, value)
        );

    }


    function lerp(start, end, progress) {

        return start + (end - start) * progress;

    }


    function select(selector) {

        return document.querySelector(selector);

    }


    function selectAll(selector) {

        return [...document.querySelectorAll(selector)];

    }


    /* ======================================================
       04. PANTALLA DE CARGA
       ====================================================== */

    const loader = select("#pageLoader");

    const loaderPercentage = select("#loaderPercentage");

    let loaderFinished = false;


    function finishLoader() {

        if (loaderFinished) return;

        loaderFinished = true;

        if (loader) {

            loader.classList.add("is-hidden");

            setTimeout(() => {

                loader.remove();

            }, CONFIG.loader.transition);

        }

        document.body.style.overflow = "";

        startIntroAnimation();

    }


    function startLoader() {

        if (!loader) {

            startIntroAnimation();

            return;

        }

        document.body.style.overflow = "hidden";


        if (hasGSAP && !reduceMotion) {

            const counter = {
                value: 0
            };


            gsap.to(counter, {

                value: 100,

                duration: CONFIG.loader.duration / 1000,

                ease: "power2.inOut",

                onUpdate: () => {

                    if (loaderPercentage) {

                        loaderPercentage.textContent =
                            `${Math.round(counter.value)}%`;

                    }

                },

                onComplete: finishLoader

            });

        } else {

            if (loaderPercentage) {

                loaderPercentage.textContent = "100%";

            }

            setTimeout(
                finishLoader,
                reduceMotion ? 100 : CONFIG.loader.duration
            );

        }

    }


    /* ======================================================
       05. ANIMACIÓN INICIAL
       ====================================================== */

    let introStarted = false;


    function startIntroAnimation() {

        if (introStarted) return;

        introStarted = true;


        if (!hasGSAP || reduceMotion) return;


        const firstSection = select("#masQueUnClub");

        if (!firstSection) return;


        const titleLines = firstSection.querySelectorAll(
            ".title-line"
        );

        const subtitle = firstSection.querySelector(
            ".story-subtitle"
        );

        const button = firstSection.querySelector(
            ".story-button"
        );


        const timeline = gsap.timeline({

            defaults: {
                ease: "power3.out"
            }

        });


        if (titleLines.length) {

            timeline.from(titleLines, {

                y: 100,
                opacity: 0,
                rotateX: -25,

                duration: 1.1,

                stagger: 0.15

            });

        }


        if (subtitle) {

            timeline.from(subtitle, {

                y: 30,
                opacity: 0,

                duration: 0.7

            }, "-=0.5");

        }


        if (button) {

            timeline.from(button, {

                y: 30,
                opacity: 0,

                duration: 0.7

            }, "-=0.4");

        }

    }



    /* ======================================================
       06. BARRA DE PROGRESO
       ====================================================== */

    const progressBar = select("#pageProgressBar");


    function updateProgress() {

        if (!progressBar) return;

        const scrollTop =
            window.scrollY ||
            document.documentElement.scrollTop;


        const scrollHeight =
            document.documentElement.scrollHeight -
            window.innerHeight;


        const progress = scrollHeight > 0
            ? clamp(scrollTop / scrollHeight)
            : 0;


        progressBar.style.width =
            `${progress * 100}%`;

    }


    window.addEventListener(
        "scroll",
        updateProgress,
        { passive: true }
    );

    window.addEventListener(
        "resize",
        updateProgress
    );


    updateProgress();



    /* ======================================================
       07. CURSOR PERSONALIZADO
       ====================================================== */

    const customCursor = select("#customCursor");


    if (
        customCursor &&
        !isTouch &&
        !reduceMotion
    ) {

        let mouseX = -100;
        let mouseY = -100;

        let cursorX = -100;
        let cursorY = -100;

        let cursorVisible = false;


        document.addEventListener("mousemove", event => {

            mouseX = event.clientX;
            mouseY = event.clientY;


            if (!cursorVisible) {

                customCursor.classList.add("is-visible");

                cursorVisible = true;

            }

        });


        document.addEventListener("mouseleave", () => {

            customCursor.classList.remove("is-visible");

            cursorVisible = false;

        });


        function animateCursor() {

            cursorX = lerp(
                cursorX,
                mouseX,
                CONFIG.cursor.speed
            );

            cursorY = lerp(
                cursorY,
                mouseY,
                CONFIG.cursor.speed
            );


            const width = customCursor.offsetWidth;
            const height = customCursor.offsetHeight;


            customCursor.style.transform =

                `translate3d(
                    ${cursorX - width / 2}px,
                    ${cursorY - height / 2}px,
                    0
                )`;


            requestAnimationFrame(animateCursor);

        }


        requestAnimationFrame(animateCursor);


        selectAll(
            "a, button, .value-card, .stat-item"
        ).forEach(element => {

            element.addEventListener("mouseenter", () => {

                customCursor.classList.add("is-hovering");

            });


            element.addEventListener("mouseleave", () => {

                customCursor.classList.remove("is-hovering");

            });

        });

    }



    /* ======================================================
       08. TÍTULOS ANIMADOS
       ====================================================== */

    function animateTitles() {

        if (!hasGSAP || !hasScrollTrigger || reduceMotion) {
            return;
        }


        const titles = selectAll(".split-title");


        titles.forEach(title => {

            /*
               El primer título tiene su propia
               animación de bienvenida.
            */

            if (title.closest("#masQueUnClub")) {
                return;
            }


            const lines = title.querySelectorAll(
                ".title-line"
            );


            if (!lines.length) return;


            gsap.from(lines, {

                scrollTrigger: {

                    trigger: title,

                    start: "top 85%",

                    toggleActions: "play none none reverse"

                },

                y: 100,

                opacity: 0,

                rotateX: -20,

                duration: 1.2,

                stagger: 0.15,

                ease: "power3.out"

            });

        });

    }



    /* ======================================================
       09. REVELADO DE ELEMENTOS
       ====================================================== */

    function animateReveals() {

        if (!hasGSAP || !hasScrollTrigger || reduceMotion) {
            return;
        }


        const elements = selectAll("[data-reveal]");


        elements.forEach((element, index) => {

            /*
               Evitamos animar dos veces
               los elementos de la primera sección.
            */

            if (element.closest("#masQueUnClub")) {
                return;
            }


            gsap.from(element, {

                scrollTrigger: {

                    trigger: element,

                    start: "top 90%",

                    toggleActions: "play none none reverse"

                },

                y: 55,

                opacity: 0,

                duration: CONFIG.animation.duration,

                delay: (index % 3) * 0.06,

                ease: CONFIG.animation.ease

            });

        });

    }



    /* ======================================================
       10. TRANSICIONES CINEMATOGRÁFICAS
       ====================================================== */

    function animateSections() {

        if (!hasGSAP || !hasScrollTrigger || reduceMotion) {
            return;
        }


        const sections = selectAll(
            ".story-section, .community-section, .lifestyle-section"
        );


        sections.forEach(section => {

            const background = section.querySelector(
                ".story-background, .community-background, .lifestyle-background"
            );


            if (background) {

                gsap.fromTo(background,

                    {
                        scale: 1.15
                    },

                    {
                        scale: 1,

                        ease: "none",

                        scrollTrigger: {

                            trigger: section,

                            start: "top bottom",

                            end: "bottom top",

                            scrub: 1.5

                        }

                    }

                );

            }


            /*
               Movimiento del contenido
               durante la salida de la sección.
            */

            const content = section.querySelector(
                ".story-content, .community-content, .lifestyle-content"
            );


            if (content && !isMobile) {

                gsap.to(content, {

                    y: -60,

                    ease: "none",

                    scrollTrigger: {

                        trigger: section,

                        start: "center center",

                        end: "bottom top",

                        scrub: 1.2

                    }

                });

            }

        });

    }



    /* ======================================================
       11. PARALLAX DE OBJETOS DEPORTIVOS
       ====================================================== */

    function animateSportsObjects() {

        if (!hasGSAP || !hasScrollTrigger || reduceMotion) {
            return;
        }


        const objects = selectAll(".sports-object");


        objects.forEach(object => {

            const section = object.closest(
                ".story-section"
            );


            const intensity = parseFloat(
                object.dataset.parallax || "0.3"
            );


            const movement = isMobile
                ? 40
                : 180 * intensity + 60;


            gsap.fromTo(object,

                {
                    y: movement
                },

                {
                    y: -movement,

                    ease: "none",

                    scrollTrigger: {

                        trigger: section,

                        start: "top bottom",

                        end: "bottom top",

                        scrub: 1.5

                    }

                }

            );

        });

    }



    /* ======================================================
       12. GUANTES DE BOXEO
       ====================================================== */

    function animateBoxing() {

        if (!hasGSAP || !hasScrollTrigger || reduceMotion) {
            return;
        }


        const boxing = select(".boxing-image");

        if (!boxing) return;


        gsap.fromTo(boxing,

            {
                scale: 0.7,
                rotation: -20,
                opacity: 0
            },

            {
                scale: 1,
                rotation: 0,
                opacity: 1,

                duration: 1.6,

                ease: "power3.out",

                scrollTrigger: {

                    trigger: "#masQueUnClub",

                    start: "top 70%",

                    toggleActions: "play none none reverse"

                }

            }

        );


        const floatingTexts = selectAll(
            ".boxing-object .floating-text"
        );


        floatingTexts.forEach((text, index) => {

            gsap.from(text, {

                x: index % 2 === 0 ? 80 : -80,

                opacity: 0,

                duration: 1.2,

                delay: index * 0.2,

                ease: "power3.out",

                scrollTrigger: {

                    trigger: "#masQueUnClub",

                    start: "top 60%"

                }

            });

        });

    }



    /* ======================================================
       13. PELOTA DE TENIS
       ====================================================== */

    function animateTennis() {

        if (!hasGSAP || !hasScrollTrigger || reduceMotion) {
            return;
        }


        const tennis = select(".tennis-image");

        if (!tennis) return;


        gsap.fromTo(tennis,

            {
                scale: 0.6,
                rotation: -45,
                opacity: 0
            },

            {
                scale: 1.15,
                rotation: 35,
                opacity: 1,

                ease: "none",

                scrollTrigger: {

                    trigger: "#historia",

                    start: "top bottom",

                    end: "bottom top",

                    scrub: 1.5

                }

            }

        );

    }



    /* ======================================================
       14. BALÓN DE BALONCESTO
       ====================================================== */

    function animateBasketball() {

        if (!hasGSAP || !hasScrollTrigger || reduceMotion) {
            return;
        }


        const basketball = select(".basketball-image");

        if (!basketball) return;


        gsap.fromTo(basketball,

            {
                scale: 0.65,
                rotation: -35
            },

            {
                scale: 1.2,
                rotation: 45,

                ease: "none",

                scrollTrigger: {

                    trigger: "#misionVision",

                    start: "top bottom",

                    end: "bottom top",

                    scrub: 1.5

                }

            }

        );

    }



    /* ======================================================
       15. TARJETAS DE MISIÓN, VISIÓN Y VALORES
       ====================================================== */

    function animateValueCards() {

        if (!hasGSAP || !hasScrollTrigger || reduceMotion) {
            return;
        }


        const cards = selectAll(".value-card");


        if (!cards.length) return;


        gsap.from(cards, {

            scrollTrigger: {

                trigger: ".values-panel",

                start: "top 85%",

                toggleActions: "play none none reverse"

            },

            y: 100,

            opacity: 0,

            scale: 0.9,

            duration: 1,

            stagger: 0.18,

            ease: "power3.out"

        });

    }



    /* ======================================================
       16. COMUNIDAD
       ====================================================== */

    function animateCommunity() {

        if (!hasGSAP || !hasScrollTrigger || reduceMotion) {
            return;
        }


        const stats = selectAll(".stat-item");


        if (!stats.length) return;


        gsap.from(stats, {

            scrollTrigger: {

                trigger: ".community-stats",

                start: "top 85%",

                toggleActions: "play none none reverse"

            },

            x: 100,

            opacity: 0,

            duration: 1,

            stagger: 0.15,

            ease: "power3.out"

        });

    }



    /* ======================================================
       17. ESTILO DE VIDA
       ====================================================== */

    function animateLifestyle() {

        if (!hasGSAP || !hasScrollTrigger || reduceMotion) {
            return;
        }


        const words = selectAll(".lifestyle-word");


        words.forEach((word, index) => {

            const direction = index % 2 === 0
                ? -150
                : 150;


            gsap.fromTo(word,

                {
                    x: direction,
                    opacity: 0
                },

                {
                    x: 0,
                    opacity: 1,

                    ease: "none",

                    scrollTrigger: {

                        trigger: "#estiloVida",

                        start: "top 80%",

                        end: "center center",

                        scrub: 1.5

                    }

                }

            );

        });

    }



    /* ======================================================
       18. CIERRE CINEMATOGRÁFICO
       ====================================================== */

    function animateJoinSection() {

        if (!hasGSAP || !hasScrollTrigger || reduceMotion) {
            return;
        }


        const background = select(
            ".join-background-image"
        );


        if (background) {

            gsap.fromTo(background,

                {
                    scale: 1.3
                },

                {
                    scale: 1,

                    ease: "none",

                    scrollTrigger: {

                        trigger: "#unete",

                        start: "top bottom",

                        end: "bottom top",

                        scrub: 1.5

                    }

                }

            );

        }


        const joinButton = select(".join-button");


        if (joinButton) {

            gsap.from(joinButton, {

                scrollTrigger: {

                    trigger: joinButton,

                    start: "top 90%"

                },

                y: 50,

                opacity: 0,

                duration: 1,

                ease: "back.out(1.5)"

            });

        }

    }



    /* ======================================================
       19. BOTONES MAGNÉTICOS
       ====================================================== */

    function initializeMagneticButtons() {

        if (!hasGSAP || isTouch || reduceMotion) return;


        const buttons = selectAll("[data-magnetic]");


        buttons.forEach(button => {

            button.addEventListener("mousemove", event => {

                const rect = button.getBoundingClientRect();

                const centerX =
                    rect.left + rect.width / 2;

                const centerY =
                    rect.top + rect.height / 2;


                const deltaX =
                    event.clientX - centerX;

                const deltaY =
                    event.clientY - centerY;


                gsap.to(button, {

                    x: deltaX * CONFIG.magnetic.strength,

                    y: deltaY * CONFIG.magnetic.strength,

                    duration: 0.4,

                    ease: "power3.out",

                    overwrite: true

                });

            });


            button.addEventListener("mouseleave", () => {

                gsap.to(button, {

                    x: 0,
                    y: 0,

                    duration: 0.7,

                    ease: "elastic.out(1, 0.4)",

                    overwrite: true

                });

            });

        });

    }



    /* ======================================================
       20. EFECTO 3D CON EL RATÓN
       ====================================================== */

    function initialize3DEffect() {

        if (!hasGSAP || isTouch || reduceMotion) return;


        const objects = selectAll(".sports-object");


        objects.forEach(object => {

            const section = object.closest(
                ".story-section"
            );


            if (!section) return;


            section.addEventListener("mousemove", event => {

                const rect =
                    section.getBoundingClientRect();


                const mouseX =
                    (event.clientX - rect.left) /
                    rect.width;


                const mouseY =
                    (event.clientY - rect.top) /
                    rect.height;


                const rotateY =
                    (mouseX - 0.5) * 15;


                const rotateX =
                    (0.5 - mouseY) * 15;


                gsap.to(object, {

                    rotationY: rotateY,

                    rotationX: rotateX,

                    duration: 0.8,

                    ease: "power2.out",

                    overwrite: "auto"

                });

            });


            section.addEventListener("mouseleave", () => {

                gsap.to(object, {

                    rotationX: 0,

                    rotationY: 0,

                    duration: 1,

                    ease: "power3.out"

                });

            });

        });

    }



    /* ======================================================
       21. NAVEGACIÓN SUAVE
       ====================================================== */

    function initializeSmoothNavigation() {

        selectAll('a[href^="#"]').forEach(link => {

            link.addEventListener("click", event => {

                const href = link.getAttribute("href");

                if (!href || href === "#") return;


                const target = document.getElementById(
                    href.substring(1)
                );


                if (!target) return;


                event.preventDefault();


                target.scrollIntoView({

                    behavior: reduceMotion
                        ? "auto"
                        : "smooth",

                    block: "start"

                });

            });

        });

    }



    /* ======================================================
       22. AÑO AUTOMÁTICO
       ====================================================== */

    const currentYear = select("#currentYear");

    if (currentYear) {

        currentYear.textContent =
            new Date().getFullYear();

    }



    /* ======================================================
       23. INICIALIZACIÓN DE ANIMACIONES
       ====================================================== */

    function initializeAnimations() {

        if (!hasGSAP || !hasScrollTrigger) {

            console.warn(
                "ADSPORT: GSAP o ScrollTrigger no están disponibles."
            );

            return;

        }


        if (reduceMotion) {

            console.log(
                "ADSPORT: Animaciones reducidas por accesibilidad."
            );

            return;

        }


        animateTitles();

        animateReveals();

        animateSections();

        animateSportsObjects();

        animateBoxing();

        animateTennis();

        animateBasketball();

        animateValueCards();

        animateCommunity();

        animateLifestyle();

        animateJoinSection();

        initializeMagneticButtons();

        initialize3DEffect();


        ScrollTrigger.refresh();

    }



    /* ======================================================
       24. INICIALIZACIÓN GENERAL
       ====================================================== */

    initializeSmoothNavigation();

    initializeAnimations();

    startLoader();


    /*
       Actualizar ScrollTrigger cuando terminen
       de cargar las imágenes.
    */

    window.addEventListener("load", () => {

        if (hasScrollTrigger) {

            ScrollTrigger.refresh();

        }

    });



    /* ======================================================
       25. MENSAJE DE CONSOLA
       ====================================================== */

    console.log(
        "%c ADSPORT - NOSOTROS ",
        "background:#ff6a00;color:white;font-size:16px;font-weight:bold;padding:10px;"
    );

    console.log("Bootstrap 5: preparado");

    console.log("GSAP: " + (hasGSAP ? "ACTIVO" : "NO DISPONIBLE"));

    console.log(
        "ScrollTrigger: " +
        (hasScrollTrigger ? "ACTIVO" : "NO DISPONIBLE")
    );

    console.log("Experiencia deportiva inicializada.");

});