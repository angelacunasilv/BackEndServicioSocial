# GitHub Actions: backend y frontend en repositorios diferentes

Esta configuracion usa dos repositorios GitHub y un repositorio Docker Hub llamado `servicio`. El backend publica las etiquetas `back` y `back-<commit>`; el frontend publica `front` y `front-<commit>`. Cada workflow instala Node.js 24, ejecuta sus comprobaciones, construye la imagen y despliega solo su servicio. En pull requests se ejecutan comprobaciones y no se publican imagenes ni se entra al servidor.

## 1. Configuracion en los DOS repositorios

En GitHub abre cada repositorio por separado: **Settings → Secrets and variables → Actions**. Debes crear los mismos nombres y valores en ambos. Usa **Variables → New repository variable** para las variables y **Secrets → New repository secret** para las claves. No hacen falta GitHub Environments para estos workflows.

### Variables de repositorio

| Nombre | Valor que debes poner |
| --- | --- |
| `DOCKERNAME` | Tu nombre de usuario exacto en Docker Hub, en minusculas. Solo el usuario, sin URL ni `/servicio`. Por ejemplo `angelacunasilv` SOLO si ese es tambien tu usuario de Docker Hub. |
| `SSH_HOST` | `ssh.laquieromuchomirna.lol` |
| `SSH_USER` | `mirna` |
| `SSH_KNOWN_HOSTS` | El contenido completo de `.github/known_hosts.example`, una linea que comienza con `ssh.laquieromuchomirna.lol ssh-ed25519`. Es la clave publica del servidor, obtenida por la conexion SSH ya autenticada. |

### Secretos obligatorios

| Nombre | Valor que debes poner |
| --- | --- |
| `DOCKERPASSWORD` | Un Personal Access Token de Docker Hub con permisos **Read & Write**. El mismo token permite publicar imagenes y descargarlas en el servidor, aunque el repositorio sea privado. No es la clave de PostgreSQL ni la clave del administrador de la app. |
| `SSHPRIVATEKEY` | Todo el archivo privado `C:\Users\vasht\.ssh\serviciosocial-actions`, incluidos `-----BEGIN OPENSSH PRIVATE KEY-----`, sus lineas internas y `-----END OPENSSH PRIVATE KEY-----`. Usa ese archivo, NO el `.pub`. La llave ya esta autorizada en el homelab y no tiene contrasena interactiva. |

En Docker Hub crea el repositorio **`servicio`** dentro de la cuenta indicada en `DOCKERNAME`. Puedes dejarlo publico o privado. Para el token: configuracion de la cuenta → Personal access tokens → generar token Read & Write. Copialo como secreto en los dos repositorios GitHub; no lo subas al codigo.

### Secretos de Cloudflare Access, si proteges el hostname SSH

| Nombre | Valor |
| --- | --- |
| `CF_ACCESS_CLIENT_ID` | Client ID de un **Service Token de Cloudflare Access**. |
| `CF_ACCESS_CLIENT_SECRET` | Client Secret del MISMO Service Token. |

Si `ssh.laquieromuchomirna.lol` exige iniciar sesion con Cloudflare Access, necesitas los dos. En Cloudflare: **Zero Trust → Access controls → Service credentials → Service Tokens → Create Service Token**. Luego agrega a la aplicacion Access del hostname SSH una politica **Service Auth** que incluya ese Service Token. Estos secretos son opcionales si no hay una aplicacion Access exigiendo autenticacion adicional. El cliente valida que se configuren ambos juntos. No uses aqui el token del conector `cloudflared` ni la llave de Resend.

Referencia: https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/

## 2. Lo que queda en el servidor

`/srv/serviciosocial/.env` conserva PostgreSQL, `SESSION_SECRET`, `RESEND_API_KEY`, `MAIL_FROM` y `FRONTEND_URL`. Esas claves NO son necesarias en GitHub Actions. Las pruebas del backend usan PostgreSQL temporal y un servidor local que simula Resend, sin enviar correos reales.

El servidor ya tiene `/srv/serviciosocial/deploy/deploy.py`. La nueva llave SSH esta limitada a ese comando y no permite una terminal normal. El script acepta solo `api` o `front`, verifica el digest de la imagen, serializa los despliegues de ambos repositorios con un bloqueo y actualiza `BACKEND_IMAGE` o `FRONTEND_IMAGE` en `.env`. Las credenciales temporales del registro se eliminan al terminar la descarga.

Antes de actualizar `api` crea un respaldo en `/srv/serviciosocial/backups/`. Al iniciar el nuevo contenedor se aplican las migraciones pendientes y se comprueba su salud. Si falla, se intenta volver a la imagen anterior. Esto NO revierte migraciones SQL: las migraciones de una publicacion deben ser compatibles con la version previa. No se recrea PostgreSQL ni se borra su volumen.

La referencia de infraestructura esta en `deploy/homelab/`. El `compose.yaml` de esa carpeta esta pensado para copiarse a `/srv/serviciosocial/compose.yaml`, donde ya existen los directorios `BackEnd/` y `FrontEnd/`. Si actualizas el script del servidor, copialo por tu SSH personal; la llave restringida de CI no permite SCP.

## 3. Archivos que debes subir

En el repositorio backend incluye `.github/`, `Dockerfile`, `.dockerignore`,
`docker-entrypoint.sh`, `.gitattributes`, los archivos de npm, `tsconfig.json`,
`src/`, `tests/`, `migrations/`, `deploy/`, `compose.dev.yaml`, `README.md`,
`docs/` y este documento. En el frontend incluye su `.github/`, `Dockerfile`, `.dockerignore`, `nginx.conf`, archivos de npm y el codigo de Vue. La raiz de cada repositorio debe contener su propio `package.json` y `Dockerfile`.

El `.env` del backend se retiro del indice de Git y se conserva en Windows. Confirma la eliminacion versionada al hacer commit; `.gitignore` evita volver a agregarlo. Esto no borra versiones anteriores del historial: no reutilices credenciales que ya hayan quedado publicadas.

No hace falta `VITE_API_URL`: el frontend consulta `/api` en el mismo dominio y Nginx lo reenvia al backend. Los secretos antiguos `SERVER`, `SSH_HOST` y `SSH_USER` ya no se consultan como secretos: los dos ultimos ahora van en **Variables**.

## 4. Primer despliegue

Despues de configurar ambos repositorios y subir los archivos, un push a `main` ejecuta el workflow del repositorio que cambiaste. Tambien puedes iniciarlo desde **Actions → CI y despliegue → Run workflow**, seleccionando `main`. Primero comprueba el backend y luego el frontend. Si no pasa una comprobacion, no publica ni despliega esa version.

La instalacion se verifico desde Windows con la llave nueva y el comando de comprobacion del servidor. La ejecucion completa en GitHub requiere que configures estas variables y secretos y hagas el primer push. No se crearon secretos en tu cuenta de GitHub automaticamente.
