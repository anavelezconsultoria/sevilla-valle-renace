/**
 * Reglas de la clave de 4 numeros de quien pide ayuda. Son las mismas que
 * aplica la base (_validar_clave y registrar_necesidad): aqui se validan antes
 * de enviar para que la persona vea el error en el paso correcto.
 */

export const LARGO_CLAVE = 4;

/** Claves que cualquiera probaria primero. */
const CLAVES_OBVIAS: ReadonlySet<string> = new Set([
  '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234', '4321', '0123', '9876',
]);

export interface ValidacionClave {
  readonly clave: string;
  /** Solo digitos. Quien ayuda lo ve, asi que la clave no puede salir de el. */
  readonly telefono: string;
}

export function soloDigitos(texto: string): string {
  return texto.replace(/\D/g, '');
}

/** Devuelve el motivo por el que la clave no sirve, o null si es valida. */
export function motivoClaveInvalida({ clave, telefono }: ValidacionClave): string | null {
  if (!new RegExp(`^\\d{${LARGO_CLAVE}}$`).test(clave)) return `La clave debe tener ${LARGO_CLAVE} números.`;
  if (CLAVES_OBVIAS.has(clave)) return 'Esa clave es muy fácil de adivinar. Elige otra.';
  if (telefono.length >= LARGO_CLAVE && telefono.endsWith(clave)) return 'La clave no puede ser el final de tu celular. Elige otra.';
  return null;
}

/** Celular con solo los ultimos digitos visibles, para recordarle a la persona cual uso. */
export function enmascararTelefono(telefono: string): string {
  const digitos = soloDigitos(telefono);
  return digitos.length < 7 ? digitos : `${digitos.slice(0, 3)} ••• ${digitos.slice(-4)}`;
}
