import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ErrorRegistrado } from '../../core/ports/necesidades.ports';
import { tiempoRelativo } from '../../shared/lib/tiempo';
import { CoordinacionEstado } from './coordinacion-estado';

/** Nombre corto del celular o navegador a partir del user agent. */
function dispositivo(navegador: string): string {
  const ios = navegador.match(/iPhone OS (\d+)_(\d+)/);
  if (ios) return `iPhone con iOS ${ios[1]}.${ios[2]}`;
  const android = navegador.match(/Android (\d+)/);
  if (android) return `Android ${android[1]}`;
  if (/Windows/.test(navegador)) return 'Computador Windows';
  if (/Macintosh/.test(navegador)) return 'Mac';
  return 'Otro dispositivo';
}

interface ExplicacionError {
  readonly patron: RegExp;
  readonly texto: string;
  /** true: no hay que hacer nada, la pagina ya lo resuelve sola. */
  readonly normal: boolean;
}

/** Errores conocidos explicados en lenguaje simple para la coordinacion. */
const EXPLICACIONES: readonly ExplicacionError[] = [
  {
    patron: /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i,
    texto: 'Normal después de una actualización: tenía la versión anterior abierta y la página se recargó sola.',
    normal: true,
  },
  {
    patron: /Failed to fetch|NetworkError|Load failed|network request failed/i,
    texto: 'Se quedó sin internet o con mala señal en ese momento. Si se repite mucho, puede ser la señal de esa zona.',
    normal: true,
  },
  {
    patron: /is not a function/i,
    texto: 'Celular con sistema viejo. Si ya pasó hace días, probablemente ya está corregido.',
    normal: false,
  },
];

function explicar(mensaje: string): ExplicacionError | undefined {
  return EXPLICACIONES.find((x) => x.patron.test(mensaje));
}

/**
 * Errores de la pagina en el celular de la gente. Sirve para enterarse antes
 * de que alguien escriba por WhatsApp. Sin datos personales.
 */
@Component({
  selector: 'sr-errores-recientes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card herramienta">
      <p class="eyebrow">Coordinación</p>
      <h2>Errores de la página</h2>
      <p class="muted">Lo que le ha fallado a la gente en su celular. Los marcados como normales no necesitan nada; si ves otro que se repite, avísale a quien mantiene la página.</p>
      @if (estado.cargando()) {
        <p class="muted">Cargando...</p>
      } @else if (!estado.errores().length) {
        <p class="vacio">Sin errores registrados. Todo funcionando.</p>
      } @else {
        <ul class="lista">
          @for (e of estado.errores(); track $index) {
            <li class="item">
              <div class="fila">
                <code>{{ e.mensaje }}</code>
                <span class="veces" [class.muchas]="e.veces > 3">{{ e.veces }} {{ e.veces === 1 ? 'vez' : 'veces' }}</span>
              </div>
              <span class="muted">{{ e.ruta || '/' }} · {{ dispositivo(e) }} · última {{ hace(e) }}</span>
              @if (explicacion(e); as x) {
                <span class="explicacion" [class.normal]="x.normal">{{ x.texto }}</span>
              }
            </li>
          }
        </ul>
      }
      @if (estado.errorErrores(); as m) {
        <p class="field-error" role="alert">{{ m }}</p>
      }
    </section>
  `,
  styles: `
    .herramienta { display: grid; gap: var(--space-3); padding: var(--space-5); max-width: 560px; }
    h2 { font-family: var(--font-body); font-weight: 700; font-size: var(--text-lg); }
    .lista { display: grid; gap: var(--space-2); list-style: none; margin: 0; padding: 0; max-height: 420px; overflow-y: auto; }
    .item { display: grid; gap: 4px; padding: var(--space-3); border: 1px solid var(--color-linea); border-radius: var(--radius-sm); }
    .fila { display: flex; justify-content: space-between; gap: var(--space-2); align-items: flex-start; }
    code { font-size: var(--text-xs); overflow-wrap: anywhere; color: var(--color-texto); }
    .veces { flex: none; font-size: var(--text-xs); font-weight: 700; color: var(--color-tenue); }
    .veces.muchas { color: var(--color-primario-fuerte); }
    .item .muted { font-size: var(--text-xs); }
    .vacio { font-size: var(--text-sm); color: var(--color-montana); font-weight: 600; }
    .explicacion { font-size: var(--text-xs); font-weight: 600; padding: 4px 8px; border-radius: var(--radius-sm); background: var(--color-acento-suave); color: var(--color-texto); }
    .explicacion.normal { background: var(--color-arena); color: var(--color-tenue); }
  `,
})
export class ErroresRecientes {
  protected readonly estado = inject(CoordinacionEstado);

  protected dispositivo(e: ErrorRegistrado): string {
    return dispositivo(e.navegador);
  }

  protected explicacion(e: ErrorRegistrado): ExplicacionError | undefined {
    return explicar(e.mensaje);
  }

  protected hace(e: ErrorRegistrado): string {
    return tiempoRelativo(e.ultimaVez);
  }
}
