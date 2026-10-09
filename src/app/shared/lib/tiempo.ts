const FORMATO_RELATIVO = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
const FORMATO_FECHA = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

const UNIDADES: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];

/** "hace 3 horas", "en 2 días". */
export function tiempoRelativo(iso: string, ahora: Date = new Date()): string {
  const diferencia = new Date(iso).getTime() - ahora.getTime();
  for (const [unidad, ms] of UNIDADES) {
    if (Math.abs(diferencia) >= ms) return FORMATO_RELATIVO.format(Math.round(diferencia / ms), unidad);
  }
  return 'justo ahora';
}

export function fechaCorta(iso: string): string {
  return FORMATO_FECHA.format(new Date(iso));
}
