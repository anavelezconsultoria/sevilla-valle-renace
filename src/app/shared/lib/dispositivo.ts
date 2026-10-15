/**
 * Identificador anonimo del navegador para los "Gracias": un numero al azar que
 * se guarda en el celular. No es un dato personal ni identifica a nadie; solo
 * evita que el mismo celular de gracias dos veces a la misma publicacion.
 */
const CLAVE_DISPOSITIVO = 'sr-dispositivo';
const CLAVE_AGRADECIDOS = 'sr-gracias-dadas';
const MAX_AGRADECIDOS = 500;

function leer(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function escribir(clave: string, valor: string): void {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    /* Sin almacenamiento: funciona igual, solo no recuerda entre visitas. */
  }
}

let enMemoria: string | null = null;

export function idDispositivo(): string {
  const guardado = leer(CLAVE_DISPOSITIVO);
  if (guardado) return guardado;
  enMemoria ??= crypto.randomUUID();
  escribir(CLAVE_DISPOSITIVO, enMemoria);
  return enMemoria;
}

/** Publicaciones a las que este celular ya dio gracias. */
export function graciasDadas(): ReadonlySet<string> {
  try {
    const lista: unknown = JSON.parse(leer(CLAVE_AGRADECIDOS) ?? '[]');
    return new Set(Array.isArray(lista) ? lista.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

export function recordarGracias(eventoId: string): void {
  const lista = [...graciasDadas(), eventoId].slice(-MAX_AGRADECIDOS);
  escribir(CLAVE_AGRADECIDOS, JSON.stringify(lista));
}
