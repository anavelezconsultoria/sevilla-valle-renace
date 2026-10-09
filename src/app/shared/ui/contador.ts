import { DestroyRef, Directive, effect, ElementRef, inject, input } from '@angular/core';

const DURACION_MS = 900;

/** Hace subir la cifra desde su valor anterior hasta el nuevo. Respeta "reducir movimiento". */
@Directive({ selector: '[srContador]' })
export class Contador {
  readonly srContador = input.required<number>();

  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private actual = 0;
  private cuadro = 0;

  constructor() {
    effect(() => this.animarHasta(this.srContador()));
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.cuadro));
  }

  private animarHasta(destino: number): void {
    cancelAnimationFrame(this.cuadro);
    if (this.prefiereSinMovimiento()) {
      this.pintar(destino);
      return;
    }
    const origen = this.actual;
    const inicio = performance.now();
    const paso = (ahora: number): void => {
      const t = Math.min(1, (ahora - inicio) / DURACION_MS);
      const suavizado = 1 - Math.pow(1 - t, 3);
      this.pintar(Math.round(origen + (destino - origen) * suavizado));
      if (t < 1) this.cuadro = requestAnimationFrame(paso);
    };
    this.cuadro = requestAnimationFrame(paso);
  }

  private pintar(valor: number): void {
    this.actual = valor;
    this.elemento.textContent = valor.toLocaleString('es-CO');
  }

  private prefiereSinMovimiento(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}
