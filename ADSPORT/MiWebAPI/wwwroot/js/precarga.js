/* Calienta únicamente HTML, CSS y JS públicos; nunca respuestas de las APIs de cuentas. */
(() => {
    "use strict";
    const clave="adsport.precarga.publica";
    if (navigator.connection?.saveData || /(^|-)2g$/.test(navigator.connection?.effectiveType || "")) return;
    const cancelar=new AbortController();
    window.addEventListener("pagehide",()=>cancelar.abort(),{once:true});
    async function iniciar() {
        if (!navigator.onLine) return;
        try {
            const r=await fetch("/api/Aplicacion/precarga",{cache:"no-store",signal:cancelar.signal});
            if (!r.ok) return;
            const lista=await r.json();
            try { if (sessionStorage.getItem(clave)===lista.version) { document.documentElement.dataset.precarga="lista"; return; } } catch { }
            const pendientes=[...new Set([...lista.paginas,...lista.recursos])].filter(ruta=>{
                if (typeof ruta!=="string") return false;
                const url=new URL(ruta,location.origin);
                return url.origin===location.origin && !url.pathname.startsWith("/api/") && /\.(html|css|js)$/.test(url.pathname);
            });
            document.documentElement.dataset.precarga="en-curso";
            let completo=true;
            async function cargar() {
                while (pendientes.length && !cancelar.signal.aborted) {
                    const ruta=pendientes.shift();
                    try {
                        const respuesta=await fetch(ruta,{cache:"default",priority:"low",signal:cancelar.signal});
                        if (!respuesta.ok) completo=false;
                        await respuesta.arrayBuffer();
                    } catch { completo=false; }
                }
            }
            await Promise.all([cargar(),cargar()]);
            if (completo && !cancelar.signal.aborted) {
                try { sessionStorage.setItem(clave,lista.version); } catch { }
                document.documentElement.dataset.precarga="lista";
                window.dispatchEvent(new Event("adsport:precarga-lista"));
            }
        } catch { /* La precarga no impide abrir ni utilizar la página actual. */ }
    }
    function programar() { if ("requestIdleCallback" in window) requestIdleCallback(iniciar,{timeout:2500}); else setTimeout(iniciar,1000); }
    if (document.readyState==="complete") programar(); else window.addEventListener("load",programar,{once:true});
})();
