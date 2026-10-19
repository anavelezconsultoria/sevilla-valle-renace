import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import {
  AccesoSolicitante,
  CifrasPublicas,
  ContactoPrivado,
  CredencialSolicitante,
  EstadoNecesidad,
  FiltroNecesidades,
  Necesidad,
  NuevaNecesidad,
  RegistroResultado,
} from '../../core/domain/necesidad.model';
import {
  AccionSolicitante,
  AdjuntosPayload,
  AtencionEnCurso,
  AyudanteGateway,
  BloquearCelularPayload,
  ReportePendiente,
  TomarPayload,
  EntregaPayload,
  CoordinacionGateway,
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
import {
  aAtencionEnCurso,
  aContacto,
  aErrorRegistrado,
  aHistorial,
  aHogarAtendido,
  aNecesidad,
  aReportePendiente,
  aSolicitudEnRevision,
  aVecino,
  FilaAtencionEnCurso,
  FilaContacto,
  FilaErrorRegistrado,
  FilaHistorial,
  FilaHogarAtendido,
  FilaNecesidad,
  FilaRegistro,
  FilaReporte,
  FilaRevision,
  FilaVecino,
  SELECT_NECESIDADES,
} from './supabase-filas';

const LIMITE_NECESIDADES = 1000;

interface FilaAjustes {
  readonly personas_ayudadas_extra: number;
}
/** La base solo lo acepta si quien inicio sesion administra ese colectivo (migracion 0021). */
const ENCABEZADO_COLECTIVO = 'x-sr-a-nombre-de';
const ESPERA_RECARGA_MS = 400;
const RECARGA_PERIODICA_MS = 120_000;
/** El enlace del video privado dura una hora. */
const SEGUNDOS_URL_VIDEO = 3600;

function extensionVideo(video: File): string {
  if (video.type === 'video/quicktime') return 'mov';
  if (video.type === 'video/webm') return 'webm';
  return 'mp4';
}

type TipoCredencial = CredencialSolicitante['tipo'];

/** Funcion de la base para cada accion del solicitante, segun como se identifique. */
const RPC_SOLICITANTE = {
  confirmar: { dispositivo: 'confirmar_recibida', clave: 'confirmar_con_clave' },
  noRecibida: { dispositivo: 'reportar_no_recibida', clave: 'no_recibida_con_clave' },
  cancelar: { dispositivo: 'cancelar_necesidad', clave: 'cancelar_con_clave' },
} as const satisfies Record<string, Record<TipoCredencial, string>>;

interface EjecucionSolicitante {
  readonly rpc: Readonly<Record<TipoCredencial, string>>;
  readonly accion: AccionSolicitante;
  readonly extra?: Readonly<Record<string, string>>;
}

/**
 * Adaptador de Supabase para los puertos de necesidades. Mantiene en memoria la
 * lista publica y la recarga en tiempo real cuando la base avisa de un cambio.
 * Todas las escrituras van por funciones RPC: la base aplica las reglas.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseNecesidades
  implements NecesidadesLectura, SolicitanteGateway, AyudanteGateway, CoordinacionGateway, ReconocimientoLectura, ModoDatos
{
  private readonly cliente = inject(SUPABASE_CLIENTE);
  private readonly config = inject(SUPABASE_CONFIG);
  private readonly sesion = inject(SesionGateway);

  readonly esDemo = false;
  private readonly lista = signal<readonly Necesidad[]>([]);
  private readonly cargandoInterno = signal(true);
  /** Personas ayudadas por fuera de la plataforma (tabla ajustes_cifras, migracion 0026). */
  private readonly personasExtra = signal(0);
  /** Lo publico: las solicitudes en revision solo las ve quien las pidio y la coordinacion. */
  readonly todas = computed(() => this.lista().filter((n) => n.estado !== EstadoNecesidad.EnRevision));
  readonly cargando = this.cargandoInterno.asReadonly();
  /** Ids con los que actua quien inicio sesion: el propio y los de sus colectivos. */
  private readonly misIds = computed(() => {
    const id = this.sesion.ayudante()?.id;
    return id ? new Set([id, ...this.sesion.colectivos().map((c) => c.id)]) : new Set<string>();
  });
  private readonly mias = computed(() => this.lista().filter((n) => !!n.ayudanteId && this.misIds().has(n.ayudanteId)));
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
    return filtrarNecesidades(this.todas(), filtro);
  }

  obtener(id: string): Necesidad | undefined {
    return this.lista().find((n) => n.id === id);
  }

  cifras(): CifrasPublicas {
    return calcularCifras(this.todas(), this.personasExtra());
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
        p_clave: nueva.contacto.clave,
        p_referencias: nueva.contacto.referencias,
        p_prioridad_cero: nueva.prioridadCero,
      }),
    );
    const registro = filas[0];
    if (!registro) throw new Error('No pudimos registrar la necesidad.');
    if (!registro.necesidad_id) throw new ErrorClaveDistinta();
    const necesidad = await this.recargarYObtener(registro.necesidad_id);
    return { necesidad, codigoDispositivo: registro.codigo };
  }

  async adjuntar({ necesidadId, codigo, fotos, video }: AdjuntosPayload): Promise<void> {
    const rutasFotos = await Promise.all(
      fotos.map((foto) => this.subir(this.config.bucketFotosSolicitud, `${necesidadId}/${crypto.randomUUID()}.jpg`, foto, 'image/jpeg')),
    );
    const rutaVideo = video
      ? await this.subir(this.config.bucketVideoSolicitud, `${necesidadId}/${crypto.randomUUID()}.${extensionVideo(video)}`, video, video.type)
      : null;
    exigir<number>(await this.cliente.rpc('registrar_adjuntos', { p_codigo: codigo, p_fotos: rutasFotos, p_video: rutaVideo }));
    await this.recargar();
  }

  async misNecesidades({ telefono, clave }: AccesoSolicitante): Promise<readonly Necesidad[]> {
    const ids = exigir<readonly string[]>(await this.cliente.rpc('mis_necesidades', { p_telefono: telefono, p_clave: clave }));
    if (!ids.length) throw new ErrorAccesoSolicitante();
    await this.recargar();
    return ids.map((id) => this.obtener(id)).filter((n): n is Necesidad => n !== undefined);
  }

  async confirmarRecibida(accion: AccionSolicitante): Promise<Necesidad> {
    return this.ejecutarComoSolicitante({ rpc: RPC_SOLICITANTE.confirmar, accion });
  }

  async reportarNoRecibida({ nota, ...accion }: NoRecibidaPayload): Promise<Necesidad> {
    return this.ejecutarComoSolicitante({ rpc: RPC_SOLICITANTE.noRecibida, accion, extra: { p_nota: nota } });
  }

  async cancelar(accion: AccionSolicitante): Promise<Necesidad> {
    return this.ejecutarComoSolicitante({ rpc: RPC_SOLICITANTE.cancelar, accion });
  }

  // ---- Ayudante ----

  async tomar({ necesidadId, aNombreDe }: TomarPayload): Promise<Necesidad> {
    return this.ejecutarYObtener('tomar_necesidad', { p_necesidad: necesidadId }, aNombreDe);
  }

  async liberar(necesidadId: string): Promise<Necesidad> {
    return this.ejecutarYObtener('liberar_necesidad', { p_necesidad: necesidadId }, this.colectivoDe(necesidadId));
  }

  async extenderPlazo(necesidadId: string): Promise<Necesidad> {
    return this.ejecutarYObtener('extender_plazo', { p_necesidad: necesidadId }, this.colectivoDe(necesidadId));
  }

  async entregar({ necesidadId, nota, fotos }: EntregaPayload): Promise<Necesidad> {
    const rutas = await Promise.all(fotos.map((foto) => this.subirEvidencia(necesidadId, foto)));
    return this.ejecutarYObtener('entregar_necesidad', { p_necesidad: necesidadId, p_nota: nota, p_rutas: rutas }, this.colectivoDe(necesidadId));
  }

  async contacto(necesidadId: string): Promise<ContactoPrivado> {
    const filas = exigir<readonly FilaContacto[]>(await this.rpcComo('contacto_necesidad', { p_necesidad: necesidadId }, this.colectivoDe(necesidadId)));
    const fila = filas[0];
    if (!fila) throw new Error('Solo quien atiende esta necesidad puede ver el contacto.');
    return aContacto(fila);
  }

  async videoSolicitud(necesidadId: string): Promise<string | null> {
    const ruta = exigir<string | null>(await this.rpcComo('video_solicitud', { p_necesidad: necesidadId }, this.colectivoDe(necesidadId)));
    if (!ruta) return null;
    const { data, error } = await this.cliente.storage.from(this.config.bucketVideoSolicitud).createSignedUrl(ruta, SEGUNDOS_URL_VIDEO);
    return error ? null : data.signedUrl;
  }

  misAtenciones(): readonly Necesidad[] {
    return this.mias();
  }

  // ---- Coordinacion ----

  async restablecerClave({ telefono, clave }: RestablecerClavePayload): Promise<number> {
    return exigir<number>(await this.cliente.rpc('restablecer_clave_solicitante', { p_telefono: telefono, p_clave: clave }));
  }

  async solicitudesEnRevision(): Promise<readonly SolicitudEnRevision[]> {
    return exigir<readonly FilaRevision[]>(await this.cliente.rpc('solicitudes_en_revision')).map(aSolicitudEnRevision);
  }

  async revisar({ necesidadId, aprobar }: RevisarPayload): Promise<void> {
    exigir<string>(await this.cliente.rpc('revisar_necesidad', { p_necesidad: necesidadId, p_aprobar: aprobar }));
    await this.recargar();
  }

  async historial(telefono: string): Promise<HistorialCelular> {
    return aHistorial(exigir<FilaHistorial>(await this.cliente.rpc('historial_celular', { p_telefono: telefono })));
  }

  async bloquearCelular({ telefono, motivo }: BloquearCelularPayload): Promise<number> {
    const cerradas = exigir<number>(await this.cliente.rpc('bloquear_celular', { p_telefono: telefono, p_motivo: motivo }));
    await this.recargar();
    return cerradas;
  }

  async reportesPendientes(): Promise<readonly ReportePendiente[]> {
    return exigir<readonly FilaReporte[]>(await this.cliente.rpc('reportes_pendientes')).map(aReportePendiente);
  }

  async marcarReportesRevisados(necesidadId: string): Promise<void> {
    exigir<null>(await this.cliente.rpc('marcar_reportes_revisados', { p_necesidad: necesidadId }));
  }

  async hogaresQueRecibieron(): Promise<readonly HogarAtendido[]> {
    return exigir<readonly FilaHogarAtendido[]>(await this.cliente.rpc('hogares_que_recibieron')).map(aHogarAtendido);
  }

  async atencionesEnCurso(): Promise<readonly AtencionEnCurso[]> {
    return exigir<readonly FilaAtencionEnCurso[]>(await this.cliente.rpc('atenciones_en_curso')).map(aAtencionEnCurso);
  }

  async erroresRecientes(): Promise<readonly ErrorRegistrado[]> {
    return exigir<readonly FilaErrorRegistrado[]>(await this.cliente.rpc('errores_recientes')).map(aErrorRegistrado);
  }

  // ---- Reconocimiento publico ----

  async vecinosQueAyudan(): Promise<readonly VecinoQueAyuda[]> {
    return exigir<readonly FilaVecino[]>(await this.cliente.rpc('vecinos_que_ayudan')).map(aVecino);
  }

  // ---- Internos ----

  private async subir(bucket: string, ruta: string, archivo: Blob, tipo: string): Promise<string> {
    const { error } = await this.cliente.storage.from(bucket).upload(ruta, archivo, { contentType: tipo, upsert: false });
    if (error) throw new Error('No se pudo subir una de las fotos o el video. Revisa tu conexión.');
    return ruta;
  }

  /** Las fotos van a la carpeta del ayudante: la politica de Storage y la funcion lo exigen. */
  private async subirEvidencia(necesidadId: string, foto: Blob): Promise<string> {
    const ayudanteId = this.colectivoDe(necesidadId) ?? this.sesion.ayudante()?.id;
    if (!ayudanteId) throw new Error('Debes identificarte para registrar una entrega.');
    const ruta = `${ayudanteId}/${necesidadId}/${crypto.randomUUID()}.jpg`;
    const { error } = await this.cliente.storage
      .from(this.config.bucketEvidencias)
      .upload(ruta, foto, { contentType: 'image/jpeg', upsert: false });
    if (error) throw new Error('No se pudo subir una de las fotos. Revisa tu conexión e inténtalo de nuevo.');
    return ruta;
  }

  private urlFoto = (ruta: string): string =>
    this.cliente.storage.from(this.config.bucketFotosSolicitud).getPublicUrl(ruta).data.publicUrl;

  private urlPublica = (ruta: string): string =>
    this.cliente.storage.from(this.config.bucketEvidencias).getPublicUrl(ruta).data.publicUrl;

  /** La credencial decide la funcion: llave del dispositivo o celular + clave. Null = la clave no coincide. */
  private async ejecutarComoSolicitante({ rpc, accion, extra = {} }: EjecucionSolicitante): Promise<Necesidad> {
    const { credencial, necesidadId } = accion;
    const argumentos =
      credencial.tipo === 'dispositivo'
        ? { p_codigo: credencial.codigo }
        : { p_necesidad: necesidadId, p_telefono: credencial.telefono, p_clave: credencial.clave };
    const id = exigir<string | null>(await this.cliente.rpc(rpc[credencial.tipo], { ...argumentos, ...extra }));
    if (!id) throw new ErrorAccesoSolicitante();
    return this.recargarYObtener(id);
  }

  /** Si la necesidad la lleva uno de mis colectivos, su id (para actuar a su nombre). */
  private colectivoDe(necesidadId: string): string | undefined {
    const ayudanteId = this.obtener(necesidadId)?.ayudanteId;
    return this.sesion.colectivos().some((c) => c.id === ayudanteId) ? ayudanteId : undefined;
  }

  /** Llama una funcion de la base; con colectivo, la base la ejecuta a su nombre. */
  private rpcComo(funcion: string, argumentos: Record<string, string | readonly string[]>, aNombreDe?: string) {
    const llamada = this.cliente.rpc(funcion, argumentos);
    return aNombreDe ? llamada.setHeader(ENCABEZADO_COLECTIVO, aNombreDe) : llamada;
  }

  private async ejecutarYObtener(
    funcion: string,
    argumentos: Record<string, string | readonly string[]>,
    aNombreDe?: string,
  ): Promise<Necesidad> {
    const id = exigir<string>(await this.rpcComo(funcion, argumentos, aNombreDe));
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
    void this.cargarAjustes();
    try {
      const filas = exigir<readonly FilaNecesidad[]>(
        await this.cliente
          .from('necesidades')
          .select(SELECT_NECESIDADES)
          .order('registrada_en', { ascending: false })
          .limit(LIMITE_NECESIDADES),
      );
      this.lista.set(filas.map((f) => aNecesidad(f, this.urlPublica, this.urlFoto)));
    } finally {
      this.cargandoInterno.set(false);
    }
  }

  /** Si el ajuste no se puede leer, la cifra queda solo con lo registrado. */
  private async cargarAjustes(): Promise<void> {
    const { data } = await this.cliente.from('ajustes_cifras').select('personas_ayudadas_extra').eq('id', 1).maybeSingle<FilaAjustes>();
    this.personasExtra.set(data?.personas_ayudadas_extra ?? 0);
  }
}
