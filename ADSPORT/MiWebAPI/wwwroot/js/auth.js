const SESSION_KEY = "empleados_usuario";

function obtenerUsuario() {
  const valor = sessionStorage.getItem(SESSION_KEY);
  try {
    return valor ? JSON.parse(valor) : null;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

async function protegerPagina() {
  if (!obtenerUsuario()) window.location.replace("login.html");
  try {
    const sesion = await fetch("/api/Auth/sesion", { cache: "no-store" }).then(r => r.json());
    if (!sesion.autenticado) {
      sessionStorage.removeItem(SESSION_KEY);
      window.location.replace("login.html");
    }
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.replace("login.html");
  }
}

function mostrarUsuario(elementId) {
  const usuario = obtenerUsuario();
  const elemento = document.getElementById(elementId);
  if (usuario && elemento) elemento.textContent = usuario.nombre;
}

async function solicitarAdmin(url, opciones = {}) {
  const headers = new Headers(opciones.headers);
  if (!["GET", "HEAD"].includes((opciones.method || "GET").toUpperCase())) {
    const respuestaCsrf = await fetch("/api/Auth/csrf", { cache: "no-store" });
    if (!respuestaCsrf.ok) throw new Error("No fue posible validar la sesión administrativa.");
    headers.set("X-CSRF-TOKEN", (await respuestaCsrf.json()).token);
  }
  return fetch(url, { ...opciones, headers, credentials: "same-origin" });
}

async function cerrarSesion() {
  try {
    const respuesta = await solicitarAdmin("/api/Auth/logout", { method: "POST" });
    if (!respuesta.ok && respuesta.status !== 401 && respuesta.status !== 403)
      throw new Error("No fue posible cerrar sesión.");
    sessionStorage.removeItem(SESSION_KEY);
    window.location.replace("login.html");
  } catch (error) {
    alert(error.message);
  }
}
