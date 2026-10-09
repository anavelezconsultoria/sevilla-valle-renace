/**
 * Modelo de dominio de una necesidad. Es la unica fuente de verdad de los
 * tipos que cruzan entre la UI y el repositorio: si un dato viaja, vive aqui.
 */

export enum EstadoNecesidad {
  Registrada = 'registrada',
  EnAtencion = 'en_atencion',
  Entregada = 'entregada',
  Atendida = 'atendida',
  Cancelada = 'cancelada',
}

/** Como se cerro una necesidad atendida: lo confirmo quien la recibio o vencio el plazo. */
export enum CierreAtencion {
  Confirmada = 'confirmada',
  Automatica = 'cerrada_automaticamente',
}

export enum Categoria {
  Alimentos = 'alimentos',
  Agua = 'agua',
  Techo = 'techo',
  Salud = 'salud',
  Medicamentos = 'medicamentos',
  Ropa = 'ropa',
  Aseo = 'aseo',
  Materiales = 'materiales',
  Transporte = 'transporte',
  Mascotas = 'mascotas',
  Otra = 'otra',
}

export enum Urgencia {
  Alta = 'alta',
  Media = 'media',
  Baja = 'baja',
}

export enum TipoEvento {
  Registrada = 'registrada',
  Tomada = 'tomada',
  Liberada = 'liberada',
  LiberadaPorVencimiento = 'liberada_por_vencimiento',
  Entregada = 'entregada',
  NoRecibida = 'no_recibida',
  Confirmada = 'confirmada',
  CerradaAutomaticamente = 'cerrada_automaticamente',
  Cancelada = 'cancelada',
}

export interface Coordenada {
  readonly lat: number;
  readonly lng: number;
}

export interface Evidencia {
  readonly id: string;
  readonly url: string;
  readonly descripcion: string;
}

export interface EventoNecesidad {
  readonly id: string;
  readonly tipo: TipoEvento;
  readonly ocurridoEn: string;
  /** Alias publico de quien actuo; nunca nombre real del solicitante. */
  readonly actor: string;
  readonly nota?: string;
  readonly evidencias: readonly Evidencia[];
}

/** Vista publica: lo unico que ve un visitante. Sin datos de contacto ni ubicacion exacta. */
export interface Necesidad {
  readonly id: string;
  readonly categoria: Categoria;
  readonly titulo: string;
  readonly descripcion: string;
  readonly urgencia: Urgencia;
  readonly personasHogar: number;
  readonly sector: string;
  readonly ubicacionAproximada: Coordenada;
  readonly estado: EstadoNecesidad;
  readonly cierre?: CierreAtencion;
  /** Identificador publico del perfil que la atiende (no es un dato personal). */
  readonly ayudanteId?: string;
  readonly ayudanteAlias?: string;
  readonly registradaEn: string;
  readonly actualizadaEn: string;
  /** Vencimiento de la etapa actual (toma o confirmacion), si aplica. */
  readonly venceEn?: string;
  readonly eventos: readonly EventoNecesidad[];
}

/** Datos privados: solo para el ayudante asignado y coordinacion. */
export interface ContactoPrivado {
  readonly nombre: string;
  readonly telefono: string;
  readonly ubicacionExacta: Coordenada;
  readonly referencias: string;
}

export interface NuevaNecesidad {
  readonly categoria: Categoria;
  readonly titulo: string;
  readonly descripcion: string;
  readonly urgencia: Urgencia;
  readonly personasHogar: number;
  readonly sector: string;
  readonly ubicacion: Coordenada;
  readonly contacto: {
    readonly nombre: string;
    readonly telefono: string;
    readonly referencias: string;
    /** Clave de 4 numeros que elige quien pide ayuda; el backend solo guarda su hash. */
    readonly clave: string;
  };
}

export interface RegistroResultado {
  readonly necesidad: Necesidad;
  /** Llave interna que se guarda en el celular que registro: nunca se muestra a la persona. */
  readonly codigoDispositivo: string;
}

/** Lo que recuerda quien pidio ayuda para entrar desde cualquier celular. */
export interface AccesoSolicitante {
  readonly telefono: string;
  readonly clave: string;
}

/**
 * Como demuestra quien pidio la ayuda que la solicitud es suya: el celular que
 * la registro guarda una llave interna; desde otro celular usa celular + clave.
 */
export type CredencialSolicitante =
  | { readonly tipo: 'dispositivo'; readonly codigo: string }
  | ({ readonly tipo: 'clave' } & AccesoSolicitante);

export interface FiltroNecesidades {
  readonly estados?: readonly EstadoNecesidad[];
  readonly categoria?: Categoria;
  readonly urgencia?: Urgencia;
  readonly texto?: string;
}

export interface CifrasPublicas {
  readonly registradas: number;
  readonly enAtencion: number;
  readonly entregadas: number;
  readonly atendidas: number;
  readonly personasAyudadas: number;
}
