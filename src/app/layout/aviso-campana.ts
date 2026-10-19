import { afterNextRender, ChangeDetectionStrategy, Component, ElementRef, signal, viewChild } from '@angular/core';

interface Campana {
  /** Cambiarlo hace que el aviso vuelva a salir a todos. */
  readonly id: string;
  readonly imagen: string;
  /** Texto completo de la imagen, para lectores de pantalla. */
  readonly descripcion: string;
  readonly boton: string;
}

const CAMPANA_ACTUAL: Campana = {
  id: 'donaciones-no-se-venden-2026-10',
  imagen: '/campanas/donaciones-no-se-venden.webp',
  descripcion:
    'Un llamado a la conciencia: las donaciones no se venden. Cada mercado, cobija y teja llega porque alguien decidió compartir. ' +
    'Venderlas le quita la ayuda a quien de verdad la necesita. Pide solo lo que necesitas; si te sobra algo, regálalo; ' +
    'si sabes de alguien que vende donaciones, avísale a la coordinación. Quien venda las ayudas no podrá volver a pedir por la plataforma.',
  boton: 'Entendido, entrar',
};

const CLAVE_VISTA = 'sevilla-renace-campana-vista';

function yaLaVio(id: string): boolean {
  try {
    return localStorage.getItem(CLAVE_VISTA) === id;
  } catch {
    return false;
  }
}

function recordarVista(id: string): void {
  try {
    localStorage.setItem(CLAVE_VISTA, id);
  } catch {
    // Sin almacenamiento (modo privado): volvera a salir, no pasa nada.
  }
}

/**
 * Aviso de campana al entrar: la imagen sobre la pagina, una sola vez por
 * celular. Solo se abre cuando la imagen ya cargo, para no mostrar un cuadro vacio.
 */
@Component({
  selector: 'sr-aviso-campana',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dialogo class="aviso" [attr.aria-label]="campana.descripcion" (close)="alCerrar()">
      @if (lista()) {
        <img [src]="campana.imagen" [alt]="campana.descripcion" width="720" height="900" />
      }
      <form method="dialog" class="pie">
        <button type="submit" class="btn btn-primary btn-block">{{ campana.boton }}</button>
      </form>
    </dialog>
  `,
  styles: `
    .aviso { width: min(440px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); padding: 0; border: 0; border-radius: var(--radius-lg); background: var(--color-superficie); box-shadow: 0 30px 80px rgba(42, 39, 102, .35); overflow: hidden; }
    .aviso[open] { display: grid; grid-template-rows: minmax(0, 1fr) auto; animation: entrar .35s var(--ease-salida) both; }
    .aviso::backdrop { background: rgba(42, 39, 102, .55); backdrop-filter: blur(3px); }
    img { display: block; width: 100%; height: 100%; min-height: 0; object-fit: contain; background: #faf8ff; }
    .pie { padding: var(--space-3); }
    @keyframes entrar { from { opacity: 0; transform: translateY(16px) scale(.98); } }
    @media (prefers-reduced-motion: reduce) { .aviso[open] { animation: none; } }
  `,
})
export class AvisoCampana {
  protected readonly campana = CAMPANA_ACTUAL;
  protected readonly lista = signal(false);
  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');

  constructor() {
    afterNextRender(() => {
      if (yaLaVio(this.campana.id)) return;
      const imagen = new Image();
      imagen.onload = () => this.abrir();
      imagen.src = this.campana.imagen;
    });
  }

  protected alCerrar(): void {
    recordarVista(this.campana.id);
  }

  private abrir(): void {
    this.lista.set(true);
    this.dialogo().nativeElement.showModal();
  }
}
