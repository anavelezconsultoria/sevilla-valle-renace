/**
 * Complementos para Safari de iPhone viejos (iOS 15 y anteriores a 15.4).
 * Muchas familias de Sevilla tienen el celular sin actualizar; sin esto la app
 * falla con errores como "toSorted is not a function". Solo se definen si el
 * navegador no las trae, asi que en celulares nuevos no cambia nada.
 * Se importa PRIMERO en main.ts, antes que Angular y las librerias.
 */

interface ConAt<T> {
  readonly length: number;
  readonly [indice: number]: T;
}

function definir(objetivo: object, nombre: string, valor: unknown): void {
  if (nombre in objetivo) return;
  Object.defineProperty(objetivo, nombre, { value: valor, writable: true, configurable: true });
}

function posicion<T>(this: ConAt<T>, indice: number): T | undefined {
  const entero = Math.trunc(indice) || 0;
  const real = entero < 0 ? this.length + entero : entero;
  return real >= 0 && real < this.length ? this[real] : undefined;
}

definir(Object, 'hasOwn', (objeto: object, clave: PropertyKey) => Object.prototype.hasOwnProperty.call(objeto, clave));
definir(Array.prototype, 'at', posicion);
definir(String.prototype, 'at', function (this: string, indice: number) {
  return posicion.call(this, indice);
});
definir(Array.prototype, 'findLastIndex', function <T>(this: T[], cumple: (e: T, i: number, a: T[]) => boolean) {
  for (let i = this.length - 1; i >= 0; i--) if (cumple(this[i], i, this)) return i;
  return -1;
});
definir(Array.prototype, 'findLast', function <T>(this: T[], cumple: (e: T, i: number, a: T[]) => boolean) {
  for (let i = this.length - 1; i >= 0; i--) if (cumple(this[i], i, this)) return this[i];
  return undefined;
});
definir(Array.prototype, 'toSorted', function <T>(this: T[], comparar?: (a: T, b: T) => number) {
  return [...this].sort(comparar);
});
definir(Array.prototype, 'toReversed', function <T>(this: T[]) {
  return [...this].reverse();
});
