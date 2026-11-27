const SESSION_KEY = "empleados_usuario";
const formLogin = document.getElementById("formLogin");
const correo = document.getElementById("correo");
const password = document.getElementById("password");
const btnLogin = document.getElementById("btnLogin");
const mensajeLogin = document.getElementById("mensajeLogin");
const conexion = window.ADSPORTConexion;
const textoBoton = btnLogin.querySelector("span") || btnLogin;

conexion.solicitar("/api/Auth/sesion").then(sesion=>{
  if(sesion?.autenticado===true)window.location.replace("index.html");
  else sessionStorage.removeItem(SESSION_KEY);
}).catch(()=>sessionStorage.removeItem(SESSION_KEY));

formLogin.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  if (btnLogin.disabled || !formLogin.reportValidity()) return;
  btnLogin.disabled = true;
  btnLogin.setAttribute("aria-busy", "true");
  textoBoton.textContent = "Conectando…";
  conexion.mostrar(mensajeLogin, conexion.textos.conectando, true);
  try {
    const csrf = await conexion.solicitar("/api/Auth/csrf");
    if (!csrf.token) throw new Error(conexion.textos.conexion);
    const resultado = await conexion.solicitar("/api/Auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-TOKEN": csrf.token },
      body: JSON.stringify({ correo: correo.value.trim(), password: password.value })
    });
    if (resultado.isSuccess !== true) {
      throw new Error(conexion.textos.conexion);
    }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(resultado.usuario));
    window.location.replace("index.html");
  } catch (error) {
    conexion.mostrar(mensajeLogin, conexion.mensajeError(error));
  } finally {
    btnLogin.disabled = false;
    btnLogin.setAttribute("aria-busy", "false");
    textoBoton.textContent = "Ingresar";
  }
});
