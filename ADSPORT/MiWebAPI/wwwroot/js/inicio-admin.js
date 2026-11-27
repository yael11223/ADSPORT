document.addEventListener("DOMContentLoaded",async()=>{
    if (!await Admin.ready) return;
    try {
        const datos=await Admin.api("/api/Administracion/inicio",{cache:"no-store"});
        for (const [id,campo,texto] of [["cantidadUsuariosAdmin","usuarios","usuarios registrados"],["cantidadEntrenadoresAdmin","entrenadores","profesores registrados"],
            ["cantidadDeportesAdmin","deportes","deportes activos"],["cantidadCanchasAdmin","canchas","canchas activas"],["cantidadClasesAdmin","clases","clases publicadas"]]) {
            const elemento=document.getElementById(id); if(elemento)elemento.textContent=`${datos[campo]} ${texto}`;
        }
        document.getElementById("estadoBaseDatosAdmin").textContent="SQL SERVER · CONECTADO";
    } catch(error) {
        document.getElementById("estadoBaseDatosAdmin").textContent="CONSULTA NO DISPONIBLE";
        Admin.aviso("avisoSesion",error.message,true);
    }
});
