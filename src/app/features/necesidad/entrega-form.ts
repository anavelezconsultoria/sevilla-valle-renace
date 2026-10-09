import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, output, signal } from '@angular/core';
import { AyudanteGateway } from '../../core/ports/necesidades.ports';
import { prepararFoto } from '../../shared/lib/imagen';

const MAX_FOTOS = 3;

interface FotoPreparada {
  readonly blob: Blob;
  readonly vistaPrevia: string;
}

/** Registro de la entrega: nota y hasta 3 fotos opcionales, sin rostros y sin metadatos. */
@Component({
  selector: 'sr-entrega-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="entrega">
      <label class="field">
        <span class="field-label">¿Qué entregaste?</span>
        <textarea class="input" rows="3" maxlength="400" placeholder="Ej.: Un mercado para 6 personas y dos bolsas de agua" (input)="alEscribir($event)"></textarea>
      </label>

      <div class="field">
        <span class="field-label">Fotos de la entrega <span class="muted">(opcional, hasta 3)</span></span>
        <div class="regla">
          <strong>Sin rostros de personas.</strong> Fotografía lo que entregaste: el mercado, los materiales, el lugar. Las fotos se reducen y se les quita la ubicación antes de subirlas.
        </div>
        <div class="fotos">
          @for (f of fotos(); track f.vistaPrevia; let i = $index) {
            <figure>
              <img [src]="f.vistaPrevia" alt="Foto de la entrega {{ i + 1 }}" />
              <button type="button" (click)="quitar(i)" aria-label="Quitar foto">×</button>
            </figure>
          }
          @if (fotos().length < maxFotos) {
            <label class="agregar">
              <input type="file" accept="image/*" capture="environment" (change)="alElegir($event)" class="visually-hidden" />
              <span>{{ procesando() ? 'Procesando...' : '+ Agregar foto' }}</span>
            </label>
          }
        </div>
      </div>

      @if (error(); as e) {
        <p class="field-error" role="alert">{{ e }}</p>
      }

      <div class="botones">
        <button type="button" class="btn btn-success" [disabled]="enviando() || !nota().trim()" (click)="confirmar()">
          {{ enviando() ? 'Guardando...' : 'Confirmar entrega' }}
        </button>
        <button type="button" class="btn btn-ghost" (click)="cancelar.emit()">Cancelar</button>
      </div>
      <p class="field-hint">Quien pidió la ayuda tendrá 48 horas para confirmar que la recibió. Si no responde, se cierra como atendida.</p>
    </div>
  `,
  styles: `
    .entrega { display: grid; gap: var(--space-4); }
    .regla { font-size: var(--text-sm); padding: var(--space-3); border-radius: var(--radius-sm); background: var(--estado-pendiente-bg); }
    .fotos { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    figure { position: relative; margin: 0; }
    figure img { width: 104px; height: 80px; object-fit: cover; border-radius: var(--radius-sm); }
    figure button { position: absolute; top: 4px; right: 4px; width: 24px; height: 24px; border: 0; border-radius: 50%; background: rgba(0,0,0,.6); color: #fff; cursor: pointer; }
    .agregar { width: 104px; height: 80px; display: grid; place-items: center; border: 1.5px dashed var(--color-linea-fuerte); border-radius: var(--radius-sm); font-size: var(--text-xs); font-weight: 600; color: var(--color-primario); cursor: pointer; text-align: center; }
    .botones { display: flex; gap: var(--space-2); flex-wrap: wrap; }
  `,
})
export class EntregaForm {
  private readonly ayudante = inject(AyudanteGateway);
  readonly necesidadId = input.required<string>();
  readonly entregada = output<void>();
  readonly cancelar = output<void>();

  protected readonly maxFotos = MAX_FOTOS;
  protected readonly nota = signal('');
  protected readonly fotos = signal<readonly FotoPreparada[]>([]);
  protected readonly procesando = signal(false);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly blobs = computed(() => this.fotos().map((f) => f.blob));

  constructor() {
    inject(DestroyRef).onDestroy(() => this.fotos().forEach((f) => URL.revokeObjectURL(f.vistaPrevia)));
  }

  protected alEscribir(evento: Event): void {
    this.nota.set((evento.target as HTMLTextAreaElement).value);
  }

  protected async alElegir(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';
    if (!archivo) return;
    this.procesando.set(true);
    this.error.set(null);
    try {
      const blob = await prepararFoto(archivo);
      this.fotos.update((f) => [...f, { blob, vistaPrevia: URL.createObjectURL(blob) }]);
    } catch {
      this.error.set('No pudimos procesar esa foto. Intenta con otra.');
    } finally {
      this.procesando.set(false);
    }
  }

  protected quitar(indice: number): void {
    const foto = this.fotos()[indice];
    if (foto) URL.revokeObjectURL(foto.vistaPrevia);
    this.fotos.update((f) => f.filter((_, i) => i !== indice));
  }

  protected async confirmar(): Promise<void> {
    this.enviando.set(true);
    this.error.set(null);
    try {
      await this.ayudante.entregar({ necesidadId: this.necesidadId(), nota: this.nota().trim(), fotos: this.blobs() });
      this.entregada.emit();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo registrar la entrega.');
    } finally {
      this.enviando.set(false);
    }
  }
}
