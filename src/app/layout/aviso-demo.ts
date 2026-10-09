import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ModoDatos } from '../core/ports/necesidades.ports';
import { DemoBackend } from '../infrastructure/demo/demo-backend';

/** Aviso permanente mientras los datos sean de ejemplo: nadie debe confundirlos con casos reales. */
@Component({
  selector: 'sr-aviso-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (esDemo && visible()) {
      <div class="aviso" role="status">
        <strong class="largo">Modo demostración.</strong><strong class="corto">Demo</strong>
        <span class="largo">Los casos que ves son ficticios. Prueba el seguimiento con el código <code>DEMO-ALIM</code>.</span>
        <span class="corto">Datos ficticios · código <code>DEMO-ALIM</code></span>
        <button type="button" class="reiniciar" (click)="reiniciar()">Reiniciar datos</button>
        <button type="button" class="cerrar" (click)="visible.set(false)" aria-label="Ocultar aviso">×</button>
      </div>
    }
  `,
  styles: `
    .aviso { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 4px 12px; padding: 8px var(--gutter); background: var(--color-navy); color: #f5f3ff; font-size: var(--text-xs); text-align: center; }
    code { background: rgba(255,255,255,.15); padding: 1px 6px; border-radius: 4px; font-weight: 700; }
    button { background: none; border: 1px solid rgba(255,255,255,.35); color: inherit; border-radius: var(--radius-pill); padding: 2px 10px; font-size: var(--text-xs); cursor: pointer; }
    .cerrar { border: 0; font-size: 16px; padding: 0 6px; }
    .corto { display: none; }
    @media (max-width: 640px) {
      .aviso { flex-wrap: nowrap; justify-content: space-between; padding-block: 6px; }
      .largo { display: none; }
      .corto { display: inline; white-space: nowrap; }
      .reiniciar { display: none; }
    }
  `,
})
export class AvisoDemo {
  protected readonly esDemo = inject(ModoDatos).esDemo;
  protected readonly visible = signal(true);
  private readonly demo = inject(DemoBackend, { optional: true });

  protected reiniciar(): void {
    this.demo?.reiniciar();
  }
}
