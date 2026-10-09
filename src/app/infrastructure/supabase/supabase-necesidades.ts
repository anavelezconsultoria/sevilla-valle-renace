import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import {
  CifrasPublicas,
  ContactoPrivado,
  FiltroNecesidades,
  Necesidad,
  NuevaNecesidad,
  RegistroResultado,
} from '../../core/domain/necesidad.model';
import {
  AyudanteGateway,
  EntregaPayload,
  ModoDatos,
  NecesidadesLectura,
  NoRecibidaPayload,
  SesionGateway,
  SolicitanteGateway,
} from '../../core/ports/necesidades.ports';
import { filtrarNecesidades } from '../../core/application/filtrar-necesidades';
import { calcularCifras } from '../../core/application/calcular-cifras';
import { exigir, SUPABASE_CLIENTE } from './supabase-cliente';
import { SUPABASE_CONFIG } from './supabase.config';
import { aContacto, aNecesidad, FilaContacto, FilaNecesidad, FilaRegistro, SELECT_NECESIDADES } from './supabase-filas';

const LIMITE_NECESIDADES = 1000;
const ESPERA_RECARGA_MS = 400;
const RECARGA_PERIODICA_MS = 120_000;

/**
 * Adaptador de Supabase para los puertos de necesidades. Mantiene en memoria la
 * lista publica y la recarga en tiempo real cuando la base avisa de un cambio.
 * Todas las escrituras van por funciones RPC: la base aplica las reglas.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseNecesidades implements NecesidadesLectura, SolicitanteGateway, AyudanteGateway, ModoDatos {
  private readonly cliente = inject(SUPABASE_CLIENTE);
  private readonly config = inject(SUPABASE_CONFIG);
  private readonly sesion = inject(SesionGateway);

  readonly esDemo = false;
  private readonly lista = signal<readonly Necesidad[]>([]);
  private readonly cargandoInterno = signal(true);
  readonly todas = this.lista.asReadonly();
  readonly cargando = this.cargandoInterno.asReadonly();
  private readonly mias = computed(() => {
    const id = this.sesion.ayudante()?.id;
    return id ? this.lista().filter((n) => n.ayudanteId === id) : [];
  });
  private temporizadorRecarga: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    void this.recargar();
    const canal = this.cliente
      .channel('necesidades-publicas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'necesidades' }, () => this.programarRecarga())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'eventos_necesidad' }, () => this.programarRecarga())
      .subscribe();
    // Respaldo por si la conexion en tiempo real se cae con mala señal.
    const periodica = setInterval(() => void this.recargar(), RECARGA_PERIODICA_MS);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(periodica);
      void this.cliente.removeChannel(canal);
    });
  }

  // ---- Lectura publica ----

  filtrar(filtro: FiltroNecesidades): readonly Necesidad[] {
    return filtrarNecesidades(this.lista(), filtro);
  }

  obtener(id: string): Necesidad | undefined {
    return this.lista().find((n) => n.id === id);
  }

  cifras(): CifrasPublicas {
    return calcularCifras(this.lista());
  }

  // ---- Solicitante ----

  async registrar(nueva: NuevaNecesidad): Promise<RegistroResultado> {
    const filas = exigir<readonly FilaRegistro[]>(
      await this.cliente.rpc('registrar_necesidad', {
        p_categoria: nueva.categoria,
        p_titulo: nueva.titulo,
        p_descripcion: nueva.descripcion,
        p_urgencia: nueva.urgencia,
        p_personas_hogar: nueva.personasHogar,
        p_sector: nueva.sector,
        p_lat: nueva.ubicacion.lat,
        p_lng: nueva.ubicacion.lng,
        p_nombre: nueva.contacto.nombre,
        p_telefono: nueva.contacto.telefono,
        p_referencias: nueva.contacto.referencias,
      }),
    );
    const registro = filas[0];
    if (!registro) throw new Error('No pudimos registrar la necesidad.');
    const necesidad = await this.recargarYObtener(registro.necesidad_id);
    return { necesidad, codigoSeguimiento: registro.codigo };
  }

  async consultarPorCodigo(codigo: string): Promise<Necesidad | undefined> {
    const id = exigir<string | null>(await this.cliente.rpc('consultar_por_codigo', { p_codigo: codigo }));
    return id ? this.recargarYObtener(id) : undefined;
  }

  async confirmarRecibida(codigo: string): Promise<Necesidad> {
    return this.ejecutarYObtener('confirmar_recibida', { p_codigo: codigo });
  }

  async reportarNoRecibida({ codigo, nota }: NoRecibidaPayload): Promise<Necesidad> {
    return this.ejecutarYObtener('reportar_no_recibida', { p_codigo: codigo, p_nota: nota });
  }

  async cancelar(codigo: string): Promise<Necesidad> {
    return this.ejecutarYObtener('cancelar_necesidad', { p_codigo: codigo });
  }

  // ---- Ayudante ----

  async tomar(necesidadId: string): Promise<Necesidad> {
    return this.ejecutarYObtener('tomar_necesidad', { p_necesidad: necesidadId });
  }

  async liberar(necesidadId: string): Promise<Necesidad> {
    return this.ejecutarYObtener('liberar_necesidad', { p_necesidad: necesidadId });
  }

  async entregar({ necesidadId, nota, fotos }: EntregaPayload): Promise<Necesidad> {
    const rutas = await Promise.all(fotos.map((foto) => this.subirEvidencia(necesidadId, foto)));
    return this.ejecutarYObtener('entregar_necesidad', { p_necesidad: necesidadId, p_nota: nota, p_rutas: rutas });
  }

  async contacto(necesidadId: string): Promise<ContactoPrivado> {
    const filas = exigir<readonly FilaContacto[]>(await this.cliente.rpc('contacto_necesidad', { p_necesidad: necesidadId }));
    const fila = filas[0];
    if (!fila) throw new Error('Solo quien atiende esta necesidad puede ver el contacto.');
    return aContacto(fila);
  }

  misAtenciones(): readonly Necesidad[] {
    return this.mias();
  }

  // ---- Internos ----

  /** Las fotos van a la carpeta del ayudante: la politica de Storage y la funcion lo exigen. */
  private async subirEvidencia(necesidadId: string, foto: Blob): Promise<string> {
    const ayudanteId = this.sesion.ayudante()?.id;
    if (!ayudanteId) throw new Error('Debes identificarte para registrar una entrega.');
    const ruta = `${ayudanteId}/${necesidadId}/${crypto.randomUUID()}.jpg`;
    const { error } = await this.cliente.storage
      .from(this.config.bucketEvidencias)
      .upload(ruta, foto, { contentType: 'image/jpeg', upsert: false });
    if (error) throw new Error('No se pudo subir una de las fotos. Revisa tu conexión e inténtalo de nuevo.');
    return ruta;
  }

  private urlPublica = (ruta: string): string =>
    this.cliente.storage.from(this.config.bucketEvidencias).getPublicUrl(ruta).data.publicUrl;

  private async ejecutarYObtener(funcion: string, argumentos: Record<string, string | readonly string[]>): Promise<Necesidad> {
    const id = exigir<string>(await this.cliente.rpc(funcion, argumentos));
    return this.recargarYObtener(id);
  }

  private async recargarYObtener(id: string): Promise<Necesidad> {
    await this.recargar();
    const necesidad = this.obtener(id);
    if (!necesidad) throw new Error('La necesidad no existe.');
    return necesidad;
  }

  private programarRecarga(): void {
    if (this.temporizadorRecarga) clearTimeout(this.temporizadorRecarga);
    this.temporizadorRecarga = setTimeout(() => void this.recargar(), ESPERA_RECARGA_MS);
  }

  private async recargar(): Promise<void> {
    try {
      const filas = exigir<readonly FilaNecesidad[]>(
        await this.cliente
          .from('necesidades')
          .select(SELECT_NECESIDADES)
          .order('registrada_en', { ascending: false })
          .limit(LIMITE_NECESIDADES),
      );
      this.lista.set(filas.map((f) => aNecesidad(f, this.urlPublica)));
    } finally {
      this.cargandoInterno.set(false);
    }
  }
}
