import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CifrasPublicas } from '../../core/domain/necesidad.model';
import { Contador } from '../../shared/ui/contador';

/** Cifras publicas: lo pendiente y lo resuelto, siempre lado a lado. */
@Component({
  selector: 'sr-panel-cifras',
  imports: [RouterLink, Contador],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let c = cifras();
    <section class="card cifras" aria-label="Cifras en vivo">
      <div class="cabecera">
        <h2>Sevilla hoy</h2>
        <span class="vivo">En vivo</span>
      </div>
      <dl class="grid">
        <div data-tono="pendiente"><dt>Esperando ayuda</dt><dd [srContador]="c.registradas"></dd></div>
        <div data-tono="progreso"><dt>En atención</dt><dd [srContador]="c.enAtencion"></dd></div>
        <div data-tono="entregada"><dt>Por confirmar</dt><dd [srContador]="c.entregadas"></dd></div>
        <div data-tono="exito"><dt>Atendidas</dt><dd [srContador]="c.atendidas"></dd></div>
      </dl>
      <a routerLink="/ayudas-entregadas" class="pie">
        <span [srContador]="c.personasAyudadas"></span> personas ayudadas
        <span class="flecha" aria-hidden="true">→</span>
      </a>
    </section>
  `,
  styles: `
    .cifras { padding: var(--space-4); display: grid; gap: var(--space-3); }
    .cabecera { display: flex; align-items: center; justify-content: space-between; }
    h2 { font-size: var(--text-lg); }
    .vivo { display: inline-flex; align-items: center; gap: 6px; font-size: var(--text-xs); font-weight: 600; color: var(--estado-exito); background: var(--estado-exito-bg); padding: 2px 10px; border-radius: var(--radius-pill); }
    .vivo::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: currentColor; animation: pulso 1.8s infinite; }
    @keyframes pulso { 50% { opacity: .3; transform: scale(.7); } }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); margin: 0; }
    .grid > div { position: relative; padding: 10px 12px 10px 16px; border-radius: var(--radius-sm); background: var(--color-fondo); overflow: hidden; }
    .grid > div::before { content: ''; position: absolute; left: 0; top: 10px; bottom: 10px; width: 3px; border-radius: 3px; background: var(--tono); }
    dt { font-size: var(--text-xs); color: var(--color-tenue); }
    dd { margin: 2px 0 0; font-family: var(--font-titulo); font-weight: 650; font-size: 1.6rem; line-height: 1.1; color: var(--tono); font-variant-numeric: tabular-nums; }
    [data-tono='pendiente'] { --tono: var(--estado-pendiente); }
    [data-tono='progreso'] { --tono: var(--estado-progreso); }
    [data-tono='entregada'] { --tono: var(--estado-entregada); }
    [data-tono='exito'] { --tono: var(--estado-exito); }
    .pie { display: inline-flex; gap: 4px; align-items: center; font-size: var(--text-sm); font-weight: 600; color: var(--color-montana); text-decoration: none; }
    .flecha { transition: transform var(--dur-corta) var(--ease-salida); }
    .pie:hover .flecha { transform: translateX(3px); }
  `,
})
export class PanelCifras {
  readonly cifras = input.required<CifrasPublicas>();
}
