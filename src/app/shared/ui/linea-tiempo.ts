import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EventoNecesidad } from '../../core/domain/necesidad.model';
import { EVENTOS } from '../../core/domain/catalogos';
import { fechaCorta } from '../lib/tiempo';

@Component({
  selector: 'sr-linea-tiempo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="linea">
      @for (e of eventos(); track e.id) {
        <li [attr.data-tipo]="e.tipo">
          <span class="punto" aria-hidden="true"></span>
          <div class="contenido">
            <p class="titulo">{{ etiquetas[e.tipo] }}</p>
            <p class="meta">{{ fecha(e.ocurridoEn) }} · {{ e.actor }}</p>
            @if (e.nota) {
              <p class="nota">“{{ e.nota }}”</p>
            }
            @if (e.evidencias.length) {
              <div class="fotos">
                @for (f of e.evidencias; track f.id) {
                  <a [href]="f.url" target="_blank" rel="noopener"><img [src]="f.url" [alt]="f.descripcion" loading="lazy" /></a>
                }
              </div>
            }
          </div>
        </li>
      }
    </ol>
  `,
  styles: `
    .linea { list-style: none; margin: 0; padding: 0; display: grid; }
    li { position: relative; display: grid; grid-template-columns: 20px 1fr; gap: var(--space-3); padding-bottom: var(--space-5); }
    li:not(:last-child)::after { content: ''; position: absolute; left: 9px; top: 18px; bottom: 0; width: 2px; background: var(--color-line); }
    .punto { width: 20px; height: 20px; border-radius: 50%; background: var(--color-surface); border: 3px solid var(--color-blue); margin-top: 1px; }
    li[data-tipo='confirmada'] .punto, li[data-tipo='cerrada_automaticamente'] .punto { border-color: var(--estado-exito); background: var(--estado-exito); }
    li[data-tipo='entregada'] .punto { border-color: var(--estado-entregada); }
    li[data-tipo='liberada'] .punto, li[data-tipo='liberada_por_vencimiento'] .punto, li[data-tipo='no_recibida'] .punto, li[data-tipo='cancelada'] .punto { border-color: var(--estado-pendiente); }
    .titulo { font-weight: 600; font-size: var(--text-sm); color: var(--color-ink); }
    .meta { font-size: var(--text-xs); color: var(--color-muted); }
    .nota { margin-top: var(--space-2); font-size: var(--text-sm); color: var(--color-text); font-style: italic; }
    .fotos { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-3); }
    .fotos img { width: 112px; height: 84px; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--color-line); }
  `,
})
export class LineaTiempo {
  readonly eventos = input.required<readonly EventoNecesidad[]>();
  protected readonly etiquetas = EVENTOS;
  protected readonly fecha = fechaCorta;
}
