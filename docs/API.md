# Referencia de la API

En local, la dirección base es `http://localhost:3000/api`.
En el homelab es `https://laquieromuchomirna.lol/api`.
Las rutas siguientes ya incluyen `/api`.

## Sesión y formato

Las peticiones usan JSON. Los archivos se mandan como `multipart/form-data`
en el campo `archivo`. Conserva la cookie que entrega el inicio de sesión.
En POST, PUT y DELETE autenticados agrega `X-CSRF-Token` con el valor de
`csrfToken`. Las rutas públicas de acceso y recuperación no necesitan ese token.

La API devuelve los registros en `datos`. Las listas incluyen `paginacion`.
La página inicial es 1; `limite` acepta de 1 a 100 registros.

Los roles son `ALU`, `JSS`, `JDV` y `ADM`.

## GET: consultar

### Acceso público

- `/api/salud`: estado de la conexión con PostgreSQL.
- `/api/configuracion`: dominio institucional y horas requeridas.

### Cuenta y alumno

- `/api/auth/sesion`: usuario y token CSRF de la sesión actual.
- `/api/alumnos/me/perfil`: datos del alumno conectado. Rol ALU.
- `/api/alumnos/me/propuesta`: última propuesta propia. Rol ALU.
- `/api/alumnos/me/expediente`: entregas, observaciones y avance. Rol ALU.

### Administración

- `/api/usuarios`: lista de usuarios. Rol ADM.
- `/api/usuarios/:id`: cuenta y perfil por ID numérico. Rol ADM.

La lista acepta `pagina`, `limite` e `identificador` como filtros.
Ejemplo: `/api/usuarios?identificador=23170001`.

### Programas y propuestas

- `/api/programas`: banco de programas internos. Roles ALU y JSS.
- `/api/programas/:id`: detalle del programa. Roles ALU y JSS.
- `/api/propuestas`: propuestas externas por estado. Rol JSS.
- `/api/propuestas/:id/archivo`: PDF adjunto. Autor ALU o rol JSS.

El banco acepta `periodo`, `pagina` y `limite`. El alumno solo consulta
programas activos. Las propuestas aceptan `estado`, `pagina` y `limite`.
El estado predeterminado es `PENDIENTE`.

### Documentos y formatos

- `/api/documentos`: entregas vigentes por estado. Rol JSS.
- `/api/documentos/:id/archivo`: PDF del documento. Dueño ALU, JSS o JDV.
- `/api/plantillas`: tipos de formato publicados. Roles ALU y JSS.
- `/api/plantillas/:tipo`: descargar el formato PDF. Roles ALU y JSS.

Los documentos aceptan `estado`, `pagina` y `limite`.
Los estados de revisión son `PENDIENTE`, `ACEPTADO` y `RECHAZADO`.

### Reportes y constancias

- `/api/reportes/faltantes`: alumnos sin entrega del reporte elegido. Rol JSS.
- `/api/expedientes`: consulta por `numeroControl`. Rol JDV.
- `/api/constancias/:folio/archivo`: descargar la constancia PDF. Rol JDV.

En faltantes, `reporte` es obligatorio: `1`, `2`, `3` o `final`.
Admite `periodo`, `pagina`, `limite` y `formato=json` o `formato=csv`.
El CSV incluye hasta 10 000 alumnos; sin resultados se devuelve JSON con aviso.

Una entrega rechazada o pendiente cuenta como recibida en este reporte.
Para revisar su aprobación se consulta el expediente.

Ejemplos:

```text
/api/reportes/faltantes?reporte=1&periodo=2026-2
/api/expedientes?numeroControl=23170001
/api/constancias/:folio/archivo?vista=1
```

`vista=1` permite mostrar el PDF en el visor del navegador.

## POST: registrar o ejecutar

### Inicio y cierre de sesión

`/api/auth/login` es público. Recibe:

```json
{
  "identificador": "ADMIN",
  "contrasena": "tu_contraseña"
}
```

También se puede usar el correo registrado como identificador.
La respuesta incluye `datos` y `csrfToken`, y crea la cookie de sesión.

`/api/auth/logout` cierra la sesión actual. Requiere cookie y CSRF.

### Recuperación

`/api/auth/recuperar` es público. Recibe `correo`, que debe corresponder
a un alumno activo y terminar en `@culiacan.tecnm.mx`.

`/api/auth/restablecer` es público. Recibe `token` y `contrasena` nueva.
El token es el que llegó en el enlace; dura 30 minutos y es de un solo uso.
La contraseña debe tener de 12 a 128 caracteres.

### Alta de usuarios

`/api/usuarios`, rol ADM, recibe:

```json
{
  "identificador": "23170001",
  "nombreCompleto": "Alumno de ejemplo",
  "correo": "alumno@culiacan.tecnm.mx",
  "rol": "ALU"
}
```

Opcionales: `contrasena`, `carrera`, `semestre`, `planEstudios` y
`departamento`. El semestre debe ser entero entre 1 y 20.
Si omites la contraseña, se genera una y se devuelve una sola vez
en `contrasenaInicial`. El identificador y el correo no pueden repetirse.

### Curso de inducción

`/api/induccion/asistencias`, rol JSS, recibe formulario con:

- `archivo`: CSV o XLSX con los números de control en la primera columna.
- `fechaCurso`: fecha con formato `AAAA-MM-DD`.
- `periodo`: texto, por ejemplo `2026-2`.

Ejemplo del CSV:

```csv
numero_control
23170001
23170002
```

Todos deben ser alumnos activos. Si uno no existe, se rechaza la carga
completa. Máximo 5 000 controles, 10 MiB para CSV y 1 MiB para XLSX.
La carga repetida no duplica la asistencia al mismo curso.

### Programa interno

`/api/programas`, rol JSS, recibe:

- `nombreProyecto`, `objetivo`, `actividades` y `area`.
- `nombreTitular`, `puestoTitular`.
- `nombreResponsable`, `puestoResponsable`.
- `telefono`, `correo` institucional y `domicilio`.
- `cupo`: entero mayor que cero.
- `horario` y `periodo` opcional.

Si se omite el periodo se asigna el semestre calendario actual.
El programa se registra aceptado y con el cupo completo disponible.

### Selección y propuesta propia

`/api/alumnos/me/seleccion`, rol ALU, recibe `folio`: ID del programa interno.
Requiere inducción acreditada, cupo y ausencia de programa asignado o
propuesta pendiente. La asignación crea el expediente y descuenta un cupo.

`/api/alumnos/me/propuesta`, rol ALU, recibe `nombreEmpresa` y los datos
de contacto del programa: área, titular, responsable, puestos, actividades,
teléfono, correo institucional y domicilio. Puede llevar un PDF opcional
usando multipart. La propuesta queda pendiente hasta su revisión.
Una propuesta rechazada se puede corregir y reenviar como un nuevo registro.

### Entrega de documentos

`/api/documentos`, rol ALU, recibe un PDF en `archivo` y su `tipo`.
Requiere expediente asignado. Cada archivo tiene un máximo de 10 MiB.

| Tipo | Datos adicionales |
| --- | --- |
| `SOLICITUD` | Ninguno. |
| `CARTA_ACEPTACION` | Ninguno. |
| `REPORTE_BIMESTRAL` | `numeroReporte` de 1 a 3 y `horas`. |
| `REPORTE_FINAL` | `horas`. |
| `CARTA_TERMINACION` | Ninguno. |

Las horas son enteros entre 0 y 10 000. Un reenvío conserva la versión
anterior. Un documento aceptado ya no puede reemplazarse.

### Emitir constancia

`/api/constancias`, rol JDV, recibe `numeroControl`.
Requiere carta de aceptación, bimestrales 1, 2 y 3 e informe final aprobados,
y al menos 480 horas, salvo otra meta configurada en el servidor.

La solicitud y la carta de terminación aparecen en el expediente, pero no
son parte del bloqueo de emisión actual. La constancia incluye un espacio
para firma institucional; no lleva firma digital.

La respuesta incluye folio y rutas de descarga y vista previa. Volver a
emitir para el mismo expediente devuelve la constancia existente.

## PUT: actualizar

- `/api/usuarios/:id`, rol ADM: mismos campos obligatorios del alta.
  Admite `activo`, contraseña nueva y los datos opcionales del perfil.
  Sirve para cambiar el rol o reactivar una cuenta.
- `/api/alumnos/me/perfil`, rol ALU: `contrasenaActual` y al menos un cambio
  en `nombre`, `apellidos`, `telefono` o `nuevaContrasena`.
  Si cambia la contraseña, devuelve cookie y CSRF nuevos.
- `/api/programas/:id`, rol JSS: datos completos del programa interno.
  El cupo no puede quedar por debajo de las inscripciones existentes.
- `/api/propuestas/:id/revision`, rol JSS: dictamen de propuesta.
- `/api/documentos/:id/revision`, rol JSS: dictamen de entrega.
- `/api/plantillas`, rol JSS: multipart con `tipo` y `archivo` PDF.

Los dictámenes reciben `estado` y `observaciones`:

```json
{
  "estado": "RECHAZADO",
  "observaciones": "Corregir los datos del responsable."
}
```

El estado puede ser `ACEPTADO` o `RECHAZADO`.
Las observaciones son obligatorias al rechazar.
Aprobar un reporte suma sus horas una sola vez.

## DELETE: dar de baja

- `/api/usuarios/:id`, rol ADM: recibe `{ "confirmar": true }`.
  Desactiva la cuenta, conserva los datos y revoca sus sesiones.
  No permite dar de baja al último administrador activo.
- `/api/programas/:id`, rol JSS: archiva el programa interno.
  Ya no aparece disponible al alumno; los expedientes se conservan.

No hay una ruta para borrar físicamente un expediente o una entrega aceptada.

## Ejemplo de CRUD

Con una sesión de administrador y la cabecera CSRF:

1. Crear con `POST /api/usuarios`, usando el JSON del ejemplo de alta.
2. Consultar con `GET /api/usuarios/:id`, usando el ID devuelto.
3. Cambiar con `PUT /api/usuarios/:id`, enviando los datos completos.
4. Dar de baja con `DELETE /api/usuarios/:id` y `confirmar=true` en JSON.
5. Reactivar con PUT y `activo=true` si se necesita recuperar el acceso.

## Respuestas y errores

| Estado HTTP | Significado |
| --- | --- |
| 200 | Consulta, actualización o baja de usuario exitosa. |
| 201 | Registro o constancia creados. |
| 204 | Sesión cerrada o programa archivado. |
| 400 | Datos inválidos o campos faltantes. |
| 401 | Credenciales o sesión inválidas. |
| 403 | Rol, origen o token CSRF no autorizado. |
| 404 | Recurso ausente o fuera del alcance del usuario. |
| 409 | Duplicado, cupo lleno o conflicto con el trámite. |
| 413 | Archivo o cuerpo demasiado grande. |
| 415 | Codificación de solicitud no soportada. |
| 422 | Exportación demasiado grande; reducir el periodo. |
| 429 | Demasiados intentos de acceso o recuperación. |
| 500 | Error interno. |
| 503 | Base de datos o proveedor de correo no disponible. |

Ejemplo de validación:

```json
{
  "error": {
    "codigo": "VALIDACION",
    "mensaje": "Revise los campos indicados",
    "detalles": [
      { "campo": "correo", "mensaje": "Este campo es obligatorio" }
    ]
  },
  "solicitudId": "identificador-de-la-solicitud"
}
```

Los límites de cada campo están en
[los esquemas de validación](../src/validation/schemas.ts).
Las pruebas de los flujos están en [integration.cjs](../tests/integration.cjs).
