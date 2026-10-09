import { ChangeDetectionStrategy, Component } from '@angular/core';

const COLORES = ['#2b4cf2', '#7c5cf0', '#d7bafc', '#1b8a5e', '#9ab0ff'] as const;
const PIEZAS = 28;

interface Pieza {
  readonly x: number;
  readonly giro: number;
  readonly retraso: number;
  readonly color: string;
  readonly forma: 'hoja' | 'punto';
}

/**
 * Celebracion breve cuando una ayuda llega: hojas y semillas en los colores de
 * la marca que caen una sola vez. Decorativa: oculta para lectores de pantalla.
 */
@Component({
  selector: 'sr-celebracion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lluvia" aria-hidden="true">
      @for (p of piezas; track $index) {
        <span
          [class]="'pieza ' + p.forma"
          [style.left.%]="p.x"
          [style.background]="p.color"
          [style.--giro.deg]="p.giro"
          [style.animation-delay.ms]="p.retraso"
        ></span>
      }
    </div>
  `,
  styles: `
    .lluvia { position: fixed; inset: 0; pointer-events: none; overflow: hidden; z-index: 2000; }
    .pieza { position: absolute; top: -20px; animation: caer-lluvia 2.4s cubic-bezier(.2,.7,.4,1) forwards; opacity: 0; }
    .hoja { width: 10px; height: 16px; border-radius: 100% 0; }
    .punto { width: 8px; height: 8px; border-radius: 50%; }
    @keyframes caer-lluvia {
      0% { opacity: 1; transform: translateY(0) rotate(0); }
      100% { opacity: 0; transform: translateY(105vh) rotate(var(--giro)); }
    }
    @media (prefers-reduced-motion: reduce) { .lluvia { display: none; } }
  `,
})
export class Celebracion {
  protected readonly piezas: readonly Pieza[] = Array.from({ length: PIEZAS }, (_, i) => ({
    x: Math.random() * 100,
    giro: 180 + Math.random() * 540,
    retraso: Math.random() * 500,
    color: COLORES[i % COLORES.length]!,
    forma: i % 3 === 0 ? 'punto' : 'hoja',
  }));
}
