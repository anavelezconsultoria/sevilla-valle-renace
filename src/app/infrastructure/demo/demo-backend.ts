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
  HORAS_PARA_CONFIRMAR,
  HORAS_PARA_ENTREGAR,
  sumarHoras,
} from '../../core/domain/ciclo-de-vida';
import { desplazarCoordenada, generarCodigoSeguimiento } from '../../core/domain/privacidad';
import { soloDigitos } from '../../core/domain/clave-solicitante';
import {
  AccionSolicitante,
  Ayudante,
  AyudanteGateway,
  EntregaPayload,
  ErrorAccesoSolicitante,
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

const CLAVE_ALMACEN = 'sevilla-renace-demo-v3';
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
  implements NecesidadesLectura, SolicitanteGateway, AyudanteGateway, SesionGateway, ModoDatos
{
  readonly esDemo = true;
  private readonly registros = signal<RegistroDemo[]>(this.cargar());
  readonly todas = computed(() => this.registros().map((r) => r.necesidad));
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
    return this.todas().find((n) => n.id === id);
  }

  cifras(): CifrasPublicas {
    return calcularCifras(this.todas());
  }

  // ---- Solicitante ----

  async registrar(nueva: NuevaNecesidad): Promise<RegistroResultado> {
    const ahora = new Date().toISOString();
    const id = crypto.randomUUID();
    const codigo = generarCodigoSeguimiento();
    const necesidad: Necesidad = {
      id,
      categoria: nueva.categoria,
      titulo: nueva.titulo.trim(),
      descripcion: nueva.descripcion.trim(),
      urgencia: nueva.urgencia,
      personasHogar: nueva.personasHogar,
      sector: nueva.sector.trim(),
      ubicacionAproximada: desplazarCoordenada(nueva.ubicacion),
      estado: EstadoNecesidad.Registrada,
      registradaEn: ahora,
      actualizadaEn: ahora,
      eventos: [{ id: `${id}-e0`, tipo: TipoEvento.Registrada, ocurridoEn: ahora, actor: 'Solicitante', evidencias: [] }],
    };
    const { clave, ...datosContacto } = nueva.contacto;
    const contacto: ContactoPrivado = { ...datosContacto, ubicacionExacta: nueva.ubicacion };
    this.guardar([{ necesidad, contacto, codigo, clave }, ...this.registros()]);
    return { necesidad, codigoDispositivo: codigo };
  }

  async misNecesidades(acceso: AccesoSolicitante): Promise<readonly Necesidad[]> {
    const propias = this.registros().filter((r) => this.coincideAcceso(r, acceso));
    if (!propias.length) throw new ErrorAccesoSolicitante();
    return propias.map((r) => r.necesidad);
  }

  async confirmarRecibida(accion: AccionSolicitante): Promise<Necesidad> {
    const registro = this.exigirSolicitante(accion, EstadoNecesidad.Entregada);
    return this.transicionar({
      registro,
      estado: EstadoNecesidad.Atendida,
      evento: { tipo: TipoEvento.Confirmada, actor: 'Solicitante', evidencias: [] },
      cambios: { cierre: CierreAtencion.Confirmada, venceEn: undefined },
    });
  }

  async reportarNoRecibida({ nota, ...accion }: NoRecibidaPayload): Promise<Necesidad> {
    const registro = this.exigirSolicitante(accion, EstadoNecesidad.Entregada);
    return this.transicionar({
      registro,
      estado: EstadoNecesidad.EnAtencion,
      evento: { tipo: TipoEvento.NoRecibida, actor: 'Solicitante', nota, evidencias: [] },
      cambios: { venceEn: sumarHoras(new Date().toISOString(), HORAS_PARA_ENTREGAR) },
    });
  }

  async cancelar(accion: AccionSolicitante): Promise<Necesidad> {
    const registro = this.exigirSolicitante(accion, EstadoNecesidad.Registrada);
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

  async contacto(necesidadId: string): Promise<ContactoPrivado> {
    const ayudante = this.exigirSesion();
    return this.exigirAsignado(necesidadId, ayudante).contacto;
  }

  misAtenciones(): readonly Necesidad[] {
    const id = this.ayudante()?.id;
    return id ? this.registros().filter((r) => r.ayudanteId === id).map((r) => r.necesidad) : [];
  }

  // ---- Sesion ----

  async iniciarSesion({ celular, alias }: InicioSesionPayload): Promise<void> {
    const ayudante: Ayudante = { id: `demo-${celular.replace(/\D/g, '')}`, alias: alias.trim() };
    this.ayudante.set(ayudante);
    this.escribir(CLAVE_SESION, ayudante);
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

  private exigirSolicitante(accion: AccionSolicitante, estado: EstadoNecesidad): RegistroDemo {
    const registro = this.porCredencial(accion);
    if (!registro) throw new ErrorAccesoSolicitante();
    if (registro.necesidad.estado !== estado) throw new Error('Esta acción ya no está disponible para esta necesidad.');
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
