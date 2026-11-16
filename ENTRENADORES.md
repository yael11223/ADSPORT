# Módulo de entrenadores de ADSPORT

El módulo utiliza la API .NET 8 y la base SQL Server existentes. El registro de clientes y el formulario administrativo se conservan. El alta administrativa ahora permite asignar una contraseña inicial para que el empleado pueda entrar; se guarda únicamente el hash BCrypt.

## Instalación de la base de datos

**Estado local (13 de noviembre de 2026):** los tres scripts ya se aplicaron en la instancia ADSPORT configurada en este proyecto, incluyendo la firma de `USUARIO_AGREGA` y los parámetros de error de los diez procedimientos del módulo. Se verificó que los registros preexistentes de las diez tablas conservaran sus valores originales. Las instrucciones siguientes también sirven para instalar el módulo en otro entorno.

En SQL Server Management Studio, conectado a tu instancia habitual, abre y ejecuta **en este orden**:

1. `database/001_entrenadores_clases.sql`
2. `database/002_entrenadores_cuenta.sql`
3. `database/003_empleados_credenciales.sql`

Los scripts seleccionan `ADSPORT`. Se pueden volver a ejecutar: no eliminan usuarios, contraseñas, clases, reservas ni horarios. Las clases antiguas se conservan como no publicadas hasta que el entrenador revise sus datos. Los horarios modificados se conservan como historial inactivo.

No ejecutes de nuevo `BaceDeDatos.sql` sobre una base existente: es el esquema original, no una migración. Para una instalación nueva, instala primero ese esquema y después los tres scripts anteriores. Se requiere SQL Server 2016 SP1 o posterior y compatibilidad 130 o superior para `OPENJSON` y `CREATE OR ALTER`.

La migración agrega el rol `ENTRENADOR` si no existe y los deportes Tenis, Boxeo, Fútbol, Baloncesto y Natación que falten. Conserva los identificadores existentes. No crea usuarios ni contraseñas predefinidas.

## Iniciar y probar

Desde la raíz del repositorio:

```powershell
dotnet run --project ADSPORT/MiWebAPI/ADSPORT.csproj --launch-profile http
```

1. Abre `http://localhost:5299/login.html` e inicia sesión con las credenciales administrativas configuradas en `DemoLogin`. Si ya tenías una sesión del sistema anterior, vuelve a iniciar sesión para obtener la cookie del servidor.
2. En `empleados.html`, utiliza el **mismo formulario de alta**: completa datos, selecciona `ENTRENADOR`, estado `ACTIVO` y una contraseña inicial. Debe tener al menos ocho caracteres, mayúscula, minúscula, número y símbolo; máximo 72 bytes UTF-8.
3. Entrega las credenciales al entrenador. No hay registro público de entrenadores. Una cuenta existente necesita una contraseña BCrypt válida vinculada a su registro en `PASSWORD`; las migraciones no sobrescriben credenciales antiguas.
4. Abre `http://localhost:5299/loginEntrenador.html` en otro navegador o ventana privada. Ingresa el correo y contraseña del empleado. Un cliente o una cuenta inactiva no puede usar este acceso.
5. El entrenador entra a `perfilEntrenador.html`, donde ve sus datos reales, disciplinas derivadas de sus clases, agenda e inscripciones. La fotografía usa el avatar `/Accet/perfil.png` cuando no hay imagen.
6. Pulsa **Nueva clase**. Selecciona deporte, nombre, descripción, precio, capacidad, ubicación opcional y uno o varios horarios semanales (lunes=1, domingo=7). Publica la clase como disponible y guarda.
7. Comprueba que aparece en el panel. Edita su precio u horario y guarda de nuevo. Un horario que coincide con otra clase disponible del mismo entrenador se rechaza; se permite que una clase comience cuando otra termina.
8. Abre `http://localhost:5299/tenis.html`. El catálogo y el calendario se consultan en SQL Server. El selector permite otros deportes o todos; también puedes abrir `tenis.html?deporte=todos`.
9. Desactiva la clase desde el perfil. Continúa en el panel privado y desaparece del catálogo público. Volver a publicar comprueba horarios y capacidad de nuevo.
10. En **Cambiar contraseña**, proporciona la actual, la nueva y su confirmación. Cierra sesión y verifica que la anterior falla y la nueva funciona.

Los inicios de sesión comparten la cookie del mismo navegador. Usa ventanas privadas o navegadores distintos para probar administrador, cliente y dos entrenadores simultáneamente.

En `Development` se admite el perfil HTTP local. Fuera de ese ambiente las cookies requieren HTTPS. La autenticación administrativa ahora tiene también validación de servidor; su respuesta y la navegación existentes se conservan.

## Datos y procedimientos

No se agregan tablas. Se reutilizan `USUARIO`, `PASSWORD`, `ROL`, `CLASE`, `HORARIO`, `DEPORTE` y `RESERVA`.

| Tabla | Campos agregados |
| --- | --- |
| `CLASE` | `DESCRIPCION`, `DISPONIBLE`, `UBICACION` |
| `HORARIO` | `DIA_ISO`, `ACTIVO` |

También se agregan índices y restricciones para precio, capacidad y día semanal sin eliminar datos anteriores.

Procedimientos nuevos:

- `DEPORTE_LISTAR`
- `ENTRENADOR_CLASES_CONSULTAR`
- `ENTRENADOR_CLASE_GUARDAR`
- `ENTRENADOR_CLASE_DISPONIBILIDAD`
- `CLASE_FOTO_PUBLICA`
- `ENTRENADOR_CUENTA_OBTENER`
- `ENTRENADOR_FOTO_OBTENER`
- `ENTRENADOR_PASSWORD_OBTENER`
- `ENTRENADOR_PASSWORD_CAMBIAR`

Se actualiza `USUARIO_AGREGA` para guardar al empleado y su contraseña inicial dentro de una transacción. No se cambia el procedimiento de registro público de clientes.

Los nueve procedimientos nuevos y `USUARIO_AGREGA` devuelven errores mediante `@numeroError INT OUTPUT` y `@respuesta VARCHAR(1000) OUTPUT`. `0` indica éxito; un valor distinto indica un error con su mensaje. Las validaciones y operaciones están dentro de `TRY/CATCH`; el bloque `CATCH` captura `ERROR_NUMBER()` y `ERROR_MESSAGE()` y revierte las escrituras que fallen. La API lee los parámetros después de cerrar los lectores de SQL y muestra los errores de validación. Los detalles técnicos se registran en el servidor y la interfaz recibe un mensaje general.

Para inspeccionar una validación desde SQL Server, sin modificar clases:

```sql
DECLARE @numeroError INT, @respuesta VARCHAR(1000);
EXEC dbo.ENTRENADOR_CLASE_DISPONIBILIDAD
    @IdEntrenador = -1, @IdClase = -1, @Disponible = 0,
    @numeroError = @numeroError OUTPUT, @respuesta = @respuesta OUTPUT;
SELECT @numeroError AS numeroError, @respuesta AS respuesta;
```

Devuelve el error de acceso del entrenador y no modifica registros. Después de actualizar el código, reinicia la API para cargar la lectura de este contrato de errores.

Los alumnos se cuentan por usuario distinto dentro de cada clase, a partir de `RESERVA` con estado ACTIVA/ACTIVO, CONFIRMADA/CONFIRMADO, PAGADA/PAGADO o PENDIENTE. Las reservas canceladas se excluyen. El panel suma inscripciones por clase; un alumno inscrito en dos clases cuenta dos inscripciones. No se implementan reservas, pagos ni asistencia.

## API y permisos

| Método y ruta | Acceso |
| --- | --- |
| `GET /api/Entrenador/csrf` | Token CSRF para la sesión actual |
| `POST /api/Entrenador/login` | Correo y contraseña; exige rol y cuenta activa |
| `GET /api/Entrenador/perfil` y `/foto` | Entrenador autenticado |
| `PUT /api/Entrenador/password` | Solo la contraseña del usuario de la sesión |
| `POST /api/Entrenador/logout` | Cierra su sesión |
| `GET/POST /api/Entrenador/clases` | Consulta/creación de clases propias |
| `PUT /api/Entrenador/clases/{id}` | Modifica una clase propia |
| `PUT /api/Entrenador/clases/{id}/disponibilidad` | Publica/desactiva una clase propia |
| `GET /api/Clases?deporte=Tenis` | Catálogo público disponible; sin filtro consulta todos |
| `GET /api/Clases/deportes` | Catálogo de deportes |
| `GET /api/Clases/{id}/foto` | Foto del entrenador de una clase pública |

Las modificaciones reciben `X-CSRF-TOKEN`, obtenido mediante el endpoint CSRF después de iniciar sesión. El servidor obtiene el ID del entrenador de la cookie, vuelve a comprobar su rol/estado en SQL y verifica la propiedad de cada clase. No acepta un ID de entrenador del formulario. La API administrativa de usuarios y roles exige una sesión administrativa y CSRF para las modificaciones, evitando que un entrenador cambie su rol o datos personales mediante esas rutas.

## Archivos creados

Rutas relativas a `ADSPORT/MiWebAPI/`, excepto donde se indica:

- `Controllers/EntrenadorController.cs`, `Controllers/EntrenadorClasesController.cs`, `Controllers/ClasesController.cs`.
- `Data/EntrenadorCuentaData.cs`, `Data/ClaseData.cs`, `Data/SqlResultadoProcedimiento.cs`.
- `Models/EntrenadorCuenta.cs`, `Models/ClaseDeportiva.cs`, `Models/AltaEmpleadoRequest.cs`.
- `Security/EntrenadorAuthorizationHandler.cs`, `Security/PoliticaPassword.cs`.
- `wwwroot/loginEntrenador.html`.
- `wwwroot/css/loginEntrenador.css`, `wwwroot/css/entrenador.css`, `wwwroot/css/clases.css`.
- `wwwroot/js/loginEntrenador.js`, `wwwroot/js/entrenador.js`, `wwwroot/js/clases.js`.
- En la raíz: los tres scripts de `database/`, este documento, `tests/run-trainer-integration.ps1`, `tests/trainer_integration.py`, `tests/isolated-db-fixture.ps1`, `tests/stored-procedure-contract.ps1` y `tests/.gitignore`.

## Archivos modificados

- `Program.cs`: dependencias, políticas, CSRF y respuestas 401/403 de API.
- `Controllers/AuthController.cs`: cookie de servidor para el login administrativo existente, sesión, token y logout.
- `Controllers/UsuarioController.cs`, `Controllers/RolController.cs`: permisos administrativos y CSRF; contraseña inicial en el alta.
- `Controllers/LoginUsuarioController.cs`: CSRF en logout compartido.
- `Data/UsuarioData.cs`: pasa el hash inicial al procedimiento existente.
- `wwwroot/empleados.html`: campo de contraseña inicial dentro del formulario existente.
- `wwwroot/perfilEntrenador.html`: conecta la plantilla existente con datos reales, clases y cambio de contraseña.
- `wwwroot/tenis.html`: reemplaza ejemplos por catálogo y calendario reales, reutilizable con otros deportes.
- `wwwroot/componetes/heder.html`, `wwwroot/js/layout.js`: acceso de entrenadores, perfil según rol, avatar y logout con CSRF.
- `wwwroot/js/login.js`, `wwwroot/js/auth.js`, `wwwroot/js/app.js`, `wwwroot/js/empleados.js`: conserva el flujo administrativo y agrega cookie/CSRF, contraseña inicial y la ruta correcta al actualizar empleados.
- `README.md` de la raíz: enlace a esta guía.

## Verificación

Ejecuta desde la raíz (requiere Python, .NET y permisos para crear una base temporal en tu instancia SQL):

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests\run-trainer-integration.ps1
```

El ejecutor construye una base temporal con nombre `ADSPORT_CodexTest_<guid>`, instala el esquema y migraciones y prueba la API con datos desechables. Repite las migraciones antes y después de las operaciones para comprobar que se conservan los registros. Compila en `tests/artifacts/build/` sin reemplazar los archivos de una API que esté ejecutándose. Al terminar detiene su servidor y elimina exclusivamente la base que él mismo creó. No instala cambios en tu base ADSPORT ni usa sus usuarios para las pruebas. Los resultados quedan en `tests/artifacts/integration-report.json` y `tests/artifacts/sql-contract-report.json` (excluidos de Git).

También se verifican la compilación .NET, sintaxis JavaScript y referencias DOM/archivos locales. La revisión visual interactiva queda pendiente cuando no está disponible el navegador de pruebas.

Resultado de la ejecución del 13 de noviembre de 2026: **79 comprobaciones de API y 66 verificaciones SQL correctas**, migraciones repetidas conservando datos y compilación sin errores ni advertencias. Se comprobaron los parámetros OUTPUT de los diez procedimientos, errores de negocio y un fallo técnico provocado que devuelve su código y revierte las escrituras, sin exponer detalles técnicos al navegador. También se verificaron cierre de sesión de clientes, acceso revocado/inactivo y rechazo de publicación de un borrador con horario incompatible. La base temporal y su servidor se retiraron al terminar; durante esas pruebas ADSPORT se mantuvo sin modificaciones.

Las pruebas en una base temporal no instalan el módulo en tu base habitual. La instalación local posterior se indica al inicio de este documento.
