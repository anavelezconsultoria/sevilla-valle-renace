/**
 * Enlaces de WhatsApp con el mensaje ya escrito. Se abren desde el WhatsApp de
 * quien toca el boton: no hay envio automatico (eso exige la API paga de Meta).
 */

/** Indicativo de Colombia: los celulares se guardan con 10 digitos. */
const INDICATIVO = '57';

/** Numero de la coordinacion: recibe las solicitudes de recuperar clave. */
export const WHATSAPP_COORDINACION = '573155305099';

export function enlaceWhatsappA(celular: string, mensaje: string): string {
  const digitos = celular.replace(/\D/g, '');
  const numero = digitos.length === 10 ? `${INDICATIVO}${digitos}` : digitos;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}
