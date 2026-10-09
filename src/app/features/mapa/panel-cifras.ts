import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CifrasPublicas } from '../../core/domain/necesidad.model';

/** Cifras publicas: lo pendiente y lo resuelto, siempre lado a lado. */
@Component({
  selector: 'sr-panel-cifras',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let c = cifras();
    <section class="card cifras" aria-label="Cifras en vivo">
      <div class="cabecera">
        <h2>Sevilla hoy</h2>
        <span class="vivo">En vivo</span>
      </div>
      <dl class="grid">
        <div data-tono="pendiente"><dt>Esperando ayuda</dt><dd>{{ c.registradas }}</dd></div>
        <div data-tono="progreso"><dt>En atención</dt><dd>{{ c.enAtencion }}</dd></div>
        <div data-tono="entregada"><dt>Por confirmar</dt><dd>{{ c.entregadas }}</dd></div>
        <div data-tono="exito"><dt>Atendidas</dt><dd>{{ c.atendidas }}</dd></div>
      </dl>
      <a routerLink="/ayudas-entregadas" class="pie">{{ c.personasAyudadas }} personas ayudadas · ver registro</a>
    </section>
  `,
  styles: `
    .cifras { padding: var(--space-4); display: grid; gap: var(--space-3); }
    .cabecera { display: flex; align-items: center; justify-content: space-between; }
    h2 { font-family: var(--font-body); font-weight: 700; font-size: var(--text-md); }
    .vivo { display: inline-flex; align-items: center; gap: 6px; font-size: var(--text-xs); font-weight: 600; color: var(--estado-exito); background: var(--estado-exito-bg); padding: 2px 10px; border-radius: var(--radius-pill); }
    .vivo::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: currentColor; animation: pulso 1.8s infinite; }
    @keyframes pulso { 50% { opacity: .3; } }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); margin: 0; }
    .grid > div { padding: 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--color-line); }
    dt { font-size: var(--text-xs); color: var(--color-muted); }
    dd { margin: 0; font-family: var(--font-display); font-size: 1.4rem; }
    [data-tono='pendiente'] dd { color: var(--estado-pendiente); }
    [data-tono='progreso'] dd { color: var(--estado-progreso); }
    [data-tono='entregada'] dd { color: var(--estado-entregada); }
    [data-tono='exito'] dd { color: var(--estado-exito); }
    .pie { font-size: var(--text-xs); font-weight: 600; color: var(--color-blue); text-decoration: none; }
  `,
})
export class PanelCifras {
  readonly cifras = input.required<CifrasPublicas>();
}
