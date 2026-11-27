document.addEventListener("DOMContentLoaded",async()=>{
    "use strict";
    const botones=[document.getElementById("btnEditarPerfil"),document.getElementById("btnEditarPerfilEntrenador")].filter(Boolean);
    if (!botones.length) return;
    const portada=document.querySelector(".profile-welcome");
    const avisoPagina=document.getElementById("perfilAviso") || document.getElementById("avisoEntrenador");
    let perfil,ocupado=false; const temporales=[];
    const dialog=document.createElement("dialog"); dialog.className="perfil-editor"; dialog.id="editorPerfil"; dialog.setAttribute("aria-labelledby","tituloEditorPerfil");
    dialog.innerHTML=`<div class="perfil-editor__cabecera"><h2 id="tituloEditorPerfil">EDITAR MI PERFIL</h2><button type="button" class="perfil-editor__cerrar" id="cerrarEditorPerfil" aria-label="Cerrar edición de perfil">×</button></div>
      <form id="formEditorPerfil"><div class="perfil-editor__campos">
      <div><label for="perfilNombre">Nombre</label><input id="perfilNombre" name="Nombre" type="text" maxlength="100" required></div>
      <div><label for="perfilPaterno">Apellido paterno</label><input id="perfilPaterno" name="ApellidoPaterno" type="text" maxlength="100"></div>
      <div><label for="perfilMaterno">Apellido materno</label><input id="perfilMaterno" name="ApellidoMaterno" type="text" maxlength="100"></div>
      <div><label for="perfilTelefono">Teléfono</label><input id="perfilTelefono" name="Telefono" type="tel" maxlength="100"></div></div>
      <div class="perfil-editor__imagenes"><div class="perfil-editor__imagen"><label for="perfilNuevaFoto">Foto de perfil</label><img id="vistaFotoPerfil" alt="Vista previa de tu foto"><input id="perfilNuevaFoto" name="Foto" type="file" accept="image/jpeg,image/png,image/webp"><label class="perfil-editor__quitar"><input name="QuitarFoto" id="quitarFotoPerfil" type="checkbox" value="true">Quitar foto actual</label></div>
      <div class="perfil-editor__imagen"><label for="perfilNuevoFondo">Fondo del perfil</label><img id="vistaFondoPerfil" alt="Vista previa del fondo"><input id="perfilNuevoFondo" name="Fondo" type="file" accept="image/jpeg,image/png,image/webp"><label class="perfil-editor__quitar"><input name="QuitarFondo" id="quitarFondoPerfil" type="checkbox" value="true">Quitar fondo actual</label></div></div>
      <small>JPG, PNG o WebP. Máximo 5 MB por imagen.</small><p id="avisoEditorPerfil" class="perfil-editor__aviso" role="status" aria-live="polite" hidden></p>
      <div class="perfil-editor__pie"><button type="button" id="cancelarEditorPerfil" class="btn-edit-profile">CANCELAR</button><button type="submit" id="guardarEditorPerfil" class="btn-edit-profile">GUARDAR CAMBIOS</button></div></form>`;
    document.body.append(dialog);
    const $=id=>document.getElementById(id),form=$("formEditorPerfil");
    function aviso(texto) { $("avisoEditorPerfil").hidden=!texto; $("avisoEditorPerfil").textContent=texto; }
    function aplicar(datos) {
        perfil=datos;
        portada.classList.toggle("perfil-portada-personalizada",datos.tieneFondo);
        portada.style.backgroundImage=datos.tieneFondo ? `linear-gradient(90deg,rgba(0,0,0,.85),rgba(0,0,0,.6)),url("${datos.fondoUrl}")` : "";
        window.dispatchEvent(new CustomEvent("adsport:perfil-actualizado",{detail:datos}));
    }
    function limpiarTemporales() { temporales.splice(0).forEach(url=>URL.revokeObjectURL(url)); }
    function abrir(tipo) {
        if (!perfil || ocupado) return;
        limpiarTemporales(); form.reset(); aviso("");
        $("perfilNombre").value=perfil.nombre; $("perfilPaterno").value=perfil.apellidoPaterno || "";
        $("perfilMaterno").value=perfil.apellidoMaterno || ""; $("perfilTelefono").value=perfil.telefono || "";
        $("vistaFotoPerfil").src=perfil.fotoUrl || "/Accet/perfil.png";
        $("vistaFondoPerfil").src=perfil.fondoUrl || "/Accet/Inicio.jpg";
        $("quitarFotoPerfil").disabled=!perfil.tieneFoto; $("quitarFondoPerfil").disabled=!perfil.tieneFondo;
        dialog.showModal();
        if (tipo==="foto") $("perfilNuevaFoto").click();
        if (tipo==="fondo") $("perfilNuevoFondo").click();
    }
    botones.forEach(b=>b.addEventListener("click",()=>abrir()));
    const foto=document.getElementById("btnCambiarFoto") || document.getElementById("btnCambiarFotoEntrenador");
    foto?.addEventListener("click",()=>abrir("foto"));
    document.getElementById("btnCambiarFondo")?.addEventListener("click",()=>abrir("fondo"));
    document.getElementById("btnCambiarFondoEntrenador")?.addEventListener("click",()=>abrir("fondo"));
    ["cerrarEditorPerfil","cancelarEditorPerfil"].forEach(id=>$(id).addEventListener("click",()=>{ if(!ocupado) dialog.close(); }));
    dialog.addEventListener("cancel",e=>{if(ocupado)e.preventDefault();}); dialog.addEventListener("close",limpiarTemporales);
    for (const [archivo,vista,quitar] of [["perfilNuevaFoto","vistaFotoPerfil","quitarFotoPerfil"],["perfilNuevoFondo","vistaFondoPerfil","quitarFondoPerfil"]]) {
        $(archivo).addEventListener("change",()=>{
            const f=$(archivo).files[0]; if(!f)return;
            if(f.size>5*1024*1024 || !["image/jpeg","image/png","image/webp"].includes(f.type)) { aviso("Selecciona una imagen JPG, PNG o WebP de hasta 5 MB."); $(archivo).value=""; return; }
            const url=URL.createObjectURL(f); temporales.push(url); $(vista).src=url; $(quitar).checked=false; aviso("");
        });
        $(quitar).addEventListener("change",()=>{if($(quitar).checked) $(archivo).value="";});
    }
    form.addEventListener("submit",async e=>{
        e.preventDefault(); if(ocupado || !form.reportValidity())return;
        const datos=new FormData(form); ocupado=true; aviso("Guardando tu perfil…"); form.setAttribute("aria-busy","true");
        form.querySelectorAll("button,input").forEach(n=>n.disabled=true);
        try {
            const csrf=await fetch("/api/Auth/csrf",{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error("No se pudo comprobar tu sesión.");return r.json();});
            const r=await fetch("/api/Perfil",{method:"PUT",body:datos,headers:{"X-CSRF-TOKEN":csrf.token},credentials:"same-origin"});
            const p=await r.json().catch(()=>({}));
            if(!r.ok)throw new Error(p.respuesta || Object.values(p.errors || {}).flat().join(" ") || "No fue posible guardar tu perfil.");
            aplicar(p); dialog.close();
            if(avisoPagina){avisoPagina.textContent="Tu perfil se guardó correctamente.";avisoPagina.hidden=false;}
        } catch(error){aviso(error.message);}
        finally {
            ocupado=false; form.setAttribute("aria-busy","false");
            form.querySelectorAll("button,input").forEach(n=>n.disabled=false);
            $("quitarFotoPerfil").disabled=!perfil.tieneFoto; $("quitarFondoPerfil").disabled=!perfil.tieneFondo;
        }
    });
    try {
        const r=await fetch("/api/Perfil",{cache:"no-store",credentials:"same-origin"});
        if(!r.ok)throw new Error("No fue posible cargar la edición de tu perfil.");
        aplicar(await r.json());
        [...botones,foto,document.getElementById("btnCambiarFondo"),document.getElementById("btnCambiarFondoEntrenador")].filter(Boolean).forEach(b=>{b.disabled=false;b.removeAttribute("title");});
    } catch(error){ if(avisoPagina){avisoPagina.textContent=error.message;avisoPagina.hidden=false;} }
});
