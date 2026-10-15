import type { INestApplication } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import sharp from 'sharp';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { Notification } from '../src/database/entidades/index.js';
import { SoporteService } from '../src/soporte/soporte.service.js';
import { adminConSesion, clienteConSesion, datosCuenta } from './ayudas.js';
import { crearApp } from './crear-app.js';

let app: INestApplication;
let fuente: DataSource;

beforeAll(async () => {
  app = await crearApp();
  fuente = app.get(getDataSourceToken());
});

afterAll(async () => {
  await app.close();
});

type Cliente = Awaited<ReturnType<typeof clienteConSesion>>;

/** Sube un archivo como el navegador: directo a la API, sin el secreto de la web, con la ficha del permiso. */
async function subir(
  web: Cliente['web'],
  bytes: Buffer,
  nombre: string,
  esperado = 201,
): Promise<request.Response> {
  const permiso = await web.post('/archivos/permiso').expect(200);
  return request(app.getHttpServer())
    .post('/archivos/subir')
    .set('x-doctrader-subida', permiso.body.ficha as string)
    .set('x-doctrader-nombre', encodeURIComponent(nombre))
    .set('content-type', 'application/octet-stream')
    .send(bytes)
    .expect(esperado);
}

/** Descarga un adjunto con el enlace de 5 minutos (en pruebas, el almacenamiento local de la API). */
async function descargar(web: Cliente['web'], id: string): Promise<request.Response> {
  const enlace = await web.get(`/archivos/${id}/enlace`).expect(200);
  const url = new URL(enlace.body.url as string);
  return request(app.getHttpServer())
    .get(url.pathname)
    .buffer(true)
    .parse((respuesta, listo) => {
      const partes: Buffer[] = [];
      respuesta.on('data', (p: Buffer) => partes.push(p));
      respuesta.on('end', () => listo(null, Buffer.concat(partes)));
    })
    .expect(200);
}

const png = () =>
  sharp({ create: { width: 40, height: 30, channels: 3, background: '#fb9819' } })
    .png()
    .toBuffer();

async function correos(destinatario: string, plantilla: string) {
  return fuente.getRepository(Notification).find({
    where: { recipient: destinatario, template: plantilla },
    order: { createdAt: 'ASC' },
  });
}

describe('soporte por tickets', () => {
  it('un ticket va y vuelve entre cliente y admin, con adjuntos, notas internas y correos', async () => {
    const cliente = await clienteConSesion(app, { nombre: 'Camilo Herrera Díaz' });
    const admin = await adminConSesion(app);
    const cuenta = await cliente.web.post('/cuentas', datosCuenta()).expect(201);

    const captura = await subir(cliente.web, await png(), 'C:\\fotos\\envío usdt.PNG');
    expect(captura.body).toMatchObject({ nombre: 'envío usdt.png', tipo: 'image/png' });

    const creado = await cliente.web
      .post('/soporte', {
        tema: 'PAGOS',
        asunto: 'No sé si mi pago llegó',
        mensaje: 'Envié 120 USDT por Tron hace una hora.\n\nAdjunto la captura.',
        cuentaId: cuenta.body.id,
        adjuntos: [captura.body.id],
      })
      .expect(201);
    const numero = creado.body.numero as number;
    expect(numero).toBeGreaterThanOrEqual(1000);

    // A los admins les llega el aviso del ticket nuevo.
    const [nuevo] = await correos(admin.usuario.email, 'ticket-nuevo');
    expect(nuevo?.payload).toMatchObject({
      numero: String(numero),
      cliente: 'Camilo Herrera Díaz',
    });

    // En la bandeja: sin responder, con el cliente y la cuenta.
    const bandeja = await admin.web.get('/admin/soporte?vista=sin').expect(200);
    const fila = bandeja.body.tickets.find((t: { numero: number }) => t.numero === numero);
    expect(fila).toMatchObject({
      estado: 'ABIERTO',
      cliente: 'Camilo Herrera Díaz',
      asignado: null,
    });
    expect(bandeja.body.conteos.sin).toBeGreaterThanOrEqual(1);
    const hoy = await admin.web.get('/admin/resumen').expect(200);
    expect(hoy.body.pendientes.tickets).toBeGreaterThanOrEqual(1);

    // Nota interna: el cliente no la ve ni puede bajar su adjunto, y no le llega correo.
    const notaAdjunto = await subir(admin.web, await png(), 'revision.png');
    await admin.web
      .post(`/admin/soporte/${numero}/mensajes`, {
        mensaje: 'El pago ya aparece verificado.',
        interna: true,
        adjuntos: [notaAdjunto.body.id],
      })
      .expect(200);
    let visto = await cliente.web.get(`/soporte/${numero}`).expect(200);
    expect(visto.body.mensajes).toHaveLength(1);
    expect(visto.body.estado).toBe('ABIERTO');
    await cliente.web.get(`/archivos/${notaAdjunto.body.id}/enlace`).expect(404);

    // Respuesta pública: pasa a respondido, le llega el correo con el texto y firma "DocTrader Pro".
    await admin.web
      .post(`/admin/soporte/${numero}/mensajes`, {
        mensaje: 'Hola, Camilo. Ya lo aprobamos: tu licencia está activa.',
      })
      .expect(200);
    visto = await cliente.web.get(`/soporte/${numero}`).expect(200);
    expect(visto.body.estado).toBe('RESPONDIDO');
    expect(visto.body.cuenta).toMatchObject({ id: cuenta.body.id });
    expect(visto.body.mensajes.map((m: { autor: string }) => m.autor)).toEqual([
      'Tú',
      'DocTrader Pro',
    ]);
    expect(visto.body.mensajes[0].adjuntos).toHaveLength(1);
    const [respuesta] = await correos(cliente.correo, 'ticket-respondido');
    expect(respuesta?.payload).toMatchObject({
      numero: String(numero),
      mensaje: 'Hola, Camilo. Ya lo aprobamos: tu licencia está activa.',
    });

    // El cliente baja su captura: es el PNG que subió, como descarga y con su nombre.
    const bajada = await descargar(cliente.web, captura.body.id);
    expect(bajada.headers['content-disposition']).toMatch(/^attachment;/);
    expect(bajada.headers['content-type']).toBe('image/png');
    expect((await sharp(bajada.body as Buffer).metadata()).width).toBe(40);

    // El cliente responde (vuelve a sin responder), lo marca resuelto y luego lo reabre escribiendo.
    await cliente.web.post(`/soporte/${numero}/mensajes`, { mensaje: '¡Gracias!' }).expect(200);
    expect((await admin.web.get(`/admin/soporte/${numero}`).expect(200)).body.estado).toBe(
      'ABIERTO',
    );
    await cliente.web.post(`/soporte/${numero}/resolver`).expect(200);
    visto = await cliente.web.get(`/soporte/${numero}`).expect(200);
    expect(visto.body.estado).toBe('RESUELTO');
    expect(visto.body.cierraEn).not.toBeNull();
    await cliente.web
      .post(`/soporte/${numero}/mensajes`, { mensaje: 'Perdón, la cuenta sigue sin conectar.' })
      .expect(200);
    expect((await cliente.web.get(`/soporte/${numero}`)).body.estado).toBe('ABIERTO');
    expect(await correos(admin.usuario.email, 'ticket-reabierto')).toHaveLength(1);

    // El admin lo resuelve: correo al cliente con la fecha de cierre.
    await admin.web.post(`/admin/soporte/${numero}/resolver`).expect(200);
    const [resuelto] = await correos(cliente.correo, 'ticket-resuelto');
    expect(resuelto?.payload.cierre).toMatch(/\d{4}/);

    // Pasan los días sin respuesta: el worker lo cierra y ya no recibe mensajes.
    await fuente.query(
      `UPDATE tickets SET resolved_at = now() - interval '8 days' WHERE number = $1`,
      [numero],
    );
    expect(await app.get(SoporteService).cerrarResueltos()).toBeGreaterThanOrEqual(1);
    visto = await cliente.web.get(`/soporte/${numero}`).expect(200);
    expect(visto.body.estado).toBe('CERRADO');
    const tarde = await cliente.web
      .post(`/soporte/${numero}/mensajes`, { mensaje: 'Hola de nuevo' })
      .expect(409);
    expect(tarde.body.codigo).toBe('TICKET_CERRADO');

    // La primera respuesta quedó registrada para el promedio de la semana.
    const resumen = await admin.web.get('/admin/soporte?vista=resueltos').expect(200);
    expect(resumen.body.primeraRespuestaMinutos).not.toBeNull();
  });

  it('los adjuntos se revisan por su contenido y las imágenes pierden sus metadatos', async () => {
    const cliente = await clienteConSesion(app);

    // Sin ficha (o con una alterada) no se sube nada, aunque la ruta no pida el secreto de la web.
    await request(app.getHttpServer())
      .post('/archivos/subir')
      .set('content-type', 'application/octet-stream')
      .send(await png())
      .expect(401);

    // Un SVG o un texto que se llaman .png no pasan.
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    expect((await subir(cliente.web, svg, 'captura.png', 415)).body.codigo).toBe(
      'TIPO_NO_PERMITIDO',
    );
    // Un PNG roto tampoco.
    const roto = Buffer.concat([(await png()).subarray(0, 40), Buffer.alloc(40)]);
    expect((await subir(cliente.web, roto, 'roto.png', 415)).body.codigo).toBe('IMAGEN_DANADA');
    // Más de 10 MB se rechaza antes de leerlo.
    const grande = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(10 * 1024 * 1024)]);
    expect((await subir(cliente.web, grande, 'grande.pdf', 413)).body.codigo).toBe(
      'ARCHIVO_GRANDE',
    );

    // Un JPG con datos EXIF (como la ubicación de una foto) se guarda sin ellos.
    const foto = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#000' } })
      .jpeg()
      .withExif({ IFD0: { Copyright: 'Ubicación secreta' } })
      .toBuffer();
    expect((await sharp(foto).metadata()).exif).toBeDefined();
    const subida = await subir(cliente.web, foto, 'foto.jpeg');
    expect(subida.body).toMatchObject({ nombre: 'foto.jpg', tipo: 'image/jpeg' });

    // Un PDF pasa tal cual.
    const pdf = await subir(cliente.web, Buffer.from('%PDF-1.4\n%%EOF\n'), 'comprobante.pdf');
    expect(pdf.body.tipo).toBe('application/pdf');

    const ticket = await cliente.web
      .post('/soporte', {
        tema: 'TECNICO',
        asunto: 'Fotos de la pantalla',
        mensaje: 'Les mando la foto y el comprobante.',
        adjuntos: [subida.body.id, pdf.body.id],
      })
      .expect(201);
    const bajada = await descargar(cliente.web, subida.body.id);
    expect((await sharp(bajada.body as Buffer).metadata()).exif).toBeUndefined();

    // Otro cliente no puede usar esos archivos ni bajarlos, y un archivo no se adjunta dos veces.
    const otro = await clienteConSesion(app);
    const ajeno = await otro.web
      .post('/soporte', {
        tema: 'OTRO',
        asunto: 'Archivo ajeno',
        mensaje: 'Intento usar el archivo de otro.',
        adjuntos: [pdf.body.id],
      })
      .expect(409);
    expect(ajeno.body.codigo).toBe('ADJUNTO_NO_DISPONIBLE');
    await otro.web.get(`/archivos/${pdf.body.id}/enlace`).expect(404);
    await cliente.web
      .post(`/soporte/${ticket.body.numero}/mensajes`, {
        mensaje: 'Otra vez',
        adjuntos: [pdf.body.id],
      })
      .expect(409);
    // El ticket fallido no quedó creado a medias.
    expect((await otro.web.get('/soporte').expect(200)).body.tickets).toHaveLength(0);
  });

  it('los datos del ticket se validan y cada quien ve solo lo suyo', async () => {
    const cliente = await clienteConSesion(app);
    const otro = await clienteConSesion(app);
    const cuentaAjena = await otro.web.post('/cuentas', datosCuenta()).expect(201);

    const corto = await cliente.web
      .post('/soporte', { tema: 'PAGOS', asunto: 'Hola', mensaje: 'Corto' })
      .expect(400);
    expect(Object.keys(corto.body.campos)).toEqual(expect.arrayContaining(['asunto', 'mensaje']));
    const ajena = await cliente.web
      .post('/soporte', {
        tema: 'CONEXION',
        asunto: 'Conectar mi cuenta',
        mensaje: 'Quiero conectar esta cuenta.',
        cuentaId: cuentaAjena.body.id,
      })
      .expect(400);
    expect(ajena.body.campos.cuentaId).toBeDefined();
    await cliente.web
      .post('/soporte', {
        tema: 'NADA',
        asunto: 'Tema raro',
        mensaje: 'Con un tema que no existe.',
      })
      .expect(400);

    const propio = await cliente.web
      .post('/soporte', {
        tema: 'LICENCIA',
        asunto: 'Mi licencia',
        mensaje: '¿Cuándo vence mi licencia?',
      })
      .expect(201);
    await otro.web.get(`/soporte/${propio.body.numero}`).expect(404);
    await otro.web.post(`/soporte/${propio.body.numero}/mensajes`, { mensaje: 'Hola' }).expect(404);
    await cliente.web.get('/soporte/abc').expect(404);
    // La bandeja es solo de admins.
    await cliente.web.get('/admin/soporte').expect(403);
  });

  it('asignar, prioridad, respuestas guardadas y días de cierre', async () => {
    const cliente = await clienteConSesion(app);
    const admin = await adminConSesion(app);
    const { body } = await cliente.web
      .post('/soporte', {
        tema: 'OTRO',
        asunto: 'Una consulta',
        mensaje: 'Tengo una consulta general.',
      })
      .expect(201);
    const numero = body.numero as number;

    const noAdmin = await admin.web
      .put(`/admin/soporte/${numero}`, { asignadoA: cliente.usuario.id })
      .expect(400);
    expect(noAdmin.body.campos.asignadoA).toBeDefined();
    await admin.web
      .put(`/admin/soporte/${numero}`, { asignadoA: admin.usuario.id, prioridad: 'ALTA' })
      .expect(200);
    const ficha = await admin.web.get(`/admin/soporte/${numero}`).expect(200);
    expect(ficha.body).toMatchObject({ asignadoA: admin.usuario.id, prioridad: 'ALTA' });
    expect(ficha.body.cliente.correo).toBe(cliente.correo);
    expect(ficha.body.respuestas.length).toBeGreaterThanOrEqual(4);
    // Alta prioridad va primero entre los que esperan.
    const bandeja = await admin.web.get('/admin/soporte').expect(200);
    expect(bandeja.body.tickets[0].numero).toBe(numero);
    expect(bandeja.body.siguiente).toBe(numero);
    await admin.web.put(`/admin/soporte/${numero}`, { asignadoA: null }).expect(200);
    expect((await admin.web.get(`/admin/soporte/${numero}`)).body.asignadoA).toBeNull();

    const creada = await admin.web
      .post('/admin/respuestas', { titulo: 'Saludo', cuerpo: 'Hola. Gracias por escribirnos.' })
      .expect(201);
    const repetida = await admin.web
      .post('/admin/respuestas', { titulo: 'saludo', cuerpo: 'Otro saludo distinto.' })
      .expect(409);
    expect(repetida.body.campos.titulo).toBeDefined();
    await admin.web
      .put(`/admin/respuestas/${creada.body.id}`, {
        titulo: 'Saludo inicial',
        cuerpo: 'Hola. Gracias por escribirnos; ya lo revisamos.',
      })
      .expect(200);
    let lista = await admin.web.get('/admin/respuestas').expect(200);
    expect(lista.body.map((r: { titulo: string }) => r.titulo)).toContain('Saludo inicial');
    await admin.web.delete(`/admin/respuestas/${creada.body.id}`).expect(200);
    lista = await admin.web.get('/admin/respuestas').expect(200);
    expect(lista.body.map((r: { titulo: string }) => r.titulo)).not.toContain('Saludo inicial');

    await admin.web.put('/admin/ajustes/soporte', { diasCierre: 0 }).expect(400);
    await admin.web.put('/admin/ajustes/soporte', { diasCierre: 10 }).expect(200);
    const ajustes = await admin.web.get('/admin/ajustes').expect(200);
    expect(ajustes.body.diasCierreTickets).toBe(10);
    await admin.web.put('/admin/ajustes/soporte', { diasCierre: 7 }).expect(200);
  });
});
