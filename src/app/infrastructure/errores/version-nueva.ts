/**
 * Cuando se publica una version nueva, los archivos cambian de nombre. Quien
 * tenia la pagina abierta pide un archivo viejo que ya no existe y la pantalla
 * no carga ("Failed to fetch dynamically imported module" en Android, "Importing
 * a module script failed" en iPhone). La solucion es recargar una vez hacia la
 * pantalla que queria: asi baja la version nueva.
 */
const PATRON_ARCHIVO_VIEJO =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk [\w-]+ failed/i;
const CLAVE_ULTIMA_RECARGA = 'sr-recarga-por-version';
/** Evita un ciclo de recargas si el problema fuera otro (por ejemplo, sin internet). */
const ESPERA_ENTRE_RECARGAS_MS = 30_000;

export function esArchivoDeVersionVieja(error: unknown): boolean {
  const mensaje = error instanceof Error ? error.message : String(error);
  return PATRON_ARCHIVO_VIEJO.test(mensaje);
}

/** Recarga hacia la ruta pedida. Devuelve false si ya se recargo hace poco. */
export function recargarConVersionNueva(ruta?: string): boolean {
  try {
    const ultima = Number(sessionStorage.getItem(CLAVE_ULTIMA_RECARGA) ?? 0);
    if (Date.now() - ultima < ESPERA_ENTRE_RECARGAS_MS) return false;
    sessionStorage.setItem(CLAVE_ULTIMA_RECARGA, String(Date.now()));
  } catch {
    /* Sin almacenamiento: recarga igual, una vez por carga de pagina. */
  }
  location.assign(ruta ?? location.href);
  return true;
}
