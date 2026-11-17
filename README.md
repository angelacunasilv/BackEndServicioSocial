# Backend de Servicio Social

**Actividad:** Proyecto final: Sistema de Servicio Social.

**Institución:** Tecnológico Nacional de México, Campus Culiacán.

**Integrantes:**

- Acuña Silva Angel Gabriel
- Bojórquez Chávez Yamil Santiago
- Osuna Perez Enrique
- Borboa Verdugo Jose Angel
- Urrea Cabanillas Hazael

## 1. Qué hace

Esta API administra el servicio social de los alumnos. Permite registrar
usuarios, acreditar la inducción, elegir programas, revisar documentos y
generar constancias. Los datos se guardan en PostgreSQL.

La interfaz se encuentra en un repositorio diferente:
[FrontendServicioSocial](https://github.com/angelacunasilv/FrontendServicioSocial).

La aplicación del homelab está en https://laquieromuchomirna.lol.

## 2. Tecnologías y organización

Se usa Node.js 24, Express, TypeScript, Sequelize, PostgreSQL 17 y Zod.
Resend envía los correos y Docker permite ejecutar los servicios.

El código sigue MVC. Los servicios separan las reglas del trámite.

| Carpeta | Responsabilidad |
| --- | --- |
| `src/models` | Modelos y relaciones de Sequelize. |
| `src/controllers` | Recibir solicitudes y coordinar respuestas. |
| `src/views` | Respuestas JSON y archivos PDF. |
| `src/services` | Reglas de negocio, contraseñas y correo. |
| `src/routes` | Rutas separadas en GET, POST, PUT y DELETE. |
| `src/validation` | Validaciones con Zod. |
| `src/http` | Sesiones, archivos y manejo de errores. |
| `migrations` | Cambios de la base de datos en SQL. |
| `tests` | Pruebas de integración por HTTP. |

## 3. Roles

| Rol | Funciones principales |
| --- | --- |
| `ALU` | Alumno: perfil, programas, propuesta y documentos. |
| `JSS` | Servicio Social: inducción, programas y dictámenes. |
| `JDV` | Vinculación: consulta de expedientes y constancias. |
| `ADM` | Administrador: altas, cambios, bajas y reactivaciones. |

El alumno debe acreditar la inducción antes de inscribirse. No puede
tener dos programas asignados ni otra propuesta pendiente al inscribirse.

## 4. Instalación local

Necesitas Node.js 24, npm y Docker con Compose. Usa una terminal dentro
de este repositorio, donde está `package.json`.

En PowerShell, si `npm` está bloqueado, escribe `npm.cmd`.

### Preparar la configuración

Solo para una instalación nueva:

```sh
cp .env.example .env
npm ci
```

Edita `.env`. Define `DB_PASSWORD` y genera un secreto para las sesiones:

```sh
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Copia el resultado en `SESSION_SECRET`. Conserva estos valores locales:

```dotenv
NODE_ENV=development
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=ServicioSocial
DB_USER=Angel
FRONTEND_URL=http://localhost:5173
INSTITUTIONAL_DOMAIN=culiacan.tecnm.mx
```

La contraseña de PostgreSQL y las cuentas de la aplicación son distintas.
No incluyas contraseñas reales ni archivos `.env` en Git.

### Crear la base y aplicar las migraciones

Si ya tienes PostgreSQL local, configura su conexión y omite el primer comando.
Para crear una instancia nueva de desarrollo:

```sh
docker compose -f compose.dev.yaml up -d --wait
npm run build
npm run db:migrate
```

`compose.dev.yaml` inicia solo PostgreSQL. Conserva los datos en un volumen.
Si el puerto 5432 está ocupado, cambia `DB_PORT` en `.env` por un puerto libre.

### Crear el primer administrador

En PowerShell 7:

```powershell
$env:ADMIN_ID = 'ADMIN'
$env:ADMIN_NAME = 'Administrador local'
$env:ADMIN_EMAIL = 'admin@culiacan.tecnm.mx'
$env:ADMIN_PASSWORD = Read-Host 'Contraseña de 12 o más caracteres' -MaskInput
npm run db:admin
Remove-Item Env:ADMIN_PASSWORD
```

En Linux, exporta esas cuatro variables y ejecuta `npm run db:admin`.
El script crea la cuenta una sola vez. Después, el administrador crea los
demás usuarios desde la aplicación o mediante `POST /api/usuarios`.

### Arrancar

```sh
npm run dev
```

Para ejecutar la versión compilada usa `npm start`.
Abre http://localhost:3000/api/salud. La respuesta esperada es:

```json
{ "estado": "ok" }
```

El frontend local debe abrirse en `http://localhost:5173`.

## 5. Configuración

| Variable | Uso |
| --- | --- |
| `PORT` | Puerto de la API; por defecto 3000. |
| `DB_HOST`, `DB_PORT` | Dirección y puerto de PostgreSQL. |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Base, usuario y contraseña. |
| `SESSION_SECRET` | Clave privada para firmar la cookie; mínimo 32 caracteres. |
| `FRONTEND_URL` | Origen exacto de la interfaz. HTTPS en producción. |
| `INSTITUTIONAL_DOMAIN` | `culiacan.tecnm.mx`. |
| `RESEND_API_KEY` | Clave privada del proveedor de correo. |
| `MAIL_FROM` | Remitente autorizado en Resend. |
| `HOURS_REQUIRED` | Meta de horas aprobadas; por defecto 480. |
| `TRUST_PROXY_HOPS` | Cantidad de proxies de confianza; 0 en local. |

Las demás opciones están en [.env.example](.env.example).

## 6. Uso de la API

Todas las rutas comienzan con `/api`. Reciben JSON, salvo las cargas de
archivos, que usan `multipart/form-data` con el campo `archivo`.

Ejemplo de inicio de sesión:

```http
POST /api/auth/login
Content-Type: application/json
```

```json
{
  "identificador": "ADMIN",
  "contrasena": "tu_contraseña"
}
```

La respuesta incluye el usuario y `csrfToken`. También crea una cookie de
sesión. Guarda la cookie en tu cliente de API y envía el token en la cabecera
`X-CSRF-Token` para cada POST, PUT o DELETE autenticado.

En Postman puedes iniciar sesión y reutilizar la cookie que guarda el cliente.
En un navegador las solicitudes deben incluir las credenciales de sesión.

Consulta [la referencia de la API](docs/API.md) para ver todas las rutas,
los campos, ejemplos de CRUD, permisos y códigos HTTP.

## 7. Base de datos y persistencia

La base se llama `ServicioSocial`. Sequelize define los modelos y las
migraciones crean las tablas, relaciones, índices y restricciones.

- `usuarios` contiene el acceso y se relaciona con `alumnos` o `personal`.
- `programas` guarda programas internos y propuestas externas.
- `expedientes` une al alumno con su programa.
- `documentos` guarda las entregas, sus versiones y las revisiones.
- `cursos_induccion` y `asistencias_induccion` registran la acreditación.
- `plantillas` y `constancias_terminacion` guardan los PDF correspondientes.
- `sesiones`, `recuperaciones` y `migraciones` apoyan el funcionamiento.

Los identificadores y correos de usuario son únicos. Las claves foráneas
protegen las relaciones. Los índices ayudan a consultar programas,
expedientes y documentos. Las listas tienen paginación.

Las transacciones y los bloqueos evitan asignar dos veces el último cupo
o sumar horas de una entrega ya revisada. La baja de usuarios y el archivado
de programas son lógicos: conservan el historial.

Consulta el diseño en [la migración inicial](migrations/001_inicial.sql).
Los datos permanecen al reiniciar los contenedores. Eliminar el volumen
con `docker compose down -v` también elimina la base de datos.

## 8. Seguridad y validaciones

Los esquemas Zod revisan los datos antes de realizar operaciones.

- Al registrar o editar cuentas y contactos de programas internos, el correo debe terminar
  exactamente en `@culiacan.tecnm.mx`.
- Las propuestas externas aceptan el correo de cualquier persona o institución,
  siempre que tenga formato válido, con arroba y extensión de dominio.
- Las contraseñas nuevas requieren entre 12 y 128 caracteres.
- Los textos tienen límites y se rechazan caracteres de control.
- Se validan teléfonos, enteros, cupos, horas y campos obligatorios.
- Los rechazos requieren observaciones.
- Los PDF deben ser legibles, tener extensión y contenido válidos y pesar
  como máximo 10 MiB. Las listas XLSX tienen un límite de 1 MiB.

Las contraseñas se guardan con scrypt y sal aleatoria. Cada ruta protegida
comprueba la sesión y el rol. Los archivos de alumno comprueban su propietario.
Se usan consultas con parámetros, Helmet, control de origen y límites de intentos.

La cookie es `HttpOnly` y `SameSite=Lax`; en producción también es `Secure`.
La sesión se guarda en PostgreSQL y tiene una duración de ocho horas.
El token CSRF protege las operaciones que cambian datos.

Por requisito del proyecto se usan sesiones web por cookies. La rúbrica
menciona JWT; esta implementación no usa JWT y debe evaluarse con esa aclaración.

## 9. Recuperación de contraseña

El alumno solicita la recuperación con su correo institucional registrado.
Resend envía el enlace a esa cuenta. El token vence en 30 minutos, se guarda
como hash y solo puede usarse una vez. Cambiar la contraseña invalida las
sesiones anteriores.

En desarrollo, si falta `RESEND_API_KEY`, el enlace se muestra en la terminal
y no se envía un correo real. Mailpit no forma parte del envío actual.

En producción se requiere Resend y un dominio de envío verificado.
El homelab usa el remitente del subdominio `notificaciones` del dominio de
la aplicación. El remitente de prueba `onboarding@resend.dev` tiene restricciones.

## 10. Pruebas y calidad

```sh
npm run test:integration
```

Necesita PostgreSQL disponible con los datos de `.env` y permiso para crear
bases. La prueba crea una base temporal y la elimina al terminar. No modifica
la base `ServicioSocial` ni envía correos reales.

La última verificación completó 13 pruebas y 105 respuestas HTTP. Comprueba
roles, CSRF, CRUD, archivos, recuperación, constancias, persistencia de sesiones
y dos alumnos compitiendo por el último cupo. `npm run build` revisa los tipos
de TypeScript y genera el código de producción.

## 11. Docker, migraciones y despliegue

Para desplegar solo la API y PostgreSQL, prepara `.env` con
[.env.docker.example](.env.docker.example) y ejecuta:

```sh
docker compose up -d --build --wait
docker compose ps
```

La imagen usa Node.js 24 y ejecuta la API sin usuario root. El arranque espera
a PostgreSQL y aplica las migraciones pendientes antes de escuchar solicitudes.
No se ejecuta `sequelize.sync({ force: true })` ni se reinicia el esquema.

Las migraciones se registran y no se repiten al reiniciar. Para cambiar el
esquema agrega otro archivo, por ejemplo `002_cambio.sql`.

El homelab ejecuta frontend, API y PostgreSQL en `/srv/serviciosocial`.
Cloudflare Tunnel publica HTTPS y Nginx reenvía `/api` al backend.

Los workflows comprueban los pull requests. Un push a `main` también publica
la imagen y actualiza el servicio, una vez configuradas las variables y secretos.
El despliegue del backend respalda la base antes de actualizar.

Consulta [DEPLOYMENT.md](DEPLOYMENT.md) para configurar ambos repositorios.

## 12. Relación con la rúbrica

| Criterio | Evidencia |
| --- | --- |
| Presentación | Actividad, institución e integrantes al inicio. |
| Funcionamiento de la API | Rutas, permisos y estados en `docs/API.md`. |
| CRUD y datos | Altas, consultas, cambios y bajas con persistencia. |
| Calidad de código | MVC, TypeScript y servicios separados. |
| Base de datos | Relaciones, índices, restricciones y migraciones. |
| Seguridad y validación | Zod, roles, cookies, CSRF y manejo de secretos. |
| Documentación | Instalación, configuración y referencia de la API. |
| Entrega en tiempo | Se acredita con la fecha de entrega y los commits. |

La respuesta en menos de tres segundos y la disponibilidad continua deben
comprobarse con pruebas de carga y monitoreo del servidor. Las pruebas
funcionales realizadas no garantizan esas metas en cualquier entorno.

## 13. Problemas comunes

| Problema | Qué revisar |
| --- | --- |
| La API no inicia | Docker, conexión a PostgreSQL y variables de `.env`. |
| Puerto ocupado | Otra instancia de Node o PostgreSQL en el mismo puerto. |
| Error 401 | Iniciar sesión otra vez y conservar la cookie. |
| Error 403 | Rol, origen permitido y cabecera CSRF. |
| No llega el correo | Correo registrado, clave Resend y dominio verificado. |
| No permite inscripción | Inducción acreditada, cupo y estado del alumno. |
| No genera constancia | Documentos requeridos aprobados y 480 horas. |
