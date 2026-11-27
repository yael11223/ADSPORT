const SESSION_KEY = "empleados_usuario";
const formLogin = document.getElementById("formLogin");
const correo = document.getElementById("correo");
const password = document.getElementById("password");
const btnLogin = document.getElementById("btnLogin");
const mensajeLogin = document.getElementById("mensajeLogin");

fetch("/api/Auth/sesion",{cache:"no-store",credentials:"same-origin"}).then(r=>r.ok?r.json():null).then(sesion=>{
  if(sesion?.autenticado===true)window.location.replace("index.html");
  else sessionStorage.removeItem(SESSION_KEY);
}).catch(()=>sessionStorage.removeItem(SESSION_KEY));

formLogin.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  mensajeLogin.classList.add("d-none");
  btnLogin.disabled = true;
  btnLogin.textContent = "Ingresando...";
  try {
    const csrf = await fetch("/api/Auth/csrf", { cache: "no-store" }).then(r => r.json());
    const respuesta = await fetch("/api/Auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-TOKEN": csrf.token },
      body: JSON.stringify({ correo: correo.value.trim(), password: password.value })
    });
    const resultado = await respuesta.json();
    if (!respuesta.ok || !resultado.isSuccess) {
      throw new Error(resultado.respuesta || "No fue posible iniciar sesión.");
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(resultado.usuario));
    window.location.replace("index.html");
  } catch (error) {
    mensajeLogin.textContent = error.message || "Ocurrió un error al conectar con la API.";
    mensajeLogin.classList.remove("d-none");
  } finally {
    btnLogin.disabled = false;
    btnLogin.textContent = "Ingresar";
  }
});
