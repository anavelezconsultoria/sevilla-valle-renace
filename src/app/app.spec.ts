import { TestBed } from '@angular/core/testing';
import { DemoBackend } from './infrastructure/demo/demo-backend';
import { Categoria, CierreAtencion, EstadoNecesidad, NuevaNecesidad, TipoEvento, Urgencia } from './core/domain/necesidad.model';
import { desplazarCoordenada, DESPLAZAMIENTO_MAX_M, DESPLAZAMIENTO_MIN_M, generarCodigoSeguimiento } from './core/domain/privacidad';
import { enmascararTelefono, motivoClaveInvalida } from './core/domain/clave-solicitante';
import { ErrorAccesoSolicitante } from './core/ports/necesidades.ports';
import { accionesDelAyudante, accionesDelSolicitante, HORAS_PARA_CONFIRMAR, HORAS_PARA_ENTREGAR } from './core/domain/ciclo-de-vida';
import { filtrarNecesidades } from './core/application/filtrar-necesidades';
import { calcularDimensiones } from './shared/lib/imagen';
import { CENTRO_SEVILLA } from './core/domain/catalogos';

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

    await backend.iniciarSesion({ celular: '3001112222', alias: 'Ayudante de prueba' });
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

    await backend.iniciarSesion({ celular: '3001112222', alias: 'A' });
    await backend.tomar(necesidad.id);
    await backend.entregar({ necesidadId: necesidad.id, nota: 'Listo', fotos: [] });
    const final = await backend.confirmarRecibida({ necesidadId: necesidad.id, credencial: { tipo: 'clave', ...ACCESO } });
    expect(final.cierre).toBe(CierreAtencion.Confirmada);
  });

  it('con una clave equivocada no se ve ni se confirma nada, aunque se conozca el celular', async () => {
    const { necesidad } = await backend.registrar(NUEVA);
    const ajena = { telefono: ACCESO.telefono, clave: '8642' };
    await expect(backend.misNecesidades(ajena)).rejects.toBeInstanceOf(ErrorAccesoSolicitante);

    await backend.iniciarSesion({ celular: '3001112222', alias: 'A' });
    await backend.tomar(necesidad.id);
    await backend.entregar({ necesidadId: necesidad.id, nota: 'Listo', fotos: [] });
    await expect(
      backend.confirmarRecibida({ necesidadId: necesidad.id, credencial: { tipo: 'clave', ...ajena } }),
    ).rejects.toBeInstanceOf(ErrorAccesoSolicitante);
    expect(backend.obtener(necesidad.id)?.estado).toBe(EstadoNecesidad.Entregada);
  });

  it('nadie puede tomar una necesidad que ya esta en atencion', async () => {
    const { necesidad } = await backend.registrar(NUEVA);
    await backend.iniciarSesion({ celular: '3001112222', alias: 'A' });
    await backend.tomar(necesidad.id);
    await backend.iniciarSesion({ celular: '3003334444', alias: 'B' });
    await expect(backend.tomar(necesidad.id)).rejects.toThrow();
    await expect(backend.contacto(necesidad.id)).rejects.toThrow();
  });

  it('libera la toma vencida y cierra la entrega sin reclamo a las 48 horas', async () => {
    const { necesidad } = await backend.registrar(NUEVA);
    await backend.iniciarSesion({ celular: '3001112222', alias: 'A' });
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

  it('el filtro publico ordena por urgencia y no expone datos de contacto', () => {
    const lista = filtrarNecesidades(backend.todas(), {});
    expect(lista[0]?.urgencia).toBe(Urgencia.Alta);
    expect(JSON.stringify(lista)).not.toContain('3000000000');
  });
});
