"""Cliente de CI. Los secretos viajan por stdin de SSH, no en comandos remotos."""
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile


def main():
    service = sys.argv[1]
    if service not in ('api', 'front'):
        raise ValueError('Servicio invalido')
    for name in ['SSH_HOST', 'SSH_USER', 'SSH_KNOWN_HOSTS', 'SSHPRIVATEKEY', 'DOCKERNAME', 'DOCKERPASSWORD', 'IMAGE']:
        if not os.environ.get(name, '').strip():
            raise ValueError('Falta configurar ' + name + ' en GitHub Actions')
    host, user = os.environ['SSH_HOST'], os.environ['SSH_USER']
    if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9.-]*', host):
        raise ValueError('SSH_HOST debe ser un hostname sin usuario, puerto ni https://')
    if not re.fullmatch(r'[a-z_][a-z0-9_-]*', user):
        raise ValueError('SSH_USER invalido')
    token_id, token_secret = os.environ.get('CF_ACCESS_CLIENT_ID', ''), os.environ.get('CF_ACCESS_CLIENT_SECRET', '')
    if bool(token_id) != bool(token_secret):
        raise ValueError('Cloudflare Access requiere Client ID y Client Secret juntos')
    ssh_env = dict(os.environ)
    if token_id:
        ssh_env.update(TUNNEL_SERVICE_TOKEN_ID=token_id, TUNNEL_SERVICE_TOKEN_SECRET=token_secret)
    with tempfile.TemporaryDirectory(prefix='serviciosocial-ssh-') as directory:
        folder = Path(directory)
        private_key = folder / 'key'
        private_key.write_text(os.environ['SSHPRIVATEKEY'].replace('\r', '').strip() + '\n')
        private_key.chmod(0o600)
        known_hosts = folder / 'known_hosts'
        known_hosts.write_text(os.environ['SSH_KNOWN_HOSTS'].strip() + '\n')
        subprocess.run(['ssh-keygen', '-F', host, '-f', str(known_hosts)], check=True, stdout=subprocess.DEVNULL)
        config = folder / 'config'
        config.write_text('\n'.join([
            'Host serviciosocial-homelab', '  HostName ' + host, '  User ' + user,
            '  IdentityFile ' + str(private_key), '  UserKnownHostsFile ' + str(known_hosts),
            '  IdentitiesOnly yes', '  BatchMode yes', '  StrictHostKeyChecking yes',
            '  ConnectTimeout 30', '  ServerAliveInterval 15', '  ServerAliveCountMax 4',
            '  ProxyCommand cloudflared access ssh --hostname %h', '',
        ]))
        payload = {'service': service, 'image': os.environ['IMAGE'],
                   'docker_user': os.environ['DOCKERNAME'], 'docker_token': os.environ['DOCKERPASSWORD']}
        subprocess.run(['ssh', '-F', str(config), 'serviciosocial-homelab',
                        'python3 /srv/serviciosocial/deploy/deploy.py'],
                       input=json.dumps(payload), text=True, env=ssh_env, check=True, timeout=1100)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('No se pudo desplegar:', str(error), file=sys.stderr)
        sys.exit(1)
