# Integración de las dos versiones de ADSPORT

Se incorporaron las funcionalidades aprovechables de `53bb2a6` a la base de `develop-Yael` (`c023025`), adaptándolas a sus permisos, API y procedimientos existentes. Los cambios están en el proyecto de trabajo; no se reemplazó la base de datos con el notebook de otra versión.

## Funcionalidades integradas

- Administración de deportes desde `deportes.html`, accesible desde el panel administrativo.
- Alta, edición, desactivación y reactivación de deportes con nombre y descripción.
- Carga de fotografías JPG, PNG o WEBP con vista previa. El servidor valida el contenido y un máximo de 5 MB.
- Menú de disciplinas y tarjetas del inicio obtenidos del catálogo real.
- Portada e información del deporte seleccionado usando su nombre, descripción e imagen.
- Navegación por `idDeporte`, que conserva la relación de las clases cuando cambia el nombre del deporte.

La gestión de entrenadores conserva su login independiente, perfil real, contraseña propia, horarios, cupos, edición y disponibilidad de clases. Las modificaciones administrativas y de entrenadores requieren permisos del servidor y CSRF. Todos los procedimientos nuevos mantienen `@numeroError` y `@respuesta`.

Las pantallas de reserva, pago y QR de la otra versión eran demostrativas; el catálogo integrado muestra información real de clases, horarios y cupos para consulta. No representa un cobro o una reserva como completados.

## Base de datos

Ejecutar en orden los scripts del proyecto para instalar o actualizar otro entorno:

1. `database/001_entrenadores_clases.sql`
2. `database/002_entrenadores_cuenta.sql`
3. `database/003_empleados_credenciales.sql`
4. `database/004_deportes_integrados.sql`

El script `001` también se actualiza para filtrar deportes activos y permitir consultar clases por ID del deporte. La instalación conserva los registros y los identificadores existentes. El catálogo inicial se registra una sola vez; repetir la instalación no vuelve a crear deportes que el administrador haya renombrado.

La integración agrega campos de disponibilidad e imagen a `DEPORTE` y amplía su descripción. La imagen se guarda en SQL Server, junto con su tipo, de forma atómica. No depende de nombres de archivos con IDs fijos de otra base de datos.

Desactivar un deporte conserva sus clases, horarios, alumnos e imagen. El deporte y sus clases desaparecen de las consultas públicas y no se pueden publicar nuevas clases disponibles en él. Al reactivarlo vuelven a mostrarse las clases que ya estaban disponibles. El entrenador conserva la consulta de su historial privado.

No ejecutes un export completo de tablas o una versión antigua de `USUARIO_AGREGA`: debe conservarse su parámetro `@password_hash`.

## Probar la integración

1. Reinicia la API desde Visual Studio o con `dotnet run --project ADSPORT/MiWebAPI/ADSPORT.csproj --launch-profile http`.
2. Entra en `http://localhost:5299/login.html` como administrador y abre **Deportes**.
3. Crea un deporte con descripción e imagen. Confirma que aparece en el inicio, el menú compartido y el selector del entrenador.
4. En otro navegador o ventana privada, inicia sesión en `loginEntrenador.html` y publica una clase del nuevo deporte.
5. Desde el inicio o el menú, abre el deporte y confirma los datos reales de la clase.
6. Renombra el deporte desde administración: sus enlaces por ID y las clases deben continuar funcionando.
7. Desactiva y reactiva el deporte. Comprueba el catálogo público y que el historial privado del entrenador permanece.

Las nuevas rutas de deportes son `GET /api/Deporte`, `GET /api/Deporte/{id}`, `POST /api/Deporte`, `PUT /api/Deporte/{id}`, `DELETE /api/Deporte/{id}` (desactivación) y `GET/POST /api/Deporte/{id}/imagen`. Solo el administrador puede consultar `?incluirInactivos=true` y modificar el catálogo. Los formularios envían el token con `X-CSRF-TOKEN`.

## Archivos principales

- Backend nuevo: `Controllers/DeporteController.cs`, `Data/DeporteData.cs`, `Models/Deporte.cs` dentro de `ADSPORT/MiWebAPI/`.
- Migraciones: `database/004_deportes_integrados.sql` y actualización de `001_entrenadores_clases.sql`.
- Administración nueva: `wwwroot/deportes.html`, `wwwroot/js/deportes.js`, `wwwroot/css/deportes.css`.
- Inicio dinámico: `wwwroot/js/deportes-home.js`, `wwwroot/css/deportes-home.css` y adaptación de `indexUsuario.html`/`js/Home.js`.
- Integración: ajustes en `Program.cs`, consultas/modelo/controlador público de clases, panel administrativo, `js/layout.js`, `js/clases.js`, `css/clases.css` y `js/entrenador.js`.
- Pruebas: ampliación de `tests/run-trainer-integration.ps1`, `tests/stored-procedure-contract.ps1` y `tests/trainer_integration.py`.

## Pruebas automatizadas

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests\run-trainer-integration.ps1
```

El ejecutor instala el esquema en una base temporal, comprueba procedimientos, permisos, imágenes, clases y migraciones, y elimina su servidor y base temporal al terminar. Compila en `tests/artifacts/build/` para conservar los archivos de una API que esté abierta. Los reportes quedan en `tests/artifacts/` y están excluidos de Git.

La verificación visual interactiva depende de la disponibilidad del navegador de pruebas.

Resultado del 16 de noviembre de 2026: 137 comprobaciones de API y 107 verificaciones SQL aprobadas, compilación sin errores ni advertencias y migraciones repetidas sin alterar datos. Se retiraron el servidor y la base temporal de pruebas. La actualización de los cuatro scripts se aplicó después en ADSPORT dentro de una transacción, verificando que los valores preexistentes de sus diez tablas se conservaran exactamente. La revisión visual interactiva queda pendiente porque el navegador de pruebas no está disponible.
