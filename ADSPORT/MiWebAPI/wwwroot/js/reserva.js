/* ==========================================================
   ADSPORT — LÓGICA INTERACTIVA DE RESERVA Y GENERADOR DE QR
   ========================================================== */

document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    // OBTENCIÓN DE PANELES Y BOTONES
    const pasoResumen = document.getElementById("paso-resumen");
    const pasoPago = document.getElementById("paso-pago");
    const pasoQr = document.getElementById("paso-qr");

    const btnIrPagar = document.getElementById("btn-ir-pagar");
    const btnAgregarMas = document.getElementById("btn-agregar-mas");
    const btnCancelarPago = document.getElementById("btn-cancelar-pago");
    const formPago = document.getElementById("form-pago");

    const resumenClase = document.getElementById("resumen-clase");
    const resumenHorario = document.getElementById("resumen-horario");
    const resumenSubtotal = document.getElementById("resumen-subtotal");
    const resumenTotal = document.getElementById("resumen-total");
    const pagoMonto = document.getElementById("pago-monto");

    // LECTURA DE DATOS ENVIADOS DESDE CLASES.HTML POR URL
    const urlParams = new URLSearchParams(window.location.search);
    const claseParam = urlParams.get("clase") || "BOX";
    const horarioParam = urlParams.get("horario") || "5:00 p.m. - 7:00 p.m.";
    const precioParam = urlParams.get("precio") || "$500.00";

    if (resumenClase) resumenClase.textContent = claseParam;
    if (resumenHorario) resumenHorario.textContent = horarioParam;
    if (resumenSubtotal) resumenSubtotal.textContent = precioParam;
    if (resumenTotal) resumenTotal.textContent = precioParam;
    if (pagoMonto) pagoMonto.textContent = precioParam;

    // TRANSICIÓN 1: IR AL PAGO
    btnIrPagar?.addEventListener("click", () => {
        pasoResumen.classList.add("d-none");
        pasoPago.classList.remove("d-none");
    });

    // REGRESAR A CLASES
    btnAgregarMas?.addEventListener("click", () => {
        window.location.href = "clases.html";
    });

    // CANCELAR PAGO
    btnCancelarPago?.addEventListener("click", () => {
        pasoPago.classList.add("d-none");
        pasoResumen.classList.remove("d-none");
    });

    // FORMATO DE NÚMERO DE TARJETA
    const inputTarjeta = document.getElementById("numTarjeta");
    inputTarjeta?.addEventListener("input", (e) => {
        let val = e.target.value.replace(/\D/g, "");
        e.target.value = val.replace(/(.{4})/g, "$1 ").trim().slice(0, 19);
    });

    // PROCESAR PAGO Y MOSTRAR QR GIGANTE
    formPago?.addEventListener("submit", (e) => {
        e.preventDefault();

        const btnPagar = document.getElementById("btn-procesar-pago");
        if (btnPagar) {
            btnPagar.disabled = true;
            btnPagar.querySelector("span").textContent = "PROCESANDO...";
        }

        setTimeout(() => {
            pasoPago.classList.add("d-none");
            pasoQr.classList.remove("d-none");

            // GENERACIÓN DE CÓDIGO QR GIGANTE EN CANVAS
            const wrapper = document.getElementById("qrcode-wrapper");
            if (wrapper) {
                wrapper.innerHTML = "";
                const idTicket = `ADSPORT-${Math.floor(100000 + Math.random() * 900000)}`;

                new QRCode(wrapper, {
                    text: `TICKET:${idTicket}|CLASE:${claseParam}|HORA:${horarioParam}`,
                    width: 240,
                    height: 240,
                    colorDark: "#080808",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H
                });
            }
        }, 1000);
    });
});