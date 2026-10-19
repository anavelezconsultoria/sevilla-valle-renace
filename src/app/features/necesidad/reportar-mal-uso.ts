import { ChangeDetectionStrategy, Component, effect, ElementRef, inject, input, signal } from '@angular/core';
import { LARGO_NOTA_REPORTE, MOTIVOS_REPORTE, MotivoReporte } from '../../core/domain/reporte-mal-uso';
import { ReportesGateway } from '../../core/ports/necesidades.ports';

/**
 * Cualquier vecino puede avisar a la coordinacion si una solicitud se usa mal
 * (por ejemplo, para vender las ayudas). Anonimo: no pide nombre ni celular.
 */
@Component({
  selector: 'sr-reportar-mal-uso',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (enviado()) {
      <p class="hecho" role="status">Gracias. La coordinación revisará esta solicitud. Tu reporte es anónimo.</p>
    } @else if (!abierto()) {
      <button type="button" class="enlace" (click)="abierto.set(true)">Reportar mal uso de esta solicitud</button>
    } @else {
      <form class="card formulario" (submit)="enviar($event)">
        <h2>Reportar mal uso</h2>
        <p class="muted">Es anónimo. Solo lo ve la coordinación, que revisará el caso antes de decidir.</p>
        <fieldset>
          <legend class="visually-hidden">Motivo</legend>
          @for (m of motivos; track m[0]) {
            <label class="opcion" [class.elegida]="motivo() === m[0]">
              <input type="radio" name="motivo" [value]="m[0]" [checked]="motivo() === m[0]" (change)="motivo.set(m[0])" />
              <span>{{ m[1] }}</span>
            </label>
          }
        </fieldset>
        <label class="field">
          <span class="field-label">Cuéntanos más <span class="muted">(opcional)</span></span>
          <textarea class="input" rows="3" [attr.maxlength]="largoNota" [value]="nota()" (input)="alEscribir($event)" placeholder="Ej.: la vi vendiendo el mercado en la galería"></textarea>
        </label>
        @if (error(); as e) {
          <p class="field-error" role="alert">{{ e }}</p>
        }
        <div class="acciones">
          <button type="submit" class="btn btn-primary" [disabled]="!motivo() || enviando()">{{ enviando() ? 'Enviando...' : 'Enviar reporte' }}</button>
          <button type="button" class="btn btn-ghost" (click)="abierto.set(false)">Cancelar</button>
        </div>
      </form>
    }
  `,
  styles: `
    :host { display: block; }
    .enlace { display: block; margin-inline: auto; padding: 8px; border: 0; background: none; font: inherit; font-size: var(--text-sm); font-weight: 600; color: var(--color-tenue); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
    .enlace:hover { color: var(--color-tinta); }
    .formulario { display: grid; gap: var(--space-3); padding: var(--space-5); }
    h2 { font-family: var(--font-body); font-weight: 700; font-size: var(--text-lg); }
    fieldset { display: grid; gap: var(--space-2); margin: 0; padding: 0; border: 0; }
    .opcion { display: flex; align-items: center; gap: var(--space-2); min-height: 44px; padding: 8px 12px; border: 1px solid var(--color-linea); border-radius: var(--radius-sm); font-size: var(--text-sm); cursor: pointer; transition: border-color .2s, background-color .2s; }
    .opcion.elegida { border-color: var(--color-primario); background: var(--color-primario-suave); }
    .opcion input { accent-color: var(--color-primario); }
    textarea { resize: vertical; }
    .acciones { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .hecho { padding: var(--space-3); border-radius: var(--radius-sm); background: var(--color-arena); font-size: var(--text-sm); font-weight: 600; text-align: center; }
  `,
})
export class ReportarMalUso {
  private readonly reportes = inject(ReportesGateway);
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly necesidadId = input.required<string>();
  /** Abre el formulario al llegar (enlace "Reportar" desde la comunidad). */
  readonly abrirAlCargar = input(false);

  protected readonly motivos = Object.entries(MOTIVOS_REPORTE) as [MotivoReporte, string][];
  protected readonly largoNota = LARGO_NOTA_REPORTE;
  protected readonly abierto = signal(false);
  protected readonly motivo = signal<MotivoReporte | null>(null);
  protected readonly nota = signal('');
  protected readonly enviando = signal(false);
  protected readonly enviado = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (!this.abrirAlCargar()) return;
      this.abierto.set(true);
      setTimeout(() => this.elemento.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    });
  }

  protected alEscribir(evento: Event): void {
    this.nota.set((evento.target as HTMLTextAreaElement).value);
  }

  protected async enviar(evento: Event): Promise<void> {
    evento.preventDefault();
    const motivo = this.motivo();
    if (!motivo) return;
    this.enviando.set(true);
    this.error.set(null);
    try {
      await this.reportes.reportar({ necesidadId: this.necesidadId(), motivo, nota: this.nota().trim() });
      this.enviado.set(true);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo enviar el reporte.');
    } finally {
      this.enviando.set(false);
    }
  }
}
