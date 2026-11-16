"""Pruebas HTTP reales. Ejecutar mediante run-trainer-integration.ps1 (SQL aislado)."""
import copy
import base64
import http.client
import http.cookies
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
PORT = int(os.environ['ADSPORT_TEST_PORT'])
REPORT = ROOT / 'tests' / 'artifacts' / 'integration-report.json'
CHECKS = []


def check(name, condition):
    if not condition:
        raise AssertionError(name)
    CHECKS.append(name)
    print('PASS ' + name, flush=True)


def business_error(response, status, number):
    """El HTTP debe conservar el código OUTPUT SQL y el mensaje público de negocio."""
    code, body = response
    return (code == status and isinstance(body, dict) and body.get('isSuccess') is False
            and body.get('numeroError') == number and isinstance(body.get('respuesta'), str)
            and bool(body['respuesta'].strip()))


class Client:
    def __init__(self):
        self.cookies = {}
        self.token = None
        self.last_raw = b''
        self.last_headers = {}

    def call(self, method, path, data=None, csrf=True, raw_payload=None, content_type=None):
        conn = http.client.HTTPConnection('localhost', PORT, timeout=30)
        headers = {'Accept': 'application/json'}
        if self.cookies:
            headers['Cookie'] = '; '.join(k + '=' + v for k, v in self.cookies.items())
        if csrf and self.token:
            headers['X-CSRF-TOKEN'] = self.token
        payload = None
        if data is not None:
            headers['Content-Type'] = 'application/json'
            payload = json.dumps(data).encode()
        if raw_payload is not None:
            payload = raw_payload
            headers['Content-Type'] = content_type
        conn.request(method, path, payload, headers)
        response = conn.getresponse()
        raw = response.read()
        self.last_raw = raw
        self.last_headers = dict(response.getheaders())
        for key, value in response.getheaders():
            if key.lower() == 'set-cookie':
                parsed = http.cookies.SimpleCookie()
                parsed.load(value)
                for name, cookie in parsed.items():
                    self.cookies[name] = cookie.value
        status = response.status
        conn.close()
        try:
            body = json.loads(raw)
        except (json.JSONDecodeError, UnicodeDecodeError):
            body = None
        return status, body

    def upload(self, path, contents, filename='prueba.png', mime='image/png', csrf=True):
        boundary = 'ADSPORTIntegrationBoundary97bb'
        payload = (('--' + boundary + '\r\nContent-Disposition: form-data; name="archivo"; filename="'
                    + filename + '"\r\nContent-Type: ' + mime + '\r\n\r\n').encode()
                   + contents + ('\r\n--' + boundary + '--\r\n').encode())
        return self.call('POST', path, csrf=csrf, raw_payload=payload,
                         content_type='multipart/form-data; boundary=' + boundary)

    def refresh(self, admin=False):
        status, body = self.call('GET', '/api/Auth/csrf' if admin else '/api/Entrenador/csrf')
        if status != 200 or not body or not body.get('token'):
            raise AssertionError('No se pudo obtener token CSRF (HTTP %s).' % status)
        self.token = body['token']

    def trainer_login(self, email, password):
        self.refresh()
        status, body = self.call('POST', '/api/Entrenador/login', {'correo': email, 'password': password})
        if status == 200:
            self.refresh()
        return status, body


def fixture(operation, **values):
    args = ['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File',
            str(ROOT / 'tests' / 'isolated-db-fixture.ps1'), '-Operation', operation]
    for key, value in values.items():
        args.extend(['-' + key, str(value)])
    result = subprocess.run(args, capture_output=True, text=True, check=True)
    return int(result.stdout.strip())


def sports_flow(admin, trainer, client, anonymous):
    """La gestión recuperada debe utilizar permisos y datos del módulo actual."""
    status, catalog = anonymous.call('GET', '/api/Deporte')
    fields = {'idDeporte', 'nombreDeporte', 'descripcion', 'activo', 'imagenUrl', 'fechaUltimaModificacion'}
    check('Public sport catalog returns compatible metadata', status == 200 and catalog
          and all(fields <= set(s) and s['activo'] is True for s in catalog))
    check('Anonymous cannot request inactive sport administration', anonymous.call('GET', '/api/Deporte?incluirInactivos=true')[0] == 401)
    for label, actor in [('Trainer', trainer), ('Client', client)]:
        check(label + ' cannot request inactive sport administration', actor.call('GET', '/api/Deporte?incluirInactivos=true')[0] == 403)
        check(label + ' cannot create sports', actor.call('POST', '/api/Deporte', {'nombreDeporte': 'No autorizado', 'activo': True})[0] == 403)
    sport = {'nombreDeporte': 'Escalada de integración', 'descripcion': 'Disciplina de prueba con ' + 'detalle ' * 30, 'activo': True}
    check('Anonymous cannot create sports', anonymous.call('POST', '/api/Deporte', sport)[0] == 401)
    check('Sport creation requires CSRF', admin.call('POST', '/api/Deporte', sport, csrf=False)[0] == 400)
    status, result = admin.call('POST', '/api/Deporte', sport)
    check('Admin creates sport in SQL Server', status in (200, 201) and result.get('isSuccess') is True
          and result.get('numeroError') == 0 and result.get('idDeporte', 0) > 0)
    sport_id = result['idDeporte']
    url = '/api/Deporte/' + str(sport_id)
    image_url = url + '/imagen'
    check('Duplicate sport names return SQL business error', business_error(admin.call('POST', '/api/Deporte',
          dict(sport, nombreDeporte='  ' + sport['nombreDeporte'].upper() + '  ')), 409, 51009))
    check('Empty sport name rejected', admin.call('POST', '/api/Deporte', dict(sport, nombreDeporte=' '))[0] == 400)
    check('Sport description maximum enforced', admin.call('POST', '/api/Deporte', dict(sport, descripcion='x' * 2001))[0] == 400)
    check('Unknown sport id returns SQL business error', business_error(admin.call('PUT', '/api/Deporte/9223372036854775807', sport), 404, 51004))
    check('Sport modification requires CSRF', admin.call('PUT', url, sport, csrf=False)[0] == 400)
    check('Sport deactivation requires CSRF', admin.call('DELETE', url, csrf=False)[0] == 400)
    for label, actor in [('Trainer', trainer), ('Client', client)]:
        check(label + ' cannot edit or deactivate sports', actor.call('PUT', url, sport)[0] == 403
              and actor.call('DELETE', url)[0] == 403)

    png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6BsAAAAASUVORK5CYII=')
    check('Image upload requires CSRF', admin.upload(image_url, png, csrf=False)[0] == 400)
    check('Trainer cannot upload sport images', trainer.upload(image_url, png)[0] == 403)
    check('Client cannot upload sport images', client.upload(image_url, png)[0] == 403)
    check('Anonymous cannot upload sport images', anonymous.upload(image_url, png)[0] == 401)
    check('Image upload rejects empty files', admin.upload(image_url, b'')[0] == 400)
    check('Image upload validates binary signature', admin.upload(image_url, b'<html>not an image</html>')[0] in (400, 415))
    check('Image upload rejects unsupported GIF format', admin.upload(image_url, b'GIF89a' + b'\0' * 32, 'prueba.gif', 'image/gif')[0] in (400, 415))
    check('Image upload enforces 5 MB limit', admin.upload(image_url, png + b'\0' * (5 * 1024 * 1024 + 1))[0] in (400, 413))
    status, result = admin.upload(image_url, png)
    check('Admin stores validated image in SQL Server', status == 200 and result.get('isSuccess') is True and result.get('numeroError') == 0)
    check('Image response identifies the same sport', result.get('idDeporte') == sport_id and '/api/Deporte/' + str(sport_id) + '/imagen' in result.get('imagenUrl', ''))
    status, _ = anonymous.call('GET', image_url)
    check('Public image serves the stored bytes and MIME', status == 200 and anonymous.last_raw == png
          and anonymous.last_headers.get('Content-Type', '').startswith('image/png'))
    check('Public sport image disables MIME sniffing', anonymous.last_headers.get('X-Content-Type-Options', '').lower() == 'nosniff')

    class_data = {'idDeporte': sport_id, 'nombreClase': 'Clase de escalada de integración', 'descripcion': 'Prueba del catálogo integrado.',
                  'precio': 123.45, 'cupoMaximo': 4, 'disponible': True, 'ubicacion': 'Muro de prueba',
                  'horarios': [{'diaSemana': 2, 'horaInicio': '13:00', 'horaFin': '14:00'}]}
    status, created_class = trainer.call('POST', '/api/Entrenador/clases', class_data)
    check('Trainer publishes a class under newly administered sport', status == 200 and created_class.get('numeroError') == 0)
    class_id = created_class['idClase']
    sport['nombreDeporte'] = 'Escalada renombrada'
    sport['descripcion'] = 'Descripción larga conservada: ' + 'x' * 1000
    status, result = admin.call('PUT', url, sport)
    check('Admin renames sport without replacing its id', status == 200 and result.get('idDeporte') == sport_id)
    status, stored = anonymous.call('GET', url)
    check('Sport metadata and long description persist after edit', status == 200 and stored['idDeporte'] == sport_id
          and stored['nombreDeporte'] == sport['nombreDeporte'] and stored['descripcion'] == sport['descripcion'])
    anonymous.call('GET', image_url)
    check('Editing sport metadata preserves its stored image', anonymous.last_raw == png)
    status, by_id = anonymous.call('GET', '/api/Clases?idDeporte=' + str(sport_id))
    check('Class filtering by sport id survives sport rename', status == 200 and len(by_id) == 1
          and by_id[0]['idClase'] == class_id and by_id[0]['nombreDeporte'] == sport['nombreDeporte'])
    check('Invalid sport filter rejected', anonymous.call('GET', '/api/Clases?idDeporte=-1')[0] == 400)
    check('Admin soft-deactivates sport', admin.call('DELETE', url)[0] == 200)
    _, active = anonymous.call('GET', '/api/Deporte')
    check('Inactive sport disappears from public sports catalog', not any(s['idDeporte'] == sport_id for s in active))
    check('Inactive sport detail and image hidden publicly', anonymous.call('GET', url)[0] == 404
          and anonymous.call('GET', image_url)[0] == 404)
    status, all_sports = admin.call('GET', '/api/Deporte?incluirInactivos=true')
    check('Admin can still read deactivated sport history', status == 200
          and next(s for s in all_sports if s['idDeporte'] == sport_id)['activo'] is False)
    _, available = anonymous.call('GET', '/api/Clases/deportes')
    check('Inactive sport removed from trainer sport choices', not any(s['idDeporte'] == sport_id for s in available))
    _, public = anonymous.call('GET', '/api/Clases?idDeporte=' + str(sport_id))
    check('Deactivating sport hides its published classes', public == [])
    _, private = trainer.call('GET', '/api/Entrenador/clases')
    check('Sport deactivation preserves private class identity and history', any(c['idClase'] == class_id and c['disponible'] for c in private))
    inactive_class = copy.deepcopy(class_data)
    inactive_class['horarios'][0].update(horaInicio='15:00', horaFin='16:00')
    check('Cannot publish a new class under inactive sport', business_error(trainer.call('POST', '/api/Entrenador/clases', inactive_class), 400, 51000))
    check('Admin reactivates same sport id', admin.call('PUT', url, sport)[0] == 200)
    _, public = anonymous.call('GET', '/api/Clases?idDeporte=' + str(sport_id))
    check('Sport reactivation restores published class automatically', any(c['idClase'] == class_id for c in public))
    status, _ = anonymous.call('GET', image_url)
    check('Reactivation preserves existing image bytes', status == 200 and anonymous.last_raw == png)

    for path, marker in [('/deportes.html', 'formDeporte'), ('/js/deportes.js', '/api/Deporte'),
                         ('/css/deportes.css', ''), ('/indexUsuario.html', 'clasesContainer'),
                         ('/js/deportes-home.js', '/api/Deporte'), ('/tenis.html?idDeporte=' + str(sport_id), 'tenis-page'),
                         ('/loginEntrenador.html', 'formLoginEntrenador')]:
        status, _ = anonymous.call('GET', path)
        content = anonymous.last_raw.decode('utf-8-sig', errors='replace')
        check('Integrated static resource served: ' + path.split('?')[0], status == 200 and marker in content)


def main():
    if not os.environ.get('ADSPORT_TEST_DATABASE', '').startswith('ADSPORT_CodexTest_'):
        raise RuntimeError('Ejecuta el runner para crear una base de pruebas aislada.')
    anonymous = Client()
    for attempt in range(50):
        try:
            if anonymous.call('GET', '/api/LoginUsuario/sesion')[0] == 200:
                break
        except OSError:
            pass
        time.sleep(.3)
    else:
        raise RuntimeError('La API de pruebas no inició; revisa tests/artifacts/server.stderr.log.')

    config = json.loads((ROOT / 'ADSPORT' / 'MiWebAPI' / 'appsettings.json').read_text(encoding='utf-8-sig'))
    admin = Client()
    credentials = {'correo': config['DemoLogin']['Correo'], 'password': config['DemoLogin']['Password']}
    check('Admin login requires CSRF', admin.call('POST', '/api/Auth/login', credentials, csrf=False)[0] == 400)
    admin.refresh(admin=True)
    check('Existing administrator login', admin.call('POST', '/api/Auth/login', credentials)[0] == 200)
    admin.refresh(admin=True)
    check('Anonymous trainer access denied', anonymous.call('GET', '/api/Entrenador/perfil')[0] == 401)
    check('Anonymous employee administration denied', anonymous.call('GET', '/api/Usuario')[0] == 401)
    status, roles = admin.call('GET', '/api/Rol')
    assert status == 200
    role_ids = {r['nombreRol'].strip().upper(): r['idRol'] for r in roles}
    check('Trainer role available', 'ENTRENADOR' in role_ids and 'USUARIO' in role_ids)

    initial = 'EntrenaCodex2026!'
    emails = {'a': 'trainer-a@codex-test.invalid', 'b': 'trainer-b@codex-test.invalid',
              'client': 'client@codex-test.invalid', 'other': 'other-client@codex-test.invalid'}
    for key, email in emails.items():
        employee = {'idRol': role_ids['ENTRENADOR' if key in ('a', 'b') else 'USUARIO'],
                    'nombre': 'Prueba ' + key, 'apellidoPaterno': 'Integracion', 'apellidoMaterno': 'ADSPORT',
                    'correo': email, 'telefono': '5512345678', 'estatus': 'Activo', 'codigoQr': '',
                    'passwordInicial': initial}
        status, body = admin.call('POST', '/api/Usuario', employee)
        check('Existing admin creates credentials: ' + key, status == 200 and body['numeroError'] == 0)
    status, users = admin.call('GET', '/api/Usuario')
    assert status == 200
    user_map = {key: next(u for u in users if u['correo'] == email) for key, email in emails.items()}
    check('Only BCrypt hashes stored for initial credentials', fixture('credentials', UserId=user_map['a']['idUsuario']) == 1)
    check('No password/hash exposed by employee listing', not any('password' in k.lower() for u in users for k in u))

    client = Client()
    check('Client cannot use trainer login', business_error(client.trainer_login(emails['client'], initial), 403, 403))
    client.refresh()
    status, _ = client.call('POST', '/api/LoginUsuario/login', {'correo': emails['client'], 'password': initial})
    check('Existing client login preserved', status == 200)
    client.refresh()
    check('Client session cannot access trainer classes', client.call('GET', '/api/Entrenador/clases')[0] == 403)
    check('Client session cannot administer employees', client.call('GET', '/api/Usuario')[0] == 403)
    check('Existing client logout requires CSRF', client.call('POST', '/api/LoginUsuario/logout', csrf=False)[0] == 400)
    client.refresh()
    check('Existing client logout succeeds with fresh token', client.call('POST', '/api/LoginUsuario/logout')[0] == 200)
    _, logged_out_client = client.call('GET', '/api/LoginUsuario/sesion')
    check('Existing client session clears after logout', logged_out_client['autenticado'] is False)

    trainer = Client()
    check('Trainer login rejects incorrect password', business_error(trainer.trainer_login(emails['a'], 'Incorrecta2026!'), 401, 401))
    check('Trainer logs in with administrator credentials', trainer.trainer_login(emails['a'], initial)[0] == 200)
    status, profile = trainer.call('GET', '/api/Entrenador/perfil')
    check('Profile identifies current session', status == 200 and profile['idUsuario'] == user_map['a']['idUsuario']
          and profile['correo'] == emails['a'] and 'Integracion' in profile['nombreCompleto'])
    check('Profile provides existing fallback avatar', profile['tieneFoto'] is False and profile['fotoUrl'] == '/Accet/perfil.png')
    check('Trainer cannot change role through old endpoints', trainer.call('PUT', '/api/Usuario/' + str(profile['idUsuario']), user_map['a'])[0] == 403)
    check('Trainer cannot create roles', trainer.call('POST', '/api/Rol', {'nombreRol': 'ADMINISTRADOR'})[0] == 403)
    status, sports = anonymous.call('GET', '/api/Clases/deportes')
    assert status == 200
    tennis = next(s['idDeporte'] for s in sports if s['nombreDeporte'].strip().lower() == 'tenis')
    box = next(s['idDeporte'] for s in sports if s['nombreDeporte'].strip().lower() == 'boxeo')
    new_class = {'idDeporte': tennis, 'nombreClase': 'Tenis inicial de prueba', 'descripcion': 'Clase real creada por prueba de integración.',
                 'precio': 250.50, 'cupoMaximo': 12, 'disponible': True, 'ubicacion': 'Cancha uno',
                 'horarios': [{'diaSemana': 1, 'horaInicio': '09:00', 'horaFin': '10:00'},
                              {'diaSemana': 3, 'horaInicio': '09:00', 'horaFin': '10:00'}]}
    check('Class create requires CSRF', trainer.call('POST', '/api/Entrenador/clases', new_class, csrf=False)[0] == 400)
    status, result = trainer.call('POST', '/api/Entrenador/clases', new_class)
    check('Trainer creates class in SQL Server', status == 200 and result.get('isSuccess') is True and result.get('numeroError') == 0)
    class_id = result['idClase']
    class_url = '/api/Entrenador/clases/' + str(class_id)
    status, classes = trainer.call('GET', '/api/Entrenador/clases')
    check('Trainer panel reads saved class and both schedules', status == 200 and len(classes) == 1
          and classes[0]['idClase'] == class_id and len(classes[0]['horarios']) == 2)
    status, public = anonymous.call('GET', '/api/Clases?deporte=Tenis')
    check('Published class appears in public sport page API', status == 200 and any(c['idClase'] == class_id for c in public))
    check('Public response omits private account fields', not any('password' in k.lower() or k in ('correo', 'telefono') for c in public for k in c))
    status, other_sport = anonymous.call('GET', '/api/Clases?deporte=Boxeo')
    check('Sport catalog filtering', status == 200 and not any(c['idClase'] == class_id for c in other_sport))

    # Fuerza un error técnico durante el INSERT, exclusivamente en la base temporal.
    # Debe propagarse su número desde OUTPUT, con un mensaje genérico en HTTP.
    fixture('technical_error_on')
    try:
        technical = copy.deepcopy(new_class)
        technical['disponible'] = False
        technical_response = trainer.call('POST', '/api/Entrenador/clases', technical)
        check('SQL technical OUTPUT reaches HTTP as 503 and numeric error', business_error(technical_response, 503, 50000))
        check('SQL technical detail is not exposed to browser', 'Fallo tecnico privado' not in technical_response[1]['respuesta'])
        _, after_technical = trainer.call('GET', '/api/Entrenador/clases')
        check('Technical SQL error rolls back class and schedules', len(after_technical) == 1 and len(after_technical[0]['horarios']) == 2)
    finally:
        fixture('technical_error_off')

    for name, field, value in [('Negative price rejected', 'precio', -1), ('Zero capacity rejected', 'cupoMaximo', 0),
                                ('Unknown sport rejected', 'idDeporte', 999999), ('Empty description rejected', 'descripcion', ' '),
                                ('Price fractional cents rejected', 'precio', 1.999)]:
        invalid = copy.deepcopy(new_class)
        invalid[field] = value
        response = trainer.call('POST', '/api/Entrenador/clases', invalid)
        check(name, business_error(response, 400, 51000) if field == 'idDeporte' else response[0] == 400)
    for name, schedules in [('End before start rejected', [{'diaSemana': 1, 'horaInicio': '10:00', 'horaFin': '09:00'}]),
                            ('Invalid weekday rejected', [{'diaSemana': 0, 'horaInicio': '11:00', 'horaFin': '12:00'}]),
                            ('Self-overlap rejected', [{'diaSemana': 2, 'horaInicio': '10:00', 'horaFin': '12:00'},
                                                       {'diaSemana': 2, 'horaInicio': '11:00', 'horaFin': '13:00'}])]:
        invalid = copy.deepcopy(new_class)
        invalid['horarios'] = schedules
        check(name, trainer.call('POST', '/api/Entrenador/clases', invalid)[0] == 400)
    overlapping = copy.deepcopy(new_class)
    overlapping['nombreClase'] = 'Conflicto entre disciplinas'
    overlapping['idDeporte'] = box
    check('Trainer cannot overlap another available class', business_error(trainer.call('POST', '/api/Entrenador/clases', overlapping), 409, 51009))
    overlapping['disponible'] = False
    status, draft = trainer.call('POST', '/api/Entrenador/clases', overlapping)
    check('Trainer can save an unavailable draft with overlapping schedule', status == 200)
    check('Publication rechecks draft schedule conflicts', business_error(trainer.call('PUT', '/api/Entrenador/clases/' + str(draft['idClase']) + '/disponibilidad', {'disponible': True}), 409, 51009))

    trainer_b = Client()
    check('Second trainer login', trainer_b.trainer_login(emails['b'], initial)[0] == 200)
    check('Second trainer cannot edit another owner class', business_error(trainer_b.call('PUT', class_url, new_class), 404, 51004))
    check('Second trainer cannot deactivate another owner class', business_error(trainer_b.call('PUT', class_url + '/disponibilidad', {'disponible': False}), 404, 51004))
    status, b_classes = trainer_b.call('GET', '/api/Entrenador/clases')
    check('Second trainer listing isolated', status == 200 and b_classes == [])
    new_class.update(precio=300, nombreClase='Tenis actualizado', cupoMaximo=10)
    check('Owner edits class', trainer.call('PUT', class_url, new_class)[0] == 200)
    _, public = anonymous.call('GET', '/api/Clases?deporte=Tenis')
    check('Public catalog reflects updated price', next(c for c in public if c['idClase'] == class_id)['precio'] == 300)
    fixture('enroll', ClassId=class_id, UserId=user_map['client']['idUsuario'], OtherUserId=user_map['other']['idUsuario'])
    _, enrolled = trainer.call('GET', '/api/Entrenador/clases')
    enrolled_class = next(c for c in enrolled if c['idClase'] == class_id)
    check('Counts real distinct enrolled students', enrolled_class['alumnosInscritos'] == 2 and enrolled_class['cuposDisponibles'] == 8)
    too_small = copy.deepcopy(new_class)
    too_small['cupoMaximo'] = 1
    check('Capacity cannot drop below registered students', business_error(trainer.call('PUT', class_url, too_small), 409, 51009))
    check('Availability requires CSRF', trainer.call('PUT', class_url + '/disponibilidad', {'disponible': False}, csrf=False)[0] == 400)
    check('Owner deactivates class', trainer.call('PUT', class_url + '/disponibilidad', {'disponible': False})[0] == 200)
    _, public = anonymous.call('GET', '/api/Clases?deporte=Tenis')
    check('Inactive class removed from public catalog', not any(c['idClase'] == class_id for c in public))
    _, own = trainer.call('GET', '/api/Entrenador/clases')
    own_class = next(c for c in own if c['idClase'] == class_id)
    check('Deactivation preserves private class/history', own_class['disponible'] is False and own_class['alumnosInscritos'] == 2)
    check('Owner republishes saved class', trainer.call('PUT', class_url + '/disponibilidad', {'disponible': True})[0] == 200)

    check('Client can reopen existing session before sports permission checks', client.call('POST', '/api/LoginUsuario/login',
          {'correo': emails['client'], 'password': initial})[0] == 200)
    client.refresh()
    sports_flow(admin, trainer, client, anonymous)

    new_password = 'EntrenaNueva2026!'
    password_change = {'passwordActual': initial, 'passwordNueva': new_password, 'confirmarPassword': new_password}
    check('Password change requires CSRF', trainer.call('PUT', '/api/Entrenador/password', password_change, csrf=False)[0] == 400)
    wrong = dict(password_change, passwordActual='Incorrecta2026!')
    check('Wrong current password rejected', business_error(trainer.call('PUT', '/api/Entrenador/password', wrong), 400, 400))
    check('Password confirmation mismatch rejected', business_error(trainer.call('PUT', '/api/Entrenador/password', dict(password_change, confirmarPassword='Otra2026!')), 400, 400))
    check('Weak password rejected', business_error(trainer.call('PUT', '/api/Entrenador/password', dict(password_change, passwordNueva='corta', confirmarPassword='corta')), 400, 400))
    long_password = 'A1!' + '\u00f1' * 40
    check('BCrypt byte limit enforced', business_error(trainer.call('PUT', '/api/Entrenador/password', dict(password_change, passwordNueva=long_password, confirmarPassword=long_password)), 400, 400))
    password_change['idUsuario'] = user_map['b']['idUsuario']
    check('Trainer changes only own password', trainer.call('PUT', '/api/Entrenador/password', password_change)[0] == 200)
    fresh = Client()
    check('Old password no longer valid', fresh.trainer_login(emails['a'], initial)[0] == 401)
    check('New password logs in', fresh.trainer_login(emails['a'], new_password)[0] == 200)
    check('Other trainer password unchanged', Client().trainer_login(emails['b'], initial)[0] == 200)
    check('New password stored only as BCrypt', fixture('credentials', UserId=profile['idUsuario']) == 1)

    revoked_user = dict(user_map['a'], idRol=role_ids['USUARIO'])
    status, result = admin.call('PUT', '/api/Usuario/' + str(profile['idUsuario']), revoked_user)
    check('Admin revokes trainer role using existing employee edit', status == 200 and result['numeroError'] == 0)
    check('Existing trainer session loses private access after role revocation', fresh.call('GET', '/api/Entrenador/clases')[0] == 403)
    _, public = anonymous.call('GET', '/api/Clases?deporte=Tenis')
    check('Revoked trainer disappears from public catalog', not any(c['idClase'] == class_id for c in public))
    fresh.refresh()
    check('Revoked trainer can clear signed session with CSRF', fresh.call('POST', '/api/Entrenador/logout')[0] == 200)
    check('Revoked trainer cookie clears on logout', fresh.call('GET', '/api/Entrenador/perfil')[0] == 401)
    check('Admin restores trainer role for subsequent UI review', admin.call('PUT', '/api/Usuario/' + str(profile['idUsuario']), user_map['a'])[0] == 200)
    inactive_b = dict(user_map['b'], estatus='Inactivo')
    status, result = admin.call('PUT', '/api/Usuario/' + str(user_map['b']['idUsuario']), inactive_b)
    check('Admin deactivates trainer through existing employee edit', status == 200 and result['numeroError'] == 0)
    check('Inactive trainer cannot login', Client().trainer_login(emails['b'], initial)[0] == 401)
    check('Inactive trainer existing session denied', trainer_b.call('GET', '/api/Entrenador/perfil')[0] == 403)
    check('Trainer logout requires CSRF', trainer_b.call('POST', '/api/Entrenador/logout', csrf=False)[0] == 400)
    check('Trainer logout succeeds', trainer_b.call('POST', '/api/Entrenador/logout')[0] == 200)
    check('Logged out trainer session denied', trainer_b.call('GET', '/api/Entrenador/perfil')[0] == 401)

    # Renombrar una disciplina del seed detecta migraciones que intenten sembrarla otra vez.
    # El runner repetirá los cuatro scripts después y verificará todo DEPORTE, incluidas imágenes.
    status, seeded_tennis = admin.call('GET', '/api/Deporte/' + str(tennis))
    assert status == 200
    rename_seed = {'nombreDeporte': 'Tenis integrado', 'descripcion': seeded_tennis['descripcion'], 'activo': True}
    status, renamed = admin.call('PUT', '/api/Deporte/' + str(tennis), rename_seed)
    check('Admin renames seeded sport preserving original id', status == 200 and renamed.get('idDeporte') == tennis)
    status, by_id = anonymous.call('GET', '/api/Clases?idDeporte=' + str(tennis))
    check('Seeded sport id filter remains authoritative after rename', status == 200
          and any(c['idClase'] == class_id and c['nombreDeporte'] == 'Tenis integrado' for c in by_id))
    status, by_old_name = anonymous.call('GET', '/api/Clases?deporte=Tenis')
    check('Old sport name does not resolve after rename', status == 200 and by_old_name == [])
    status, by_new_name = anonymous.call('GET', '/api/Clases?deporte=' + quote('Tenis integrado'))
    check('Backward-compatible name filter resolves renamed sport', status == 200 and any(c['idClase'] == class_id for c in by_new_name))


if __name__ == '__main__':
    failure = None
    try:
        main()
    except Exception as exc:
        failure = type(exc).__name__ + ': ' + str(exc)
        print('FAIL ' + failure, file=sys.stderr, flush=True)
    finally:
        REPORT.parent.mkdir(exist_ok=True)
        REPORT.write_text(json.dumps({'passed': len(CHECKS), 'checks': CHECKS, 'failure': failure}, indent=2), encoding='utf-8')
    sys.exit(1 if failure else 0)
