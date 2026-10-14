import { Signal } from '@angular/core';
import {
  AccesoSolicitante,
  Categoria,
  CifrasPublicas,
  ContactoPrivado,
  CredencialSolicitante,
  EstadoNecesidad,
  FiltroNecesidades,
  Necesidad,
  NuevaNecesidad,
  RegistroResultado,
} from '../domain/necesidad.model';

/**
 * Puertos de la aplicacion. Las features dependen de estas abstracciones,
 * nunca de Supabase ni del modo demo: cambiar de backend es cambiar un provider.
 * Estan separados por actor para que ningun consumidor dependa de lo que no usa.
 */

export abstract class NecesidadesLectura {
  /** Se actualiza sola cuando cambia cualquier necesidad. */
  abstract readonly todas: Signal<readonly Necesidad[]>;
  abstract readonly cargando: Signal<boolean>;
  abstract filtrar(filtro: FiltroNecesidades): readonly Necesidad[];
  abstract obtener(id: string): Necesidad | undefined;
  abstract cifras(): CifrasPublicas;
}

export interface AccionSolicitante {
  readonly necesidadId: string;
  readonly credencial: CredencialSolicitante;
}

export interface NoRecibidaPayload extends AccionSolicitante {
  readonly nota: string;
}

/** El celular o la clave no coinciden con ninguna solicitud. */
export class ErrorAccesoSolicitante extends Error {
  constructor() {
    super('El celular o la clave no coinciden. Revisa e inténtalo de nuevo.');
    this.name = 'ErrorAccesoSolicitante';
  }
}

/** El celular ya tiene clave de una solicitud anterior y la escrita es otra. */
export class ErrorClaveDistinta extends Error {
  constructor() {
    super('Este celular ya tiene una clave de una solicitud anterior. Escribe esa misma clave.');
    this.name = 'ErrorClaveDistinta';
  }
}

export interface AdjuntosPayload {
  readonly necesidadId: string;
  /** Llave interna del celular que registro: prueba que la necesidad es suya. */
  readonly codigo: string;
  /** Fotos ya procesadas en el cliente: sin metadatos y reducidas. */
  readonly fotos: readonly Blob[];
  /** Video corto; es privado (solo quien atiende y coordinacion). */
  readonly video: File | null;
}

export abstract class SolicitanteGateway {
  abstract registrar(nueva: NuevaNecesidad): Promise<RegistroResultado>;
  /** Sube fotos y video de una necesidad recien registrada. */
  abstract adjuntar(payload: AdjuntosPayload): Promise<void>;
  /** Solicitudes de ese celular. Lanza ErrorAccesoSolicitante si el celular o la clave no coinciden. */
  abstract misNecesidades(acceso: AccesoSolicitante): Promise<readonly Necesidad[]>;
  abstract confirmarRecibida(accion: AccionSolicitante): Promise<Necesidad>;
  abstract reportarNoRecibida(payload: NoRecibidaPayload): Promise<Necesidad>;
  abstract cancelar(accion: AccionSolicitante): Promise<Necesidad>;
}

export interface EntregaPayload {
  readonly necesidadId: string;
  readonly nota: string;
  /** Fotos ya procesadas en el cliente: sin metadatos y reducidas. */
  readonly fotos: readonly Blob[];
}

export abstract class AyudanteGateway {
  abstract tomar(necesidadId: string): Promise<Necesidad>;
  abstract liberar(necesidadId: string): Promise<Necesidad>;
  /** Pide 24 horas mas para entregar (una vez por toma). */
  abstract extenderPlazo(necesidadId: string): Promise<Necesidad>;
  abstract entregar(payload: EntregaPayload): Promise<Necesidad>;
  abstract contacto(necesidadId: string): Promise<ContactoPrivado>;
  /** Direccion temporal del video de la solicitud, solo para quien la atiende; null si no hay. */
  abstract videoSolicitud(necesidadId: string): Promise<string | null>;
  abstract misAtenciones(): readonly Necesidad[];
}

export interface Ayudante {
  readonly id: string;
  readonly alias: string;
  /** Coordinacion: puede asignar una clave nueva a quien la olvido. */
  readonly esCoordinador: boolean;
}

export interface RestablecerClavePayload {
  readonly telefono: string;
  readonly clave: string;
}

/** Solicitud que un hogar pidio otra vez poco despues de recibir ayuda. */
export interface SolicitudEnRevision {
  readonly necesidadId: string;
  readonly titulo: string;
  readonly categoria: Categoria;
  readonly sector: string;
  readonly registradaEn: string;
  readonly nombre: string;
  readonly telefono: string;
  /** Por que entro a revision, en lenguaje simple (ej.: "Recibió alimentos hace 3 días."). */
  readonly motivo: string;
}

export interface RevisarPayload {
  readonly necesidadId: string;
  /** true la publica; false la cancela. */
  readonly aprobar: boolean;
}

export interface SolicitudDelHistorial {
  readonly id: string;
  readonly titulo: string;
  readonly categoria: Categoria;
  readonly estado: EstadoNecesidad;
  readonly nombre: string;
  readonly sector: string;
  readonly registradaEn: string;
  readonly entregadaEn?: string;
  readonly ayudante?: string;
  readonly motivoRevision?: string;
}

/** Otro celular con el mismo nombre en el mismo sector: puede ser el mismo hogar. */
export interface HogarParecido {
  readonly telefono: string;
  readonly nombre: string;
  readonly sector: string;
  readonly solicitudes: number;
}

export interface ActividadAyudante {
  readonly alias: string;
  readonly tomadas: number;
  readonly entregas: number;
  readonly liberadas: number;
  /** Tomadas que se vencieron sin entrega (48 horas). */
  readonly vencidas: number;
}

export interface HistorialCelular {
  readonly solicitudes: readonly SolicitudDelHistorial[];
  readonly parecidas: readonly HogarParecido[];
  /** Si ese celular tambien ayuda. */
  readonly ayudante?: ActividadAyudante;
}

/** Hogar (por celular) que ya recibio ayuda. Privado: solo coordinacion. */
export interface HogarAtendido {
  readonly telefono: string;
  readonly nombre: string;
  readonly sector: string;
  readonly ayudas: number;
  readonly ultimaAyuda: string;
  readonly categorias: readonly Categoria[];
}

/** Herramientas de la coordinacion (solo perfiles con rol coordinacion). */
export abstract class CoordinacionGateway {
  /** Devuelve cuantas solicitudes de ese celular quedaron con la clave nueva. */
  abstract restablecerClave(payload: RestablecerClavePayload): Promise<number>;
  abstract solicitudesEnRevision(): Promise<readonly SolicitudEnRevision[]>;
  abstract revisar(payload: RevisarPayload): Promise<void>;
  abstract historial(telefono: string): Promise<HistorialCelular>;
  /** Hogares que ya recibieron ayuda, el mas reciente primero. */
  abstract hogaresQueRecibieron(): Promise<readonly HogarAtendido[]>;
}

/** Reconocimiento publico: alias de quienes ayudan y cuantas entregas llevan. */
export interface VecinoQueAyuda {
  readonly alias: string;
  readonly entregas: number;
  readonly ultimaEntrega: string;
}

export abstract class ReconocimientoLectura {
  abstract vecinosQueAyudan(): Promise<readonly VecinoQueAyuda[]>;
}

export interface InicioSesionPayload {
  readonly alias: string;
  /** Privado: solo para coordinacion. Nunca se muestra en la plataforma. */
  readonly celular: string;
  /** Clave de 4 numeros: con celular + clave se entra al mismo perfil desde cualquier celular. */
  readonly clave: string;
}

/** El celular ya tiene perfil con clave y la escrita no coincide. */
export class ErrorClaveAyudante extends Error {
  constructor() {
    super('Ese celular ya tiene una clave y no coincide. Revísala e inténtalo de nuevo.');
    this.name = 'ErrorClaveAyudante';
  }
}

/** El servicio de acceso rechazo el intento por exceso de solicitudes: hay que esperar antes de reintentar. */
export class ErrorLimiteEnvios extends Error {
  constructor(readonly segundosEspera: number) {
    super('Hubo demasiados intentos en poco tiempo. Espera un momento e inténtalo de nuevo.');
    this.name = 'ErrorLimiteEnvios';
  }
}

export abstract class SesionGateway {
  abstract readonly ayudante: Signal<Ayudante | null>;
  /** Entra al instante con alias y celular: sin correos ni contrasenas. */
  abstract iniciarSesion(payload: InicioSesionPayload): Promise<void>;
  abstract cerrarSesion(): Promise<void>;
  /** El perfil de esta sesion ya tiene clave (para entrar desde otros celulares). */
  abstract tengoClave(): Promise<boolean>;
  abstract establecerClave(clave: string): Promise<void>;
}

/** Indica a la UI si los datos son de demostracion, para decirlo siempre con claridad. */
export abstract class ModoDatos {
  abstract readonly esDemo: boolean;
}
