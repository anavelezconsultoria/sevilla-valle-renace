import { Signal } from '@angular/core';
import {
  AccesoSolicitante,
  CifrasPublicas,
  ContactoPrivado,
  CredencialSolicitante,
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

export abstract class SolicitanteGateway {
  abstract registrar(nueva: NuevaNecesidad): Promise<RegistroResultado>;
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

/** Herramientas de la coordinacion (solo perfiles con rol coordinacion). */
export abstract class CoordinacionGateway {
  /** Devuelve cuantas solicitudes de ese celular quedaron con la clave nueva. */
  abstract restablecerClave(payload: RestablecerClavePayload): Promise<number>;
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
