# ADSPORT: usuarios, profesores, canchas y cronograma

## Activar los cambios en tu base

1. En SQL Server Management Studio selecciona la misma base configurada en `MiWebAPI/appsettings.json`, en `ConnectionStrings:CadenaSQL`.
2. Ejecuta las migraciones **005**, **006**, **007**, **008** y **009**, completas y en ese orden, desde `database/`. Si ya aplicaste hasta 008, solo necesitas `database/009_recuperacion_password.sql` para habilitar la recuperación de contraseña. Instalar o repetir los scripts no elimina registros ni cambia contraseñas; esas acciones se realizan desde la aplicación.
3. Compila con .NET 8: `dotnet build MiWebAPI/ADSPORT.csproj`.
4. Inicia: `dotnet run --project MiWebAPI/ADSPORT.csproj`. Abre `/login.html` con las credenciales administrativas configuradas en `DemoLogin`.

Las pruebas usan una base LocalDB temporal. El script no se ha aplicado a la base configurada de tu aplicación.

## Recorrido de uso

- **Usuarios** (`/usuarios.html`): muestra todos los roles. Permite crear roles, registrar personas, editar sus datos, ver y descargar su QR, desactivarlas o eliminarlas definitivamente. En **Administrar roles** se pueden eliminar roles.
- **Profesores** (`/empleados.html`): muestra exclusivamente el rol `ENTRENADOR`. Permite registrar profesores y abrir el detalle de sus clases o su cronograma. Los demás roles se administran desde Usuarios.
- **Deportes** (`/deportes.html`): conserva la administración de disciplinas y permite eliminarlas definitivamente. La opción Desactivar sigue disponible.
- **Canchas** (`/canchas.html`): registra nombre, ubicación, deporte y apertura semanal. Permite editar, habilitar/deshabilitar y eliminar definitivamente la cancha. El panel inferior muestra franjas libres y clases que ocupan cada cancha.
- **Instalaciones** (`/instalaciones.html`): galería pública con fotografías, deporte, ubicación y apertura de las canchas habilitadas de deportes activos. Tiene filtro por deporte y permite ampliar las fotografías. Sus archivos propios son `instalaciones.html`, `css/instalaciones.css` y `js/instalaciones.js`; utiliza el encabezado y pie existentes.
- **Cronograma** (`/cronograma.html`): reúne las sesiones, con filtros combinables por profesor, cancha y deporte, e incluye opcionalmente clases no publicadas. Permite eliminar clases. **Todas las clases** incluye también las que no tienen horarios o cuyo profesor fue eliminado.
- **Entrenador** (`/perfilEntrenador.html`): al crear o editar una clase, elige deporte y cancha. El formulario ofrece las franjas libres de la cancha y del propio profesor. Los selectores ofrecen horas cada 15 minutos y conservan horarios existentes con otros minutos si siguen disponibles. Cada profesor puede eliminar sus propias clases.

Primero registra un deporte, después una cancha con apertura y finalmente asigna las clases desde el perfil del profesor.

## Añadir la fotografía de una instalación

En **Canchas**, crea una cancha o pulsa **Editar** en una existente. En **Fotografía de la instalación** selecciona una imagen JPG, PNG o WebP de hasta 5 MB y pulsa **Guardar cancha**. Antes de guardar se muestra una vista previa. Si no seleccionas un archivo se conserva la fotografía anterior.

La imagen se almacena en SQL Server y aparece en la pestaña pública **Instalaciones**. Si la cancha se guarda pero falla la carga de la imagen, utiliza **Reintentar imagen**; se conserva la misma cancha. Al deshabilitar la cancha o su deporte, sus datos y fotografía dejan de estar disponibles públicamente.

## Reglas de horarios

Los horarios se repiten semanalmente: lunes es 1 y domingo es 7. Cada sesión debe quedar dentro de una franja de apertura del mismo día, con hora final posterior a la inicial. Puedes configurar varios rangos por día, por ejemplo 08:00–12:00 y 14:00–20:00. Los días sin apertura están cerrados.

Las clases publicadas ocupan la cancha. Las no publicadas no reservan espacio; al publicarlas se comprueba nuevamente que siga libre. Se permiten sesiones consecutivas, como 09:00–10:00 y 10:00–11:00.

El servidor impide cruces de cancha y de profesor. Usa una transacción y el bloqueo SQL `ADSPORT_AGENDA` al guardar/publicar clases, editar canchas y desactivar profesores. Dos solicitudes simultáneas no pueden ocupar el mismo espacio. La disponibilidad puede actualizarse desde el formulario.

Una cancha con clases publicadas no puede cerrarse, cambiar de deporte ni recortar la apertura que necesitan esas clases. Primero hay que editar o desactivar las clases afectadas. Desactivar a un profesor despublica sus clases y conserva reservas e historial; reactivarlo no vuelve a publicarlas.

Las clases anteriores mantienen sus datos y pueden aparecer como **Sin cancha asignada**. El profesor debe editarlas para elegir cancha; la publicación exige una asignación válida.

## Eliminar de la base de datos

El botón **Eliminar** solicita confirmación y borra físicamente el registro de SQL Server. Está disponible en **Deportes**, **Canchas**, **Usuarios** y **Profesores**, incluso para registros inactivos. Los roles se eliminan desde **Usuarios → Administrar roles**. Las clases se eliminan desde **Cronograma**, el detalle de clases de cada profesor y el propio perfil del entrenador; el entrenador solo puede borrar las suyas.

- Al eliminar una cancha se borran su fotografía y sus horarios de apertura. Los horarios de clase se desvinculan de ella y las clases que todavía la utilizaban se despublican para reasignarlas. Las clases que ya se habían trasladado a otra cancha siguen como estaban.
- Al eliminar un usuario o entrenador se borran su cuenta, sus credenciales y sus verificaciones de correo. Sus clases dejan de publicarse y quedan sin entrenador. Sus reservas y registros de acceso se conservan, desvinculados del usuario; los pagos permanecen asociados a las reservas.
- Al eliminar un deporte se borra también su fotografía. Sus canchas se conservan inactivas y sin deporte para poder asignarles otra disciplina; sus fotografías y horarios de apertura se mantienen. Las clases afectadas dejan de publicarse.
- Al eliminar una clase se borran todos sus horarios. Las reservas y registros de acceso se conservan sin la referencia a la clase; los pagos permanecen asociados a las reservas.
- Al eliminar un rol, las cuentas que lo utilizaban se conservan y pasan al rol básico `USUARIO`. Si eliminas `USUARIO`, pasan a `SIN ASIGNAR`. Se crea el rol de reemplazo si hace falta. Los profesores afectados pierden el acceso de entrenador y sus clases dejan de publicarse. El registro público sigue funcionando con el rol básico disponible.

La opción **Desactivar** de usuarios conserva la cuenta y su QR y permite reactivarla desde Editar. En Deportes también se puede desactivar y reactivar sin borrar. Cada eliminación se realiza en una transacción protegida por el bloqueo de agenda. La galería pública Instalaciones refleja las canchas habilitadas; su administración se realiza desde Canchas.

## Identificación QR

Se utiliza [QRCoder](https://github.com/Shane32/QRCoder) 1.9.0 para producir PNG. SQL genera un identificador aleatorio único por persona, sin datos personales ni contraseñas dentro del QR. Se conserva al editar; la migración completa los QR vacíos y resuelve identificadores repetidos. El registro público con verificación de correo también genera QR.

## Recuperar la contraseña

Desde **LoginUsuario → ¿Olvidaste tu contraseña?** se abre `recuperarPassword.html`, con el mismo diseño del acceso. Introduce el correo de una cuenta activa, recibe el código de seis dígitos y escribe el código y la nueva contraseña dos veces. Después debes iniciar sesión con la nueva contraseña.

La migración **009** reutiliza `CODIGO_VERIFICACION` y añade la columna `PROPOSITO`, con valores `REGISTRO` y `RECUPERACION`. Los registros anteriores quedan como `REGISTRO`. Los procedimientos existentes de verificación y alta se actualizan para consultar solo ese propósito; un código de registro no autoriza un cambio de contraseña y un código de recuperación no autoriza un registro.

Los códigos de recuperación se guardan como HMAC, vinculados a `ID_USUARIO` y correo, y vencen en 10 minutos. Admiten cinco intentos incorrectos; reenviar requiere 60 segundos e invalida el código anterior. El cambio de contraseña y el consumo del código se realizan en la misma transacción. La contraseña se guarda con BCrypt, conservando los datos de la cuenta, el rol y el QR. Las sesiones anteriores quedan invalidadas y se envía una notificación del cambio sin incluir la contraseña.

Se reutilizan la configuración `Smtp` y `Verificacion:ClaveHmac` existentes; la clave debe ser Base64 de al menos 32 bytes. El servidor necesita acceso al SMTP configurado. No se guardan contraseñas ni códigos en el navegador. La solicitud devuelve la misma respuesta para cuentas existentes, inexistentes e inactivas. El envío se procesa en una cola de memoria; si la aplicación se reinicia con un envío pendiente, se puede volver a solicitar el código después de la espera. Un fallo SMTP invalida el código y queda registrado en el servidor.

La API limita por IP a 10 solicitudes de correo y 30 cambios por minuto; SQL aplica además la espera y los intentos por código. El alcance de estos límites en memoria corresponde a cada instancia de la aplicación, según la [documentación de ASP.NET Core](https://learn.microsoft.com/en-us/aspnet/core/performance/rate-limit?view=aspnetcore-8.0). El flujo sigue las medidas de recuperación de [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

Las pruebas utilizan un servidor SMTP de captura en `127.0.0.1`, sin enviar mensajes externos. La opción `Smtp:PermitirSinTlsLocal` solo permite esa conexión cuando el entorno es `Development` y el servidor es loopback. El envío habitual conserva TLS y autenticación.

## APIs incorporadas o ampliadas

| Método y ruta | Acceso y función |
| --- | --- |
| `GET /api/Usuario?rol=ENTRENADOR` | Administrador: profesores; sin filtro devuelve todos |
| `POST /api/Usuario` | Administrador: alta con rol, contraseña inicial y QR |
| `PUT /api/Usuario/{id}` | Administrador: edición conservando el QR |
| `DELETE /api/Usuario/{id}` | Administrador: borrado definitivo de la cuenta y sus credenciales |
| `POST /api/Usuario/{id}/desactivar` | Administrador: desactivación conservando la cuenta y su historial |
| `GET /api/Usuario/{id}/qr` | Administrador: PNG descargable |
| `GET /api/Usuario/{id}/clases` | Administrador: clases del profesor |
| `DELETE /api/Rol/{id}` | Administrador: borrado definitivo del rol, reasignando sus usuarios a un rol básico |
| `DELETE /api/Deporte/{id}` | Administrador: borrado definitivo del deporte, despublicando clases e inactivando sus canchas |
| `POST /api/Deporte/{id}/desactivar` | Administrador: desactivación conservando el deporte |
| `GET /api/Cancha` | Administrador o entrenador activo: canchas habilitadas |
| `GET /api/Cancha?incluirInactivas=true` | Administrador: todas las canchas |
| `POST /api/Cancha` | Administrador: alta con deporte y apertura |
| `PUT /api/Cancha/{id}` | Administrador: edición y habilitación |
| `DELETE /api/Cancha/{id}` | Administrador: borrado definitivo de cancha y fotografía, desvinculando sus clases |
| `POST /api/Cancha/{id}/imagen` | Administrador con CSRF: carga de fotografía mediante `multipart/form-data`, campo `archivo` |
| `GET /api/Cancha/{id}/imagen` | Público: imagen de una cancha habilitada; el administrador también puede ver imágenes de canchas inactivas |
| `GET /api/Instalaciones` | Público: instalaciones habilitadas, fotografías y apertura |
| `GET /api/Cancha/{id}/disponibilidad` | Administrador o entrenador activo: franjas libres y ocupadas |
| `GET /api/Administracion/cronograma` | Administrador: agenda general o filtrada |
| `GET /api/Administracion/clases` | Administrador: todas las clases, incluidas las que quedaron sin profesor u horarios |
| `DELETE /api/Administracion/clases/{id}` | Administrador: borrado definitivo de una clase y sus horarios |
| `DELETE /api/Entrenador/clases/{id}` | Entrenador activo: borrado definitivo de una clase propia y sus horarios |
| `POST /api/RecuperacionPassword/solicitar` | Público: recibe `{ correo }` y solicita un código sin revelar si la cuenta existe |
| `POST /api/RecuperacionPassword/restablecer` | Público: recibe `{ correo, codigo, nuevaPassword, confirmarPassword }`; exige código válido de recuperación |

La disponibilidad admite `diaSemana` y `excluirClase`. Un entrenador solo puede excluir una clase propia; sus otras clases también se descuentan. El cronograma admite `idEntrenador`, `idCancha`, `idDeporte` e `incluirNoDisponibles`.

Las escrituras administrativas y del entrenador requieren la cookie de sesión y `X-CSRF-TOKEN`. Las clases reciben ahora `idCancha` al guardarse.

## Pruebas reproducibles

Las pantallas de Inicio, Usuarios, Profesores, Deportes, Canchas, Cronograma, Instalaciones, perfil del entrenador y recuperación comparten `wwwroot/css/animaciones.css` y `wwwroot/js/animaciones.js`. Añaden entradas de contenido, respuesta a los controles y apertura de ventanas conservando el diseño. El contenido sigue visible si no carga el script de animaciones; se respeta la preferencia del dispositivo de reducir movimiento. Los botones de guardado indican `aria-busy` durante su solicitud, sin confundir los controles deshabilitados por falta de datos con una operación en curso.

`tests/fixtures/base_adjunta.sql` contiene el esquema original aportado, sin propiedades descriptivas. **Solo se usa en bases vacías de pruebas.** Para actualizar una base existente se usan las migraciones 005, 006, 007, 008 y 009, en ese orden.

En Windows, con SQL Server LocalDB, Microsoft Edge, Python 3.10 o superior y un controlador ODBC de SQL Server:

```powershell
python -m pip install --target .artifacts/python -r tests/requirements.txt
dotnet build MiWebAPI/ADSPORT.csproj -o .artifacts/build
python tests/integracion_club.py
```

El ejecutor crea `ADSPORT_CodexTest_<aleatorio>`, carga el esquema y las migraciones, inicia una copia local de la API con credenciales ficticias, recorre los formularios en Edge sin ventana y elimina la base temporal al terminar. Nunca toma la conexión SQL de `appsettings.json`.

Cubre altas, roles, edición, QR decodificable, permisos, CSRF, separación de profesores, apertura y disponibilidad, cruces, publicación, historial, solicitudes simultáneas, cronograma, catálogo público, registro público, borrado definitivo de deportes, canchas, usuarios, profesores, clases y roles, conservación de reservas y pagos, y repetición de las migraciones. La recuperación también comprueba el envío SMTP local, el formulario en escritorio y móvil, vencimiento, intentos, reenvío, aislamiento respecto al registro, cambios simultáneos, rechazo de la contraseña anterior, revocación de sesiones, notificación y límites de solicitudes. Los resultados, capturas y registro del servidor quedan en `.artifacts/`, excluido de Git.
