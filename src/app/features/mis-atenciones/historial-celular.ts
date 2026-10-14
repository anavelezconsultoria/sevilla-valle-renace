import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, signal } from '@angular/core';
import { CoordinacionGateway, HistorialCelular, SolicitudDelHistorial } from '../../core/ports/necesidades.ports';
import { ESTADOS, infoCategoria } from '../../core/domain/catalogos';
import { DIAS_AYUDA_RECIENTE } from '../../core/domain/revision-hogar';
import { soloDigitos } from '../../core/domain/clave-solicitante';
import { fechaCorta } from '../../shared/lib/tiempo';

const LARGO_TELEFONO = 10;
const MS_POR_DIA = 86_400_000;

/**
 * Herramienta de la coordinacion: todo lo de un celular en un solo lugar.
 * Privado: nombres y celulares solo los ve la coordinacion, nunca el publico.
 */
@Component({
  selector: 'sr-historial-celular',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card herramienta">
      <p class="eyebrow">Coordinación</p>
      <h2>Historial de un celular</h2>
      <p class="muted">Qué ha pedido, qué le llegó y si también ayuda. Úsalo para repartir mejor, nunca para publicar.</p>
      <form (submit)="buscar($event)" class="buscador">
        <input class="input" [value]="telefono()" (input)="alEscribir($event)" type="tel" inputmode="numeric" placeholder="3001234567" aria-label="Celular" />
        <button type="submit" class="btn btn-primary" [disabled]="telefono().length !== largo || buscando()">{{ buscando() ? 'Buscando...' : 'Buscar' }}</button>
      </form>

      @if (error(); as e) {
        <p class="field-error" role="alert">{{ e }}</p>
      }

      @if (historial(); as h) {
        @if (!h.solicitudes.length && !h.ayudante) {
          <p class="vacio">Ese celular no ha pedido ayuda ni ha ayudado.</p>
        }
        @if (h.solicitudes.length) {
          <p class="resumen" [class.alerta]="recibidasRecientes() >= 2">
            {{ h.solicitudes.length }} {{ h.solicitudes.length === 1 ? 'solicitud' : 'solicitudes' }} ·
            {{ recibidasRecientes() }} {{ recibidasRecientes() === 1 ? 'ayuda recibida' : 'ayudas recibidas' }} en los últimos {{ dias }} días
          </p>
          <ul class="lista">
            @for (s of h.solicitudes; track s.id) {
              <li class="item">
                <strong>{{ s.titulo }}</strong>
                <span class="muted">{{ etiquetaCategoria(s) }} · {{ estado(s) }} · pidió {{ fecha(s.registradaEn) }}</span>
                @if (s.entregadaEn) {
                  <span class="muted">Le llegó {{ fecha(s.entregadaEn) }}{{ s.ayudante ? ' · la llevó ' + s.ayudante : '' }}</span>
                }
                @if (s.motivoRevision) {
                  <span class="nota">Revisión: {{ s.motivoRevision }}</span>
                }
              </li>
            }
          </ul>
        }
        @if (h.parecidas.length) {
          <div class="bloque">
            <h3>Posible mismo hogar</h3>
            <p class="muted">Otros celulares con el mismo nombre en el mismo sector. Confírmalo con una llamada.</p>
            <ul class="lista">
              @for (p of h.parecidas; track p.telefono) {
                <li class="item">{{ p.nombre }} · {{ p.sector }} · {{ p.telefono }} · {{ p.solicitudes }} {{ p.solicitudes === 1 ? 'solicitud' : 'solicitudes' }}</li>
              }
            </ul>
          </div>
        }
        @if (h.ayudante; as a) {
          <div class="bloque">
            <h3>También ayuda como «{{ a.alias }}»</h3>
            <p class="muted">Tomó {{ a.tomadas }} · entregó {{ a.entregas }} · liberó {{ a.liberadas }} · se le vencieron {{ a.vencidas }}</p>
          </div>
        }
      }
    </section>
  `,
  styles: `
    .herramienta { display: grid; gap: var(--space-3); padding: var(--space-5); margin-top: var(--space-5); max-width: 560px; }
    h2 { font-family: var(--font-body); font-weight: 700; font-size: var(--text-lg); }
    h3 { font-family: var(--font-body); font-weight: 700; font-size: var(--text-md); }
    .buscador { display: flex; gap: var(--space-2); }
    .buscador .input { flex: 1; min-width: 0; }
    .resumen { font-size: var(--text-sm); font-weight: 600; padding: var(--space-2) var(--space-3); border-radius: var(--radius-sm); background: var(--color-arena); }
    .resumen.alerta { background: var(--color-acento-suave); color: var(--color-acento); }
    .lista { display: grid; gap: var(--space-2); list-style: none; margin: 0; padding: 0; }
    .item { display: grid; gap: 2px; padding: var(--space-3); border: 1px solid var(--color-linea); border-radius: var(--radius-sm); font-size: var(--text-sm); }
    .item .muted { font-size: var(--text-xs); }
    .nota { font-size: var(--text-xs); color: var(--color-acento); font-weight: 600; }
    .bloque { display: grid; gap: var(--space-2); margin-top: var(--space-2); }
    .vacio { font-size: var(--text-sm); color: var(--color-tenue); }
  `,
})
export class HistorialCelularHerramienta {
  private readonly coordinacion = inject(CoordinacionGateway);
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Celular elegido desde otra herramienta (por ejemplo, la lista de hogares). */
  readonly celularElegido = input<string | null>(null);

  protected readonly largo = LARGO_TELEFONO;
  protected readonly dias = DIAS_AYUDA_RECIENTE;
  protected readonly telefono = signal('');
  protected readonly buscando = signal(false);
  protected readonly historial = signal<HistorialCelular | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly recibidasRecientes = computed(() => {
    const limite = Date.now() - DIAS_AYUDA_RECIENTE * MS_POR_DIA;
    return (this.historial()?.solicitudes ?? []).filter((s) => s.entregadaEn && new Date(s.entregadaEn).getTime() > limite).length;
  });

  constructor() {
    effect(() => {
      const celular = this.celularElegido();
      if (!celular) return;
      this.telefono.set(celular);
      this.elemento.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      void this.consultar();
    });
  }

  protected alEscribir(evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    const limpio = soloDigitos(campo.value).slice(0, LARGO_TELEFONO);
    campo.value = limpio;
    this.telefono.set(limpio);
  }

  protected async buscar(evento: Event): Promise<void> {
    evento.preventDefault();
    await this.consultar();
  }

  private async consultar(): Promise<void> {
    this.buscando.set(true);
    this.error.set(null);
    try {
      this.historial.set(await this.coordinacion.historial(this.telefono()));
    } catch (e) {
      this.historial.set(null);
      this.error.set(e instanceof Error ? e.message : 'No se pudo consultar el historial.');
    } finally {
      this.buscando.set(false);
    }
  }

  protected etiquetaCategoria(s: SolicitudDelHistorial): string {
    return infoCategoria(s.categoria).etiqueta;
  }

  protected estado(s: SolicitudDelHistorial): string {
    return ESTADOS[s.estado].etiqueta;
  }

  protected fecha(iso: string): string {
    return fechaCorta(iso);
  }
}
