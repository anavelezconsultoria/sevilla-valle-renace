import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import {
  AccesoSolicitante,
  CierreAtencion,
  CifrasPublicas,
  ContactoPrivado,
  EstadoNecesidad,
  EventoNecesidad,
  FiltroNecesidades,
  Necesidad,
  NuevaNecesidad,
  RegistroResultado,
  TipoEvento,
} from '../../core/domain/necesidad.model';
import {
  HORAS_EXTRA,
  HORAS_PARA_CONFIRMAR,
  HORAS_PARA_ENTREGAR,
  puedeExtenderPlazo,
  sumarHoras,
} from '../../core/domain/ciclo-de-vida';
import { ayudaReciente, motivoRevision } from '../../core/domain/revision-hogar';
import { ultimo } from '../../core/domain/listas';
import { desplazarCoordenada, generarCodigoSeguimiento } from '../../core/domain/privacidad';
import { soloDigitos } from '../../core/domain/clave-solicitante';
import {
  AccionSolicitante,
  AdjuntosPayload,
  AtencionEnCurso,
  Ayudante,
  AyudanteGateway,
  CoordinacionGateway,
  EntregaPayload,
  ErrorAccesoSolicitante,
  ErrorClaveDistinta,
  ErrorRegistrado,
  HistorialCelular,
  HogarAtendido,
  ReconocimientoLectura,
  RestablecerClavePayload,
  RevisarPayload,
  SolicitudEnRevision,
  VecinoQueAyuda,
  InicioSesionPayload,
  ModoDatos,
  NecesidadesLectura,
  NoRecibidaPayload,
  SesionGateway,
  SolicitanteGateway,
} from '../../core/ports/necesidades.ports';
import { filtrarNecesidades } from '../../core/application/filtrar-necesidades';
import { calcularCifras } from '../../core/application/calcular-cifras';
import { crearSemillaDemo, RegistroDemo } from './demo-semilla';

const CLAVE_ALMACEN = 'sevilla-renace-demo-v6';
const CLAVE_SESION = 'sevilla-renace-demo-sesion';
const INTERVALO_VENCIMIENTOS_MS = 60_000;

/** En demo las fotos se guardan como data URL para sobrevivir a una recarga. */
function blobADataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result));
    lector.onerror = () => reject(new Error('No se pudo leer la foto.'));
    lector.readAsDataURL(blob);
  });
}

interface Transicion {
  readonly registro: RegistroDemo;
  readonly estado: EstadoNecesidad;
  readonly evento: Omit<EventoNecesidad, 'id' | 'ocurridoEn'>;
  readonly cambios?: Partial<Necesidad>;
}

/**
 * Backend en memoria para el modo demostracion. Implementa los mismos puertos
 * que el adaptador de Supabase y replica las reglas del ciclo de vida, incluidos
 * los vencimientos que en produccion ejecuta pg_cron.
 */
@Injectable({ providedIn: 'root' })
export class DemoBackend
  implements
    NecesidadesLectura,
    SolicitanteGateway,
    AyudanteGateway,
    CoordinacionGateway,
    ReconocimientoLectura,
    SesionGateway,
    ModoDatos
{
  readonly esDemo = true;
  private readonly registros = signal<RegistroDemo[]>(this.cargar());
  private readonly todasConRevision = computed(() => this.registros().map((r) => r.necesidad));
  /** Lo publico: las solicitudes en revision solo las ve quien las pidio y la coordinacion. */
  readonly todas = computed(() => this.todasConRevision().filter((n) => n.estado !== EstadoNecesidad.EnRevision));
  readonly cargando = signal(false).asReadonly();
  readonly ayudante = signal<Ayudante | null>(this.cargarSesion());

  constructor() {
    this.aplicarVencimientos();
    const temporizador = setInterval(() => this.aplicarVencimientos(), INTERVALO_VENCIMIENTOS_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(temporizador));
  }

  // ---- Lectura publica ----

  filtrar(filtro: FiltroNecesidades): readonly Necesidad[] {
    return filtrarNecesidades(this.todas(), filtro);
  }

  obtener(id: string): Necesidad | undefined {
    return this.todasConRevision().find((n) => n.id === id);
  }

  cifras(): CifrasPublicas {
    return calcularCifras(this.todas());
  }

  // ---- Solicitante ----

  async registrar(nueva: NuevaNecesidad): Promise<RegistroResultado> {
    const delCelular = this.registros().filter((r) => soloDigitos(r.contacto.telefono) === soloDigitos(nueva.contacto.telefono));
    if (delCelular.length && !delCelular.some((r) => r.clave === nueva.contacto.clave)) throw new ErrorClaveDistinta();
    const ahora = new Date().toISOString();
    const id = crypto.randomUUID();
    const codigo = generarCodigoSeguimiento();
    const delHogar = delCelular.map((r) => r.necesidad);
    const motivo = motivoRevision({ categoria: nueva.categoria, delHogar, ahora: new Date(ahora) });
    const eventos: EventoNecesidad[] = [{ id: `${id}-e0`, tipo: TipoEvento.Registrada, ocurridoEn: ahora, actor: 'Solicitante', evidencias: [] }];
    if (motivo) eventos.push({ id: `${id}-e1`, tipo: TipoEvento.EnRevision, ocurridoEn: ahora, actor: 'Sevilla Renace', evidencias: [] });
    const necesidad: Necesidad = {
      id,
      categoria: nueva.categoria,
      titulo: nueva.titulo.trim(),
      descripcion: nueva.descripcion.trim(),
      urgencia: nueva.urgencia,
      personasHogar: nueva.personasHogar,
      prioridadCero: nueva.prioridadCero,
      primeraSolicitud: !delHogar.some((n) => n.estado !== EstadoNecesidad.Cancelada),
      ayudaRecienteCategoria: ayudaReciente(delHogar, new Date(ahora)),
      sector: nueva.sector.trim(),
      ubicacionAproximada: desplazarCoordenada(nueva.ubicacion),
      estado: motivo ? EstadoNecesidad.EnRevision : EstadoNecesidad.Registrada,
      registradaEn: ahora,
      actualizadaEn: ahora,
      eventos,
      fotos: [],
    };
    const { clave, ...datosContacto } = nueva.contacto;
    const contacto: ContactoPrivado = { ...datosContacto, ubicacionExacta: nueva.ubicacion };
    this.guardar([{ necesidad, contacto, codigo, clave, motivoRevision: motivo }, ...this.registros()]);
    return { necesidad, codigoDispositivo: codigo };
  }

  async misNecesidades(acceso: AccesoSolicitante): Promise<readonly Necesidad[]> {
    const propias = this.registros().filter((r) => this.coincideAcceso(r, acceso));
    if (!propias.length) throw new ErrorAccesoSolicitante();
    return propias.map((r) => r.necesidad);
  }

  async confirmarRecibida(accion: AccionSolicitante): Promise<Necesidad> {
    const registro = this.exigirSolicitante(accion, [EstadoNecesidad.Entregada]);
    return this.transicionar({
      registro,
      estado: EstadoNecesidad.Atendida,
      evento: { tipo: TipoEvento.Confirmada, actor: 'Solicitante', evidencias: [] },
      cambios: { cierre: CierreAtencion.Confirmada, venceEn: undefined },
    });
  }

  async reportarNoRecibida({ nota, ...accion }: NoRecibidaPayload): Promise<Necesidad> {
    const registro = this.exigirSolicitante(accion, [EstadoNecesidad.Entregada]);
    return this.transicionar({
      registro,
      estado: EstadoNecesidad.EnAtencion,
      evento: { tipo: TipoEvento.NoRecibida, actor: 'Solicitante', nota, evidencias: [] },
      cambios: { venceEn: sumarHoras(new Date().toISOString(), HORAS_PARA_ENTREGAR) },
    });
  }

  async cancelar(accion: AccionSolicitante): Promise<Necesidad> {
    const registro = this.exigirSolicitante(accion, [EstadoNecesidad.Registrada, EstadoNecesidad.EnRevision]);
    return this.transicionar({
      registro,
      estado: EstadoNecesidad.Cancelada,
      evento: { tipo: TipoEvento.Cancelada, actor: 'Solicitante', evidencias: [] },
    });
  }

  // ---- Ayudante ----

  async tomar(necesidadId: string): Promise<Necesidad> {
    const ayudante = this.exigirSesion();
    const registro = this.exigirEstado(necesidadId, EstadoNecesidad.Registrada);
    return this.transicionar({
      registro: { ...registro, ayudanteId: ayudante.id },
      estado: EstadoNecesidad.EnAtencion,
      evento: { tipo: TipoEvento.Tomada, actor: ayudante.alias, evidencias: [] },
      cambios: { ayudanteAlias: ayudante.alias, venceEn: sumarHoras(new Date().toISOString(), HORAS_PARA_ENTREGAR) },
    });
  }

  async liberar(necesidadId: string): Promise<Necesidad> {
    const ayudante = this.exigirSesion();
    const registro = this.exigirAsignado(necesidadId, ayudante);
    return this.transicionar({
      registro: { ...registro, ayudanteId: undefined },
      estado: EstadoNecesidad.Registrada,
      evento: { tipo: TipoEvento.Liberada, actor: ayudante.alias, evidencias: [] },
      cambios: { ayudanteAlias: undefined, venceEn: undefined },
    });
  }

  async extenderPlazo(necesidadId: string): Promise<Necesidad> {
    const ayudante = this.exigirSesion();
    const registro = this.exigirAsignado(necesidadId, ayudante);
    if (!puedeExtenderPlazo(registro.necesidad)) throw new Error('Ya pediste más tiempo una vez. Si no alcanzas, libérala para que otra persona la tome.');
    return this.transicionar({
      registro,
      estado: EstadoNecesidad.EnAtencion,
      evento: { tipo: TipoEvento.PlazoExtendido, actor: ayudante.alias, evidencias: [] },
      cambios: { venceEn: sumarHoras(registro.necesidad.venceEn ?? new Date().toISOString(), HORAS_EXTRA) },
    });
  }

  async entregar({ necesidadId, nota, fotos }: EntregaPayload): Promise<Necesidad> {
    const ayudante = this.exigirSesion();
    const registro = this.exigirAsignado(necesidadId, ayudante);
    const urls = await Promise.all(fotos.map(blobADataUrl));
    const evidencias = urls.map((url, i) => ({
      id: `${necesidadId}-${Date.now()}-${i}`,
      url,
      descripcion: 'Evidencia de entrega',
    }));
    return this.transicionar({
      registro,
      estado: EstadoNecesidad.Entregada,
      evento: { tipo: TipoEvento.Entregada, actor: ayudante.alias, nota, evidencias },
      cambios: { venceEn: sumarHoras(new Date().toISOString(), HORAS_PARA_CONFIRMAR) },
    });
  }

  /** En demo las fotos se guardan como data URL; el video no se guarda (solo se valida el flujo). */
  async adjuntar({ necesidadId, codigo, fotos }: AdjuntosPayload): Promise<void> {
    const registro = this.registros().find((r) => r.necesidad.id === necesidadId && r.codigo === codigo);
    if (!registro) throw new Error('No se encontró la necesidad.');
    const urls = await Promise.all(fotos.map(blobADataUrl));
    const necesidad = { ...registro.necesidad, fotos: [...registro.necesidad.fotos, ...urls] };
    this.guardar(this.registros().map((r) => (r === registro ? { ...r, necesidad } : r)));
  }

  async videoSolicitud(): Promise<string | null> {
    return null;
  }

  async contacto(necesidadId: string): Promise<ContactoPrivado> {
    const ayudante = this.exigirSesion();
    return this.exigirAsignado(necesidadId, ayudante).contacto;
  }

  // ---- Coordinacion ----

  async restablecerClave({ telefono, clave }: RestablecerClavePayload): Promise<number> {
    if (!this.ayudante()?.esCoordinador) throw new Error('Solo la coordinación puede asignar claves.');
    const delCelular = this.registros().filter((r) => soloDigitos(r.contacto.telefono) === soloDigitos(telefono));
    if (!delCelular.length) throw new Error('Ese celular no está registrado: ni pidió ayuda ni entró a ayudar.');
    this.guardar(this.registros().map((r) => (delCelular.includes(r) ? { ...r, clave } : r)));
    return delCelular.length;
  }

  async solicitudesEnRevision(): Promise<readonly SolicitudEnRevision[]> {
    this.exigirCoordinacion();
    return this.registros()
      .filter((r) => r.necesidad.estado === EstadoNecesidad.EnRevision)
      .map((r) => ({
        necesidadId: r.necesidad.id,
        titulo: r.necesidad.titulo,
        categoria: r.necesidad.categoria,
        sector: r.necesidad.sector,
        registradaEn: r.necesidad.registradaEn,
        nombre: r.contacto.nombre,
        telefono: r.contacto.telefono,
        motivo: r.motivoRevision ?? '',
      }))
      .reverse();
  }

  async revisar({ necesidadId, aprobar }: RevisarPayload): Promise<void> {
    const coordinacion = this.exigirCoordinacion();
    const registro = this.registros().find((r) => r.necesidad.id === necesidadId);
    if (!registro || registro.necesidad.estado !== EstadoNecesidad.EnRevision) throw new Error('Esta solicitud ya no está en revisión.');
    this.transicionar({
      registro,
      estado: aprobar ? EstadoNecesidad.Registrada : EstadoNecesidad.Cancelada,
      evento: { tipo: aprobar ? TipoEvento.RevisionAprobada : TipoEvento.RevisionRechazada, actor: coordinacion.alias, evidencias: [] },
    });
  }

  async historial(telefono: string): Promise<HistorialCelular> {
    this.exigirCoordinacion();
    const digitos = soloDigitos(telefono);
    const propios = this.registros().filter((r) => soloDigitos(r.contacto.telefono) === digitos);
    return {
      solicitudes: propios.map((r) => ({
        id: r.necesidad.id,
        titulo: r.necesidad.titulo,
        categoria: r.necesidad.categoria,
        estado: r.necesidad.estado,
        nombre: r.contacto.nombre,
        sector: r.necesidad.sector,
        registradaEn: r.necesidad.registradaEn,
        entregadaEn: r.necesidad.eventos.find((e) => e.tipo === TipoEvento.Entregada)?.ocurridoEn,
        ayudante: r.necesidad.ayudanteAlias,
        motivoRevision: r.motivoRevision,
      })),
      parecidas: [],
    };
  }

  async hogaresQueRecibieron(): Promise<readonly HogarAtendido[]> {
    this.exigirCoordinacion();
    const porCelular = new Map<string, HogarAtendido>();
    for (const r of this.registros()) {
      const entrega = r.necesidad.eventos.find((e) => e.tipo === TipoEvento.Entregada);
      if (!entrega || (r.necesidad.estado !== EstadoNecesidad.Entregada && r.necesidad.estado !== EstadoNecesidad.Atendida)) continue;
      const telefono = soloDigitos(r.contacto.telefono);
      const previo = porCelular.get(telefono);
      porCelular.set(telefono, {
        telefono,
        nombre: r.contacto.nombre,
        sector: r.necesidad.sector,
        ayudas: (previo?.ayudas ?? 0) + 1,
        ultimaAyuda: previo && previo.ultimaAyuda > entrega.ocurridoEn ? previo.ultimaAyuda : entrega.ocurridoEn,
        categorias: [...new Set([...(previo?.categorias ?? []), r.necesidad.categoria])],
      });
    }
    return [...porCelular.values()].sort((a, b) => b.ultimaAyuda.localeCompare(a.ultimaAyuda));
  }

  async atencionesEnCurso(): Promise<readonly AtencionEnCurso[]> {
    this.exigirCoordinacion();
    return this.registros()
      .filter((r) => r.necesidad.estado === EstadoNecesidad.EnAtencion)
      .map((r) => ({
        necesidadId: r.necesidad.id,
        titulo: r.necesidad.titulo,
        categoria: r.necesidad.categoria,
        sector: r.necesidad.sector,
        prioridadCero: r.necesidad.prioridadCero,
        tomadaEn: ultimo(r.necesidad.eventos, (e) => e.tipo === TipoEvento.Tomada)?.ocurridoEn,
        venceEn: r.necesidad.venceEn,
        ayudanteAlias: r.necesidad.ayudanteAlias ?? 'Voluntario',
        // En la demo el id del ayudante es 'demo-<celular>'.
        ayudanteCelular: r.ayudanteId?.replace('demo-', '') || '3000000000',
      }))
      .sort((a, b) => (a.venceEn ?? '9').localeCompare(b.venceEn ?? '9'));
  }

  async erroresRecientes(): Promise<readonly ErrorRegistrado[]> {
    this.exigirCoordinacion();
    return [];
  }

  // ---- Reconocimiento publico ----

  async vecinosQueAyudan(): Promise<readonly VecinoQueAyuda[]> {
    const porAlias = new Map<string, VecinoQueAyuda>();
    for (const n of this.todas()) {
      if (n.estado !== EstadoNecesidad.Entregada && n.estado !== EstadoNecesidad.Atendida) continue;
      const entrega = n.eventos.find((e) => e.tipo === TipoEvento.Entregada);
      if (!entrega) continue;
      const previo = porAlias.get(entrega.actor);
      porAlias.set(entrega.actor, {
        alias: entrega.actor,
        entregas: (previo?.entregas ?? 0) + 1,
        ultimaEntrega: previo && previo.ultimaEntrega > entrega.ocurridoEn ? previo.ultimaEntrega : entrega.ocurridoEn,
      });
    }
    return [...porAlias.values()].sort((a, b) => b.entregas - a.entregas || b.ultimaEntrega.localeCompare(a.ultimaEntrega));
  }

  misAtenciones(): readonly Necesidad[] {
    const id = this.ayudante()?.id;
    return id ? this.registros().filter((r) => r.ayudanteId === id).map((r) => r.necesidad) : [];
  }

  // ---- Sesion ----

  async iniciarSesion({ celular, alias }: InicioSesionPayload): Promise<void> {
    // En la demo, el celular 3000000001 entra como coordinacion para probar sus herramientas.
    const digitos = celular.replace(/\D/g, '');
    const ayudante: Ayudante = { id: `demo-${digitos}`, alias: alias.trim(), esCoordinador: digitos === '3000000001' };
    this.ayudante.set(ayudante);
    this.escribir(CLAVE_SESION, ayudante);
  }

  async tengoClave(): Promise<boolean> {
    return this.ayudante() !== null;
  }

  async establecerClave(): Promise<void> {
    this.exigirSesion();
  }

  async cerrarSesion(): Promise<void> {
    this.ayudante.set(null);
    this.escribir(CLAVE_SESION, null);
  }

  // ---- Reglas internas ----

  /** Equivalente local del job de pg_cron: libera tomas vencidas y cierra entregas sin reclamo. */
  aplicarVencimientos(ahora: Date = new Date()): void {
    const vencido = (r: RegistroDemo) => r.necesidad.venceEn !== undefined && new Date(r.necesidad.venceEn) <= ahora;
    for (const registro of this.registros().filter(vencido)) {
      if (registro.necesidad.estado === EstadoNecesidad.EnAtencion) {
        this.transicionar({
          registro: { ...registro, ayudanteId: undefined },
          estado: EstadoNecesidad.Registrada,
          evento: { tipo: TipoEvento.LiberadaPorVencimiento, actor: 'Sistema', evidencias: [] },
          cambios: { ayudanteAlias: undefined, venceEn: undefined },
        });
      } else if (registro.necesidad.estado === EstadoNecesidad.Entregada) {
        this.transicionar({
          registro,
          estado: EstadoNecesidad.Atendida,
          evento: { tipo: TipoEvento.CerradaAutomaticamente, actor: 'Sistema', evidencias: [] },
          cambios: { cierre: CierreAtencion.Automatica, venceEn: undefined },
        });
      }
    }
  }

  private transicionar({ registro, estado, evento, cambios = {} }: Transicion): Necesidad {
    const ahora = new Date().toISOString();
    const nuevoEvento: EventoNecesidad = { ...evento, id: crypto.randomUUID(), ocurridoEn: ahora };
    const necesidad: Necesidad = {
      ...registro.necesidad,
      ...cambios,
      estado,
      actualizadaEn: ahora,
      eventos: [...registro.necesidad.eventos, nuevoEvento],
    };
    this.guardar(this.registros().map((r) => (r.necesidad.id === necesidad.id ? { ...registro, necesidad } : r)));
    return necesidad;
  }

  private coincideAcceso(registro: RegistroDemo, { telefono, clave }: AccesoSolicitante): boolean {
    return soloDigitos(registro.contacto.telefono) === soloDigitos(telefono) && registro.clave === clave;
  }

  private porCredencial({ necesidadId, credencial }: AccionSolicitante): RegistroDemo | undefined {
    const registro = this.registros().find((r) => r.necesidad.id === necesidadId);
    if (!registro) return undefined;
    const valida = credencial.tipo === 'dispositivo' ? registro.codigo === credencial.codigo : this.coincideAcceso(registro, credencial);
    return valida ? registro : undefined;
  }

  private exigirSolicitante(accion: AccionSolicitante, estados: readonly EstadoNecesidad[]): RegistroDemo {
    const registro = this.porCredencial(accion);
    if (!registro) throw new ErrorAccesoSolicitante();
    if (!estados.includes(registro.necesidad.estado)) throw new Error('Esta acción ya no está disponible para esta necesidad.');
    return registro;
  }

  private exigirEstado(id: string, estado: EstadoNecesidad): RegistroDemo {
    const registro = this.registros().find((r) => r.necesidad.id === id);
    if (!registro) throw new Error('La necesidad no existe.');
    if (registro.necesidad.estado !== estado) throw new Error('Otra persona ya la tomó o cambió de estado.');
    return registro;
  }

  private exigirAsignado(id: string, ayudante: Ayudante): RegistroDemo {
    const registro = this.exigirEstado(id, EstadoNecesidad.EnAtencion);
    if (registro.ayudanteId !== ayudante.id) throw new Error('Esta necesidad la está atendiendo otra persona.');
    return registro;
  }

  private exigirCoordinacion(): Ayudante {
    const ayudante = this.ayudante();
    if (!ayudante?.esCoordinador) throw new Error('Solo la coordinación puede ver esto.');
    return ayudante;
  }

  private exigirSesion(): Ayudante {
    const ayudante = this.ayudante();
    if (!ayudante) throw new Error('Debes identificarte para atender necesidades.');
    return ayudante;
  }

  // ---- Persistencia local (solo demo) ----

  private guardar(registros: RegistroDemo[]): void {
    this.registros.set(registros);
    this.escribir(CLAVE_ALMACEN, registros);
  }

  private cargar(): RegistroDemo[] {
    return this.leer<RegistroDemo[]>(CLAVE_ALMACEN) ?? crearSemillaDemo();
  }

  private cargarSesion(): Ayudante | null {
    return this.leer<Ayudante>(CLAVE_SESION);
  }

  private leer<T>(clave: string): T | null {
    try {
      const crudo = localStorage.getItem(clave);
      return crudo ? (JSON.parse(crudo) as T) : null;
    } catch {
      return null;
    }
  }

  private escribir(clave: string, valor: unknown): void {
    try {
      localStorage.setItem(clave, JSON.stringify(valor));
    } catch {
      /* Almacenamiento no disponible: la demo sigue funcionando en memoria. */
    }
  }

  /** Vuelve a los datos de ejemplo iniciales. */
  reiniciar(): void {
    this.guardar(crearSemillaDemo());
  }
}
