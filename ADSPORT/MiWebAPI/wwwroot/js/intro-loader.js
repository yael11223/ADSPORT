
const introLoader = document.getElementById("introLoader");

function ocultarCargador() {
    if (introLoader) {
        introLoader.classList.add("oculto");
    }
}

if (document.readyState === "complete") {
    setTimeout(ocultarCargador, 1400);
} else {
    window.addEventListener("load", () => {
        setTimeout(ocultarCargador, 1400);
    }, { once: true });
}
