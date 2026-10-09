import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';

/**
 * Revela el elemento con una animacion cuando entra en pantalla al hacer scroll.
 * Un solo IntersectionObserver compartido para toda la app (rendimiento).
 */
let observador: IntersectionObserver | null = null;

function obtenerObservador(): IntersectionObserver | null {
  if (typeof IntersectionObserver === 'undefined') return null;
  observador ??= new IntersectionObserver(
    (entradas) => {
      for (const entrada of entradas) {
        if (!entrada.isIntersecting) continue;
        entrada.target.classList.add('revelado');
        observador?.unobserve(entrada.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );
  return observador;
}

@Directive({ selector: '[srRevelar]', host: { class: 'por-revelar' } })
export class Revelar {
  constructor() {
    const elemento = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const obs = obtenerObservador();
    if (!obs) {
      elemento.classList.add('revelado');
      return;
    }
    obs.observe(elemento);
    inject(DestroyRef).onDestroy(() => obs.unobserve(elemento));
  }
}
