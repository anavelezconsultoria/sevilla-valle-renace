import { TestBed } from '@angular/core/testing';
import { DemoBackend } from './infrastructure/demo/demo-backend';
import { Categoria, CierreAtencion, EstadoNecesidad, NuevaNecesidad, TipoEvento, Urgencia } from './core/domain/necesidad.model';
import { desplazarCoordenada, DESPLAZAMIENTO_MAX_M, DESPLAZAMIENTO_MIN_M, generarCodigoSeguimiento } from './core/domain/privacidad';
import { enmascararTelefono, motivoClaveInvalida } from './core/domain/clave-solicitante';
import { ErrorAccesoSolicitante, ErrorClaveDistinta, ErrorCliente, ReporteErrores } from './core/ports/necesidades.ports';
import { ManejadorErrores } from './infrastructure/errores/manejador-errores';
import { DemoComunidad } from './infrastructure/demo/demo-comunidad';
import { esArchivoDeVersionVieja } from './infrastructure/errores/version-nueva';
import { accionesDelAyudante, accionesDelSolicitante, HORAS_PARA_CONFIRMAR, HORAS_PARA_ENTREGAR, puedeExtenderPlazo } from './core/domain/ciclo-de-vida';
import { filtrarNecesidades } from './core/application/filtrar-necesidades';
import { calcularDimensiones } from './shared/lib/imagen';
import { CENTRO_SEVILLA } from './core/domain/catalogos';
import { validarSectorSinDireccion } from './shared/lib/validaciones';

function distanciaMetros(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

const NUEVA: NuevaNecesidad = {
  categoria: Categoria.Agua,
  titulo: 'Agua para la semana',
  descripcion: 'Se rompió el tanque con el temblor',
  urgencia: Urgencia.Alta,
  personasHogar: 4,
  prioridadCero: false,
  sector: 'Sector de prueba',
  ubicacion: CENTRO_SEVILLA,
  contacto: { nombre: 'Prueba', telefono: '3157770000', referencias: '', clave: '5793' },
};

const ACCESO = { telefono: '3157770000', clave: '5793' } as const;

describe('Privacidad', () => {
  it('desplaza la ubicacion publica entre 150 y 300 metros', () => {
    for (let i = 0; i < 200; i++) {
      const d = distanciaMetros(CENTRO_SEVILLA, desplazarCoordenada(CENTRO_SEVILLA));
      expect(d).toBeGreaterThanOrEqual(DESPLAZAMIENTO_MIN_M - 1);
      expect(d).toBeLessThanOrEqual(DESPLAZAMIENTO_MAX_M + 1);
    }
  });

  it('genera llaves internas sin caracteres ambiguos', () => {
    const codigo = generarCodigoSeguimiento();
    expect(codigo).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  });
});

describe('Mas tiempo para entregar', () => {
  let backend: DemoBackend;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    backend = TestBed.inject(DemoBackend);
  });

  it('quien atiende pide 24 horas mas una sola vez por toma', async () => {
    const { necesidad } = await backend.registrar(NUEVA);
    await backend.iniciarSesion({ celular: '3001112222', clave: '5793', alias: 'Nana' });
    const tomada = await backend.tomar(necesidad.id);
    expect(puedeExtenderPlazo(tomada)).toBe(true);
    const extendida = await backend.extenderPlazo(necesidad.id);
    expect(new Date(extendida.venceEn!).getTime() - new Date(tomada.venceEn!).getTime()).toBe(24 * 3_600_000);
    expect(puedeExtenderPlazo(extendida)).toBe(false);
    await expect(backend.extenderPlazo(necesidad.id)).rejects.toThrow();
    expect(extendida.eventos.at(-1)).toMatchObject({ tipo: TipoEvento.PlazoExtendido, actor: 'Nana' });
  });
});

describe('Sector publico sin direccion', () => {
  it('rechaza direcciones y celulares, acepta barrios y veredas', () => {
    expect(validarSectorSinDireccion('Margaritas calle 46 #37-49')).not.toBeNull();
    expect(validarSectorSinDireccion('Cra 52 15-20')).not.toBeNull();
    expect(validarSectorSinDireccion('vereda el cebollal 3108380281')).not.toBeNull();
    expect(validarSectorSinDireccion('Barrio Las Margaritas')).toBeNull();
    expect(validarSectorSinDireccion('Vereda La Melva')).toBeNull();
    expect(validarSectorSinDireccion('Las margaritas primera etapa')).toBeNull();
  });
});

describe('Clave del solicitante', () => {
  it('exige 4 numeros', () => {
    expect(motivoClaveInvalida({ clave: '123', telefono: '3157770000' })).toContain('4 números');
    expect(motivoClaveInvalida({ clave: '12a4', telefono: '3157770000' })).toContain('4 números');
  });

  it('rechaza claves obvias y el final del celular, que quien ayuda puede ver', () => {
    expect(motivoClaveInvalida({ clave: '1234', telefono: '3157770000' })).toContain('fácil');
    expect(motivoClaveInvalida({ clave: '0000', telefono: '3157770000' })).toContain('fácil');
    expect(motivoClaveInvalida({ clave: '6789', telefono: '3001236789' })).toContain('final de tu celular');
  });

  it('acepta una clave valida', () => {
    expect(motivoClaveInvalida({ clave: '5793', telefono: '3157770000' })).toBeNull();
  });

  it('enmascara el celular dejando visibles el inicio y el final', () => {
    expect(enmascararTelefono('315 777 0000')).toBe('315 ••• 0000');
  });
});

describe('Ciclo de vida', () => {
  it('solo el ayudante asignado puede entregar o liberar', () => {
    expect(accionesDelAyudante({ estado: EstadoNecesidad.Registrada, esAsignado: false })).toEqual(['tomar']);
    expect(accionesDelAyudante({ estado: EstadoNecesidad.EnAtencion, esAsignado: false })).toEqual([]);
    expect(accionesDelAyudante({ estado: EstadoNecesidad.EnAtencion, esAsignado: true })).toEqual(['entregar', 'liberar']);
  });

  it('el solicitante confirma o reclama solo despues de la entrega', () => {
    expect(accionesDelSolicitante(EstadoNecesidad.Registrada)).toEqual(['cancelar']);
    expect(accionesDelSolicitante(EstadoNecesidad.Entregada)).toEqual(['confirmar', 'no_recibida']);
    expect(accionesDelSolicitante(EstadoNecesidad.Atendida)).toEqual([]);
  });
});

describe('Imagenes de evidencia', () => {
  it('reduce el lado mayor sin agrandar fotos pequenas', () => {
    expect(calcularDimensiones(4000, 3000, 1280)).toEqual({ ancho: 1280, alto: 960 });
    expect(calcularDimensiones(800, 600, 1280)).toEqual({ ancho: 800, alto: 600 });
  });
});

describe('Flujo completo en modo demostracion', () => {
  let backend: DemoBackend;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    backend = TestBed.inject(DemoBackend);
  });

  it('registrar, tomar, entregar y confirmar deja la necesidad atendida con historial', async () => {
    const { necesidad, codigoDispositivo } = await backend.registrar(NUEVA);
    expect(distanciaMetros(necesidad.ubicacionAproximada, CENTRO_SEVILLA)).toBeGreaterThan(100);

    await backend.iniciarSesion({ celular: '3001112222', clave: '5793', alias: 'Ayudante de prueba' });
    await backend.tomar(necesidad.id);
    const contacto = await backend.contacto(necesidad.id);
    expect(contacto.telefono).toBe('3157770000');
    expect(JSON.stringify(contacto)).not.toContain(NUEVA.contacto.clave);
    await backend.entregar({ necesidadId: necesidad.id, nota: 'Entregado', fotos: [] });
    const final = await backend.confirmarRecibida({ necesidadId: necesidad.id, credencial: { tipo: 'dispositivo', codigo: codigoDispositivo } });

    expect(final.estado).toBe(EstadoNecesidad.Atendida);
    expect(final.cierre).toBe(CierreAtencion.Confirmada);
    expect(final.eventos.map((e) => e.tipo)).toEqual([
      TipoEvento.Registrada,
      TipoEvento.Tomada,
      TipoEvento.Entregada,
      TipoEvento.Confirmada,
    ]);
  });

  it('desde otro celular se entra y se confirma con celular y clave', async () => {
    const { necesidad } = await backend.registrar(NUEVA);
    const propias = await backend.misNecesidades(ACCESO);
    expect(propias.map((n) => n.id)).toEqual([necesidad.id]);

    await backend.iniciarSesion({ celular: '3001112222', clave: '5793', alias: 'A' });
    await backend.tomar(necesidad.id);
    await backend.entregar({ necesidadId: necesidad.id, nota: 'Listo', fotos: [] });
    const final = await backend.confirmarRecibida({ necesidadId: necesidad.id, credencial: { tipo: 'clave', ...ACCESO } });
    expect(final.cierre).toBe(CierreAtencion.Confirmada);
  });

  it('con una clave equivocada no se ve ni se confirma nada, aunque se conozca el celular', async () => {
    const { necesidad } = await backend.registrar(NUEVA);
    const ajena = { telefono: ACCESO.telefono, clave: '8642' };
    await expect(backend.misNecesidades(ajena)).rejects.toBeInstanceOf(ErrorAccesoSolicitante);

    await backend.iniciarSesion({ celular: '3001112222', clave: '5793', alias: 'A' });
    await backend.tomar(necesidad.id);
    await backend.entregar({ necesidadId: necesidad.id, nota: 'Listo', fotos: [] });
    await expect(
      backend.confirmarRecibida({ necesidadId: necesidad.id, credencial: { tipo: 'clave', ...ajena } }),
    ).rejects.toBeInstanceOf(ErrorAccesoSolicitante);
    expect(backend.obtener(necesidad.id)?.estado).toBe(EstadoNecesidad.Entregada);
  });

  it('prioridad 0 (bebes o adultos mayores) va primero aunque sea menos urgente', async () => {
    const urgente = await backend.registrar({ ...NUEVA, titulo: 'Urgente sin prioridad' });
    const prioridad = await backend.registrar({ ...NUEVA, titulo: 'Leche para bebe', urgencia: Urgencia.Baja, prioridadCero: true });
    const lista = filtrarNecesidades(backend.todas(), { estados: [EstadoNecesidad.Registrada] });
    const ids = lista.map((n) => n.id);
    expect(ids.indexOf(prioridad.necesidad.id)).toBeLessThan(ids.indexOf(urgente.necesidad.id));
  });

  it('un celular usa una sola clave para todas sus solicitudes', async () => {
    await backend.registrar(NUEVA);
    await expect(backend.registrar({ ...NUEVA, contacto: { ...NUEVA.contacto, clave: '8642' } })).rejects.toBeInstanceOf(ErrorClaveDistinta);
    await expect(backend.registrar(NUEVA)).resolves.toBeDefined();
  });

  it('solo la coordinacion asigna una clave nueva, y la vieja deja de servir', async () => {
    await backend.registrar(NUEVA);
    await backend.iniciarSesion({ celular: '3001112222', clave: '5793', alias: 'Ayudante' });
    await expect(backend.restablecerClave({ telefono: ACCESO.telefono, clave: '7319' })).rejects.toThrow();
    await backend.iniciarSesion({ celular: '3000000001', clave: '5793', alias: 'Coordinacion' });
    await expect(backend.restablecerClave({ telefono: ACCESO.telefono, clave: '7319' })).resolves.toBe(1);
    await expect(backend.misNecesidades({ telefono: ACCESO.telefono, clave: '7319' })).resolves.toHaveLength(1);
    await expect(backend.misNecesidades(ACCESO)).rejects.toBeInstanceOf(ErrorAccesoSolicitante);
  });

  it('nadie puede tomar una necesidad que ya esta en atencion', async () => {
    const { necesidad } = await backend.registrar(NUEVA);
    await backend.iniciarSesion({ celular: '3001112222', clave: '5793', alias: 'A' });
    await backend.tomar(necesidad.id);
    await backend.iniciarSesion({ celular: '3003334444', clave: '5793', alias: 'B' });
    await expect(backend.tomar(necesidad.id)).rejects.toThrow();
    await expect(backend.contacto(necesidad.id)).rejects.toThrow();
  });

  it('libera la toma vencida y cierra la entrega sin reclamo a las 48 horas', async () => {
    const { necesidad } = await backend.registrar(NUEVA);
    await backend.iniciarSesion({ celular: '3001112222', clave: '5793', alias: 'A' });
    await backend.tomar(necesidad.id);
    backend.aplicarVencimientos(new Date(Date.now() + (HORAS_PARA_ENTREGAR + 1) * 3_600_000));
    expect(backend.obtener(necesidad.id)?.estado).toBe(EstadoNecesidad.Registrada);

    await backend.tomar(necesidad.id);
    await backend.entregar({ necesidadId: necesidad.id, nota: 'Listo', fotos: [] });
    backend.aplicarVencimientos(new Date(Date.now() + (HORAS_PARA_CONFIRMAR + 1) * 3_600_000));
    const cerrada = backend.obtener(necesidad.id);
    expect(cerrada?.estado).toBe(EstadoNecesidad.Atendida);
    expect(cerrada?.cierre).toBe(CierreAtencion.Automatica);
  });

  it('el filtro publico ordena por fecha (la mas antigua primero) y no expone datos de contacto', () => {
    const lista = filtrarNecesidades(backend.todas(), {});
    const fechas = lista.map((n) => new Date(n.registradaEn).getTime());
    expect(fechas).toEqual([...fechas].sort((a, b) => a - b));
    expect(JSON.stringify(lista)).not.toContain('3000000000');
  });
});

describe('Repartir mejor la ayuda', () => {
  let backend: DemoBackend;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    backend = TestBed.inject(DemoBackend);
  });

  async function recibirAyuda(): Promise<string> {
    const { necesidad, codigoDispositivo } = await backend.registrar(NUEVA);
    await backend.iniciarSesion({ celular: '3001112222', clave: '5793', alias: 'Nana' });
    await backend.tomar(necesidad.id);
    await backend.entregar({ necesidadId: necesidad.id, nota: 'Listo', fotos: [] });
    await backend.confirmarRecibida({ necesidadId: necesidad.id, credencial: { tipo: 'dispositivo', codigo: codigoDispositivo } });
    return necesidad.id;
  }

  it('la primera solicitud se publica y se marca como primera', async () => {
    const { necesidad } = await backend.registrar(NUEVA);
    expect(necesidad.estado).toBe(EstadoNecesidad.Registrada);
    expect(necesidad.primeraSolicitud).toBe(true);
  });

  it('la misma categoria despues de recibirla queda en revision y no es publica', async () => {
    await recibirAyuda();
    const { necesidad } = await backend.registrar({ ...NUEVA, titulo: 'Agua otra vez', descripcion: 'Se nos acabó el agua de nuevo' });
    expect(necesidad.estado).toBe(EstadoNecesidad.EnRevision);
    expect(backend.todas().some((n) => n.id === necesidad.id)).toBe(false);
    expect(backend.obtener(necesidad.id)?.estado).toBe(EstadoNecesidad.EnRevision);
    await expect(backend.tomar(necesidad.id)).rejects.toThrow();
  });

  it('otra categoria se publica con la senal de ayuda reciente', async () => {
    await recibirAyuda();
    const { necesidad } = await backend.registrar({ ...NUEVA, categoria: Categoria.Ropa, titulo: 'Cobijas', descripcion: 'Necesitamos cobijas para la noche' });
    expect(necesidad.estado).toBe(EstadoNecesidad.Registrada);
    expect(necesidad.primeraSolicitud).toBe(false);
    expect(necesidad.ayudaRecienteCategoria).toBe(Categoria.Agua);
  });

  it('la coordinacion la ve en revision y al aprobarla se publica', async () => {
    await recibirAyuda();
    const { necesidad } = await backend.registrar({ ...NUEVA, titulo: 'Agua otra vez', descripcion: 'Se nos acabó el agua de nuevo' });
    await backend.iniciarSesion({ celular: '3000000001', clave: '5793', alias: 'Coordinacion' });
    const pendientes = await backend.solicitudesEnRevision();
    expect(pendientes.map((p) => p.necesidadId)).toContain(necesidad.id);
    expect(pendientes[0]?.motivo).toContain('Recibió agua');
    await backend.revisar({ necesidadId: necesidad.id, aprobar: true });
    expect(backend.todas().find((n) => n.id === necesidad.id)?.estado).toBe(EstadoNecesidad.Registrada);
    const historial = await backend.historial(NUEVA.contacto.telefono);
    expect(historial.solicitudes.length).toBe(2);
  });

  it('un ayudante comun no ve las solicitudes en revision', async () => {
    await backend.iniciarSesion({ celular: '3001112222', clave: '5793', alias: 'Nana' });
    await expect(backend.solicitudesEnRevision()).rejects.toThrow();
  });

  it('la lista va por fecha de solicitud, primero la mas antigua', async () => {
    await recibirAyuda();
    // La que tiene ayuda reciente pero es mas antigua va primero: manda la fecha.
    await backend.registrar({ ...NUEVA, categoria: Categoria.Ropa, titulo: 'Cobijas', descripcion: 'Necesitamos cobijas para la noche' });
    await backend.registrar({ ...NUEVA, categoria: Categoria.Ropa, titulo: 'Ropa', descripcion: 'Necesitamos ropa para los niños', contacto: { ...NUEVA.contacto, telefono: '3158880000' } });
    const lista = filtrarNecesidades(backend.todas(), { estados: [EstadoNecesidad.Registrada] });
    const fechas = lista.map((n) => new Date(n.registradaEn).getTime());
    expect(fechas).toEqual([...fechas].sort((a, b) => a - b));
  });

  it('reconoce a quien entrego', async () => {
    await recibirAyuda();
    const vecinos = await backend.vecinosQueAyudan();
    expect(vecinos.find((v) => v.alias === 'Nana')?.entregas).toBe(1);
  });
});

describe('Registro de errores de la pagina', () => {
  it('reporta cada error distinto una vez y nunca rompe la pagina', async () => {
    const reportados: ErrorCliente[] = [];
    TestBed.configureTestingModule({
      providers: [
        ManejadorErrores,
        {
          provide: ReporteErrores,
          useValue: {
            reportar: async (e: ErrorCliente) => {
              reportados.push(e);
              throw new Error('sin conexion');
            },
          },
        },
      ],
    });
    const manejador = TestBed.inject(ManejadorErrores);
    const consola = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => {
      manejador.handleError(new TypeError('x.toSorted is not a function'));
      manejador.handleError(new TypeError('x.toSorted is not a function'));
      manejador.handleError('otro error');
    }).not.toThrow();
    await Promise.resolve();
    consola.mockRestore();
    expect(reportados.map((r) => r.mensaje)).toEqual(['x.toSorted is not a function', 'otro error']);
    expect(reportados[0]?.ruta).not.toContain('?');
  });
});

describe('Muro de la comunidad (demo)', () => {
  it('publica solo entregas y confirmaciones, sin datos de la familia', async () => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    const comunidad = TestBed.inject(DemoComunidad);
    const muro = await comunidad.muro({ limite: 50 });
    expect(muro.length).toBeGreaterThan(0);
    expect(muro.every((p) => p.tipo === 'entrega' || p.tipo === 'confirmacion')).toBe(true);
    expect(JSON.stringify(muro)).not.toMatch(/3\d{9}/);
    const primera = muro[0]!;
    expect(await comunidad.darGracias(primera.eventoId)).toBe(primera.gracias + 1);
  });
});

describe('Version nueva publicada', () => {
  it('reconoce el error de archivo viejo en Android, iPhone y Firefox', () => {
    expect(esArchivoDeVersionVieja(new TypeError('Failed to fetch dynamically imported module: https://x/chunk-A.js'))).toBe(true);
    expect(esArchivoDeVersionVieja(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(esArchivoDeVersionVieja(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(esArchivoDeVersionVieja(new TypeError('x.toSorted is not a function'))).toBe(false);
  });
});
