/**
 * Busquedas desde el final de una lista sin Array.prototype.findLast/findLastIndex
 * (ES2023), que no existen en Safari de iOS anteriores a 15.4. La app debe abrir
 * en celulares viejos: muchas familias de Sevilla no tienen el iOS al dia.
 */

/** Posicion del ultimo elemento que cumple la condicion, o -1 si ninguno. */
export function ultimoIndice<T>(lista: readonly T[], cumple: (elemento: T) => boolean): number {
  for (let i = lista.length - 1; i >= 0; i--) {
    if (cumple(lista[i])) return i;
  }
  return -1;
}

/** Ultimo elemento que cumple la condicion, o undefined si ninguno. */
export function ultimo<T>(lista: readonly T[], cumple: (elemento: T) => boolean): T | undefined {
  const indice = ultimoIndice(lista, cumple);
  return indice === -1 ? undefined : lista[indice];
}
