// Ejecuta flujos HTTP contra Express y PostgreSQL reales en una base desechable.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadEnvFile } = require('node:process');
const { randomBytes } = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const http = require('node:http');
const net = require('node:net');
const { Client } = require('pg');
const { PDFDocument } = require('pdf-lib');

try { loadEnvFile(); } catch (error) { if (error.code !== 'ENOENT') throw error; }

test('Servicio social: flujos, persistencia, permisos y concurrencia', { timeout: 120_000 }, async t => {
  const database = 'servicio_social_test_' + randomBytes(8).toString('hex');
  const password = 'Prueba-' + randomBytes(16).toString('hex');
  const sql = new Client({ host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'Angel', password: process.env.DB_PASSWORD, database: 'postgres' });
  let server;
  let serverLog = '';
  let requests = 0;
  const sessions = {};
  const users = {};
  const emailMessages = [];
  const mockResend = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      if (req.url === '/emails' && req.method === 'POST') {
        try { emailMessages.push(JSON.parse(body)); } catch {}
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 'msg_' + randomBytes(8).toString('hex') }));
      } else {
        res.writeHead(404).end();
      }
    });
  });
  mockResend.listen(0, '127.0.0.1');
  await once(mockResend, 'listening');
  const resendPort = mockResend.address().port;

  const listener = net.createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  const origin = 'http://localhost:' + port;
  const base = 'http://127.0.0.1:' + port + '/api';
  const env = { ...process.env, NODE_ENV: 'test', PORT: String(port), DB_NAME: database,
    SESSION_SECRET: randomBytes(48).toString('hex'), FRONTEND_URL: origin, INSTITUTIONAL_DOMAIN: 'culiacan.tecnm.mx',
    RESEND_API_KEY: 're_test_key', RESEND_BASE_URL: 'http://127.0.0.1:' + resendPort, MAIL_FROM: 'onboarding@resend.dev',
    ADMIN_ID: 'TEST_ADMIN', ADMIN_NAME: 'Administrador de prueba', ADMIN_EMAIL: 'admin@culiacan.tecnm.mx', ADMIN_PASSWORD: password };

  function script(filename) {
    const result = spawnSync(process.execPath, [filename], { env, encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
  async function start() {
    server = spawn(process.execPath, ['dist/server.js'], { env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    server.stdout.on('data', data => { serverLog += data; });
    server.stderr.on('data', data => { serverLog += data; });
    for (let i = 0; i < 60; i++) {
      try { if ((await fetch(base + '/salud')).ok) return; } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('La API no inició: ' + serverLog);
  }
  async function stop() {
    if (!server || server.exitCode !== null) return;
    const exited = once(server, 'exit');
    server.kill();
    await exited;
  }
  async function request(actor, method, route, body, expected = 200, options = {}) {
    const session = sessions[actor];
    const multipart = body instanceof FormData;
    const response = await fetch(base + route, { method, headers: {
      Origin: origin, ...(session ? { Cookie: session.cookie, 'X-CSRF-Token': session.csrf } : {}),
      ...(body && !multipart ? { 'Content-Type': 'application/json' } : {}), ...options.headers,
    }, body: body ? (multipart ? body : JSON.stringify(body)) : undefined });
    requests++;
    const contentType = response.headers.get('content-type') || '';
    const result = contentType.includes('application/json') ? await response.json()
      : contentType.includes('pdf') ? Buffer.from(await response.arrayBuffer()) : await response.text();
    assert.equal(response.status, expected, method + ' ' + route + ': ' + JSON.stringify(result));
    return { result, response };
  }
  async function login(actor, key = password, identifier = actor) {
    const { response, result } = await request(null, 'POST', '/auth/login', { identificador: identifier, contrasena: key });
    sessions[actor] = { cookie: response.headers.get('set-cookie').split(';')[0], csrf: result.csrfToken };
    return response;
  }
  const pdf = await PDFDocument.create();
  pdf.addPage().drawText('Documento ficticio para prueba de integracion');
  const pdfBytes = await pdf.save();
  function fileBody(fields, bytes = pdfBytes, filename = 'prueba.pdf', type = 'application/pdf') {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.set(key, String(value));
    form.set('archivo', new Blob([bytes], { type }), filename);
    return form;
  }
  const contact = { area: 'Sistemas', nombreTitular: 'Titular de prueba', puestoTitular: 'Dirección',
    nombreResponsable: 'Responsable de prueba', puestoResponsable: 'Coordinación', actividades: 'Apoyo comunitario',
    telefono: '6671234567', correo: 'contacto@culiacan.tecnm.mx', domicilio: 'Domicilio ficticio 123' };
  const program = { ...contact, nombreProyecto: 'Apoyo tecnológico', objetivo: 'Apoyar a la comunidad',
    cupo: 1, horario: 'Lunes a viernes', periodo: '2026-2' };
  let programId;
  let firstDocument;
  let certificate;
  try {
    await sql.connect();
    await sql.query('CREATE DATABASE "' + database + '"');
    script('dist/scripts/migrate.js');
    script('dist/scripts/migrate.js');
    script('dist/scripts/admin.js');
    await start();

    await t.test('UC01: sesiones de cookies y protección CSRF/RBAC', async () => {
      await request(null, 'GET', '/auth/sesion', null, 401);
      await request(null, 'POST', '/auth/login', {}, 400);
      const response = await login('TEST_ADMIN');
      assert.match(response.headers.get('set-cookie'), /HttpOnly/i);
      assert.match(response.headers.get('set-cookie'), /SameSite=Lax/i);
      await request('TEST_ADMIN', 'POST', '/usuarios', {}, 403, { headers: { 'X-CSRF-Token': '' } });
      const { result } = await request('TEST_ADMIN', 'GET', '/auth/sesion');
      users.TEST_ADMIN = result.datos;
      assert.equal(result.datos.passwordHash, undefined);
    });
    await t.test('UC17-19: alta, unicidad y conservación del último administrador', async () => {
      for (const [rol, id] of [['ALU', 'ALU_A'], ['ALU', 'ALU_B'], ['ALU', 'ALU_C'], ['JSS', 'JSS'], ['JDV', 'JDV']]) {
        const body = { identificador: id, nombreCompleto: 'Persona de prueba ' + id,
          correo: id.toLowerCase() + '@culiacan.tecnm.mx', rol, contrasena: password };
        const { result } = await request('TEST_ADMIN', 'POST', '/usuarios', body, 201);
        users[id] = result.datos;
        await request('TEST_ADMIN', 'POST', '/usuarios', body, 409);
        await login(id);
      }
      await request('TEST_ADMIN', 'DELETE', '/usuarios/' + users.TEST_ADMIN.id, { confirmar: true }, 409);
      await request('ALU_A', 'GET', '/usuarios', null, 403);
    });
    await t.test('UC10-11: validaciones, lista atómica, alta y edición de programa', async () => {
      await request('JSS', 'POST', '/programas', { ...program, cupo: 0 }, 400);
      await request('JSS', 'POST', '/programas', { ...program, correo: 'invalido' }, 400);
      const { result } = await request('JSS', 'POST', '/programas', program, 201);
      programId = result.datos.id;
      await request('ALU_A', 'POST', '/alumnos/me/seleccion', { folio: programId }, 409);
      await request('JSS', 'POST', '/induccion/asistencias', fileBody({ periodo: '2026-2', fechaCurso: '2026-11-14' },
        'numero_control\nALU_A\nNO_EXISTE\n', 'lista.csv', 'text/csv'), 400);
      await request('ALU_A', 'POST', '/alumnos/me/seleccion', { folio: programId }, 409);
      const form = () => fileBody({ periodo: '2026-2', fechaCurso: '2026-11-14' },
        'numero_control\nALU_A\nALU_B\nALU_C\n', 'lista.csv', 'text/csv');
      await request('JSS', 'POST', '/induccion/asistencias', form());
      const repeated = await request('JSS', 'POST', '/induccion/asistencias', form());
      assert.equal(repeated.result.datos.totalAsistentes, 3);
      await request('JSS', 'PUT', '/programas/' + programId, { ...program, nombreProyecto: 'Apoyo actualizado' });
    });
    await t.test('UC04: dos alumnos compiten por el último cupo sin sobreinscripción', async () => {
      const race = await Promise.all(['ALU_A', 'ALU_B'].map(actor => fetch(base + '/alumnos/me/seleccion', {
        method: 'POST', headers: { Origin: origin, Cookie: sessions[actor].cookie,
          'X-CSRF-Token': sessions[actor].csrf, 'Content-Type': 'application/json' }, body: JSON.stringify({ folio: programId }),
      })));
      requests += race.length;
      assert.deepEqual(race.map(r => r.status).sort(), [201, 409]);
      const bodies = await Promise.all(race.map(r => r.json()));
      sessions.WINNER = sessions[race[0].status === 201 ? 'ALU_A' : 'ALU_B'];
      sessions.LOSER = sessions[race[0].status === 201 ? 'ALU_B' : 'ALU_A'];
      users.WINNER = users[race[0].status === 201 ? 'ALU_A' : 'ALU_B'];
      assert.ok(bodies.some(body => body.datos));
      const { result } = await request('JSS', 'GET', '/programas/' + programId);
      assert.equal(result.datos.cupoDisponible, 0);
      await request('WINNER', 'POST', '/alumnos/me/seleccion', { folio: programId }, 409);
    });
    await t.test('UC02: perfil confirma contraseña y persiste los cambios', async () => {
      await request('WINNER', 'PUT', '/alumnos/me/perfil', { telefono: '6671234567', contrasenaActual: 'incorrecta' }, 400);
      await request('WINNER', 'PUT', '/alumnos/me/perfil', { telefono: '6671234567', contrasenaActual: password });
      const { result } = await request('WINNER', 'GET', '/alumnos/me/perfil');
      assert.equal(result.datos.perfil.telefono, '6671234567');
    });
    await t.test('UC05,07,12: rechazar con observaciones, corregir y aceptar propuesta', async () => {
      const proposal = { ...contact, nombreEmpresa: 'Empresa ficticia' };
      const first = await request('ALU_C', 'POST', '/alumnos/me/propuesta', proposal, 201);
      await request('ALU_C', 'POST', '/alumnos/me/propuesta', proposal, 409);
      await request('JSS', 'PUT', '/propuestas/' + first.result.datos.id + '/revision', { estado: 'RECHAZADO' }, 400);
      await request('JSS', 'PUT', '/propuestas/' + first.result.datos.id + '/revision', { estado: 'RECHAZADO', observaciones: 'Ajustar actividades' });
      const own = await request('ALU_C', 'GET', '/alumnos/me/propuesta');
      assert.equal(own.result.datos.observaciones, 'Ajustar actividades');
      const second = await request('ALU_C', 'POST', '/alumnos/me/propuesta', { ...proposal, actividades: 'Actividades corregidas' }, 201);
      await request('JSS', 'PUT', '/propuestas/' + second.result.datos.id + '/revision', { estado: 'ACEPTADO' });
      await request('ALU_C', 'GET', '/alumnos/me/expediente');
    });
    await t.test('UC06,08,13: PDF, permisos, rechazo, reemplazo y aprobación única', async () => {
      await request('JSS', 'PUT', '/plantillas', fileBody({ tipo: 'SOLICITUD' }));
      const template = await request('WINNER', 'GET', '/plantillas/SOLICITUD');
      assert.match(template.result.toString('ascii', 0, 5), /%PDF/);
      await request('WINNER', 'POST', '/documentos', fileBody({ tipo: 'CARTA_ACEPTACION' }, 'no es PDF'), 400);
      await request('WINNER', 'POST', '/documentos', fileBody({ tipo: 'REPORTE_BIMESTRAL', numeroReporte: 4, horas: -1 }), 400);
      const upload = await request('WINNER', 'POST', '/documentos', fileBody({ tipo: 'CARTA_ACEPTACION' }), 201);
      firstDocument = upload.result.datos.id;
      await request('LOSER', 'GET', '/documentos/' + firstDocument + '/archivo', null, 404);
      await request('JSS', 'PUT', '/documentos/' + firstDocument + '/revision', { estado: 'RECHAZADO' }, 400);
      await request('JSS', 'PUT', '/documentos/' + firstDocument + '/revision', { estado: 'RECHAZADO', observaciones: 'Corregir firma' });
      const corrected = await request('WINNER', 'POST', '/documentos', fileBody({ tipo: 'CARTA_ACEPTACION' }), 201);
      await request('JSS', 'PUT', '/documentos/' + corrected.result.datos.id + '/revision', { estado: 'ACEPTADO' });
      await request('WINNER', 'POST', '/documentos', fileBody({ tipo: 'CARTA_ACEPTACION' }), 409);
      for (const fields of [1, 2, 3].map(n => ({ tipo: 'REPORTE_BIMESTRAL', numeroReporte: n, horas: 120 }))) {
        const doc = await request('WINNER', 'POST', '/documentos', fileBody(fields), 201);
        await request('JSS', 'PUT', '/documentos/' + doc.result.datos.id + '/revision', { estado: 'ACEPTADO' });
        await request('JSS', 'PUT', '/documentos/' + doc.result.datos.id + '/revision', { estado: 'ACEPTADO' }, 409);
      }
    });
    await t.test('UC09,14-16: horas aprobadas, faltantes, CSV y constancia idempotente', async () => {
      await request('JDV', 'POST', '/constancias', { numeroControl: users.WINNER.identificador }, 409);
      const missing = await request('JSS', 'GET', '/reportes/faltantes?reporte=final');
      assert.equal(missing.result.paginacion.total, 2);
      const csv = await request('JSS', 'GET', '/reportes/faltantes?reporte=final&formato=csv');
      assert.match(csv.result, /numero_control,nombre_completo,programa,periodo/);
      const doc = await request('WINNER', 'POST', '/documentos', fileBody({ tipo: 'REPORTE_FINAL', horas: 120 }), 201);
      await request('JSS', 'PUT', '/documentos/' + doc.result.datos.id + '/revision', { estado: 'ACEPTADO' });
      const file = await request('JDV', 'GET', '/expedientes?numeroControl=' + users.WINNER.identificador);
      assert.equal(file.result.datos.expediente.avanceHoras, 480);
      assert.equal(file.result.datos.expediente.porcentajeAvance, 100);
      certificate = (await request('JDV', 'POST', '/constancias', { numeroControl: users.WINNER.identificador }, 201)).result.datos;
      const repeated = await request('JDV', 'POST', '/constancias', { numeroControl: users.WINNER.identificador });
      assert.equal(repeated.result.datos.folio, certificate.folio);
      const download = await request('JDV', 'GET', certificate.descarga.replace('/api', ''));
      assert.equal((await PDFDocument.load(download.result)).getPageCount(), 1);
    });
    await t.test('sesiones y expedientes sobreviven al reinicio de Express', async () => {
      await stop();
      await start();
      await request('WINNER', 'GET', '/auth/sesion');
      const file = await request('WINNER', 'GET', '/alumnos/me/expediente');
      assert.equal(file.result.datos.avanceHoras, 480);
      assert.equal(file.result.datos.estadoGlobal, 'TERMINADO');
    });
    await t.test('UC18-19: edición, cambio de rol, baja confirmada y reactivación', async () => {
      const body = { identificador: 'TEMPORAL', nombreCompleto: 'Cuenta temporal', correo: 'temporal@culiacan.tecnm.mx', rol: 'ALU' };
      const created = await request('TEST_ADMIN', 'POST', '/usuarios', body, 201);
      assert.ok(created.result.contrasenaInicial?.length >= 12);
      const id = created.result.datos.id;
      await login('TEMPORAL', created.result.contrasenaInicial);
      await request('TEST_ADMIN', 'PUT', '/usuarios/' + id, { ...body, rol: 'JSS' });
      await request('TEMPORAL', 'GET', '/auth/sesion', null, 401);
      await request('TEST_ADMIN', 'DELETE', '/usuarios/' + id, { confirmar: false }, 400);
      await request('TEST_ADMIN', 'DELETE', '/usuarios/' + id, { confirmar: true });
      await request(null, 'POST', '/auth/login', { identificador: 'TEMPORAL', contrasena: created.result.contrasenaInicial }, 401);
      await request('TEST_ADMIN', 'PUT', '/usuarios/' + id, { ...body, activo: true });
      await login('TEMPORAL', created.result.contrasenaInicial);
    });
    await t.test('UC03: correo real con Resend, enlace de un uso y revocación de sesiones', async () => {
      await request(null, 'POST', '/auth/recuperar', { correo: 'ausente@culiacan.tecnm.mx' }, 404);
      const email = 'alu_c@culiacan.tecnm.mx';
      await request(null, 'POST', '/auth/recuperar', { correo: email });
      const message = emailMessages.find(item => item.to === email || (Array.isArray(item.to) && item.to.includes(email)));
      assert.ok(message, 'Resend debe recibir la petición de correo');
      const token = message.text.match(/token=([a-f0-9]{64})/)[1];
      const newPassword = 'Nueva-' + randomBytes(16).toString('hex');
      await request(null, 'POST', '/auth/restablecer', { token, contrasena: newPassword });
      await request(null, 'POST', '/auth/restablecer', { token, contrasena: newPassword }, 400);
      await request('ALU_C', 'GET', '/auth/sesion', null, 401);
      await request(null, 'POST', '/auth/login', { identificador: 'ALU_C', contrasena: password }, 401);
      await login('ALU_C', newPassword);
    });
    await t.test('archivar conserva los expedientes y cerrar sesión elimina el acceso', async () => {
      await request('JSS', 'DELETE', '/programas/' + programId, null, 204);
      const { result } = await request('WINNER', 'GET', '/programas');
      assert.equal(result.datos.length, 0);
      await request('WINNER', 'GET', '/alumnos/me/expediente');
      await request('WINNER', 'POST', '/auth/logout', null, 204);
      await request('WINNER', 'GET', '/auth/sesion', null, 401);
    });
    t.diagnostic(requests + ' respuestas HTTP verificadas con base aislada; sin modificar ServicioSocial.');
  } finally {
    mockResend.close();
    await stop();
    // Solo permite eliminar la base aleatoria que creó esta ejecución.
    if (/^servicio_social_test_[a-f0-9]{16}$/.test(database)) {
      await sql.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()', [database]);
      await sql.query('DROP DATABASE IF EXISTS "' + database + '"');
    }
    await sql.end();
  }
});
