#!/usr/bin/env python3
"""Despliegue restringido: recibe JSON por SSH/stdin sin comandos de shell."""
import fcntl
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
import urllib.request

ROOT = Path('/srv/serviciosocial')
IMAGE_KEYS = {'api': 'BACKEND_IMAGE', 'front': 'FRONTEND_IMAGE'}


def run(args, **kwargs):
    return subprocess.run(args, cwd=ROOT, check=True, **kwargs)


def configuration():
    return dict(line.split('=', 1) for line in (ROOT / '.env').read_text().splitlines()
                if '=' in line and not line.startswith('#'))


def set_image(key, value):
    path = ROOT / '.env'
    lines = path.read_text().splitlines()
    found = any(line.startswith(key + '=') for line in lines)
    lines = [key + '=' + value if line.startswith(key + '=') else line for line in lines]
    if not found:
        lines.append(key + '=' + value)
    fd, name = tempfile.mkstemp(prefix='.env-deploy-', dir=ROOT)
    try:
        with os.fdopen(fd, 'w') as output:
            output.write('\n'.join(lines) + '\n')
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def probe(service):
    endpoint = '/api/salud' if service == 'api' else '/healthz'
    port = configuration().get('WEB_PORT', '8080')
    for attempt in range(6):
        try:
            with urllib.request.urlopen('http://127.0.0.1:' + port + endpoint, timeout=5) as response:
                if response.status == 200:
                    return
        except Exception:
            if attempt == 5:
                raise RuntimeError('Fallo la comprobacion HTTP del servicio') from None
        time.sleep(2)


def main():
    raw = sys.stdin.read(16385)
    if len(raw) > 16384:
        raise ValueError('Solicitud demasiado grande')
    payload = json.loads(raw)
    if not isinstance(payload, dict):
        raise ValueError('Se requiere un objeto JSON')
    os.umask(0o077)
    # Es comun a los dos repositorios, aunque sus jobs corran en paralelo.
    with (ROOT / '.deploy.lock').open('a') as lock:
        deadline = time.monotonic() + 180
        while True:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if time.monotonic() >= deadline:
                    raise RuntimeError('Hay otro despliegue activo; reintentar el job') from None
                time.sleep(2)
        if payload.get('action') == 'check':
            run(['docker', 'compose', 'config', '--quiet'], timeout=30)
            probe('api')
            probe('front')
            print('SSH de CI, Compose y servicios: correctos.')
            return
        service = payload.get('service')
        image = payload.get('image', '')
        username = payload.get('docker_user', '')
        token = payload.get('docker_token', '')
        if service not in IMAGE_KEYS:
            raise ValueError('Solo se permite desplegar api o front')
        if not isinstance(image, str) or not re.fullmatch(r'docker\.io/[a-z0-9][a-z0-9_-]*/servicio@sha256:[a-f0-9]{64}', image):
            raise ValueError('La imagen debe ser de Docker Hub y estar fijada por digest')
        if not isinstance(username, str) or not re.fullmatch(r'[a-z0-9][a-z0-9_-]*', username):
            raise ValueError('Usuario Docker Hub invalido')
        if not isinstance(token, str) or not token:
            raise ValueError('Falta el token de Docker Hub')
        if image.split('/')[1] != username:
            raise ValueError('La imagen no pertenece al usuario Docker Hub indicado')
        key = IMAGE_KEYS[service]
        previous = configuration()[key]
        with tempfile.TemporaryDirectory(prefix='serviciosocial-registry-') as registry:
            docker_env = dict(os.environ, DOCKER_CONFIG=registry)
            run(['docker', 'login', '--username', username, '--password-stdin'],
                input=token + '\n', text=True, env=docker_env, timeout=60)
            run(['docker', 'pull', image], env=docker_env, timeout=240)
        if service == 'api':
            backup_dir = ROOT / 'backups'
            backup_dir.mkdir(mode=0o700, exist_ok=True)
            timestamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
            config = configuration()
            with (backup_dir / ('pre-api-' + timestamp + '.dump')).open('wb') as backup:
                run(['docker', 'compose', 'exec', '-T', 'db', 'pg_dump',
                     '-U', config.get('DB_USER', 'Angel'), '-d', config.get('DB_NAME', 'ServicioSocial'), '-Fc'],
                    stdout=backup, timeout=120)
        set_image(key, image)
        up = ['docker', 'compose', 'up', '-d', '--no-deps', '--no-build', '--pull', 'never',
              '--wait', '--wait-timeout', '120', service]
        try:
            run(up, timeout=160)
            probe(service)
        except Exception:
            set_image(key, previous)
            print('Fallo el despliegue; restableciendo la imagen anterior.', file=sys.stderr)
            try:
                run(up, timeout=160)
            except Exception:
                print('No se pudo arrancar la imagen anterior; revisar Compose.', file=sys.stderr)
            raise RuntimeError('Despliegue fallido. Las migraciones SQL aplicadas no se revierten automaticamente.') from None
        (ROOT / ('.last-deploy-' + service + '.json')).write_text(json.dumps({
            'service': service, 'image': image, 'previous': previous,
            'at': datetime.now(timezone.utc).isoformat(),
        }, indent=2) + '\n')
        print('Despliegue saludable:', service, image)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('Error de despliegue:', str(error), file=sys.stderr)
        sys.exit(1)
