/**
 * Traduce los errores de la base a mensajes para la persona. Un error tecnico
 * ("violates check constraint...") nunca debe llegar crudo a la pantalla.
 */

const RESTRICCIONES: Readonly<Record<string, string>> = {
  necesidades_privado_nombre_check: 'El nombre debe tener entre 2 y 80 letras.',
  necesidades_privado_telefono_check: 'Escribe un celular de 10 dígitos que empiece por 3.',
  necesidades_privado_referencias_check: 'Las indicaciones para llegar pueden tener máximo 200 caracteres.',
  necesidades_titulo_check: 'Lo que necesitas debe tener entre 3 y 80 caracteres.',
  necesidades_descripcion_check: 'Los detalles deben tener entre 15 y 600 caracteres.',
  necesidades_sector_check: 'El barrio o vereda debe tener entre 2 y 80 letras.',
  necesidades_personas_hogar_check: 'Las personas en el hogar deben ser entre 1 y 30.',
  perfiles_alias_check: 'Tu nombre público debe tener entre 2 y 40 letras.',
  perfiles_privado_celular_check: 'Escribe un celular de 10 dígitos que empiece por 3.',
  eventos_necesidad_nota_check: 'La nota puede tener máximo 400 caracteres.',
};

const MENSAJE_GENERICO = 'No pudimos guardar los datos. Revisa el formulario e inténtalo de nuevo.';

/** La pagina quedo abierta con una version anterior a la de la base (la funcion ya no existe). */
const CODIGO_VERSION_VIEJA = 'PGRST202';
const MENSAJE_VERSION_VIEJA = 'Sevilla Renace se actualizó. Recarga la página e inténtalo de nuevo.';

/** Codigos de Postgres que indican un dato invalido o un error interno, no un mensaje de negocio. */
const CODIGOS_TECNICOS = new Set(['23514', '23502', '23505', '22001', '22P02', '42883']);

export interface ErrorBase {
  readonly message: string;
  readonly code?: string;
}

export function mensajeParaPersona({ message, code }: ErrorBase): string {
  const restriccion = Object.keys(RESTRICCIONES).find((nombre) => message.includes(nombre));
  if (restriccion) return RESTRICCIONES[restriccion]!;
  if (code === CODIGO_VERSION_VIEJA) return MENSAJE_VERSION_VIEJA;
  if (code && CODIGOS_TECNICOS.has(code)) return MENSAJE_GENERICO;
  if (/violates|constraint|syntax|relation|column|function/i.test(message)) return MENSAJE_GENERICO;
  // Los mensajes que lanzan nuestras funciones (P0001, P0002, 28000, 42501) ya estan en español.
  return message || MENSAJE_GENERICO;
}
