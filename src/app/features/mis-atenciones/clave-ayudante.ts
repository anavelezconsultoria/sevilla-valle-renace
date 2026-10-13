import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { SesionGateway } from '../../core/ports/necesidades.ports';
import { LARGO_CLAVE, motivoClaveInvalida, soloDigitos } from '../../core/domain/clave-solicitante';

/**
 * Clave de quien ayuda, en Mi panel. Los perfiles creados antes de existir la
 * clave la crean aqui; con celular + clave entran al mismo perfil desde otro celular.
 */
@Component({
  selector: 'sr-clave-ayudante',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (tieneClave() === false) {
      <section class="card clave urgente">
        <h2>Crea tu clave para entrar desde cualquier celular</h2>
        <p class="muted">Con tu celular y esta clave verás todo lo tuyo aunque cambies de navegador o de teléfono. Sin clave, cada celular nuevo empieza un panel vacío.</p>
        <ng-container *ngTemplateOutlet="formulario" />
      </section>
    } @else if (tieneClave()) {
      <details class="card clave">
        <summary>Cambiar mi clave</summary>
        <ng-container *ngTemplateOutlet="formulario" />
      </details>
    }

    <ng-template #formulario>
      <form (submit)="guardar($event)">
        <input class="input entrada" type="password" inputmode="numeric" maxlength="4" [value]="clave()" (input)="alEscribir($event)" placeholder="••••" aria-label="Clave de 4 números" />
        <button type="submit" class="btn btn-primary" [disabled]="ocupado() || clave().length < largo">{{ ocupado() ? 'Guardando...' : 'Guardar clave' }}</button>
      </form>
      @if (mensaje(); as m) {
        <p class="ok" role="status">{{ m }}</p>
      }
      @if (error(); as e) {
        <p class="field-error" role="alert">{{ e }}</p>
      }
    </ng-template>
  `,
  styles: `
    .clave { display: grid; gap: var(--space-3); padding: var(--space-4) var(--space-5); margin-bottom: var(--space-4); }
    .urgente { border: 1.5px solid #f2c770; background: var(--estado-progreso-bg); }
    h2 { font-family: var(--font-body); font-weight: 700; font-size: var(--text-md); }
    summary { cursor: pointer; font-weight: 650; color: var(--color-primario); }
    form { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-2); }
    .entrada { max-width: 180px; font-family: var(--font-marca); letter-spacing: .4em; }
    .ok { font-size: var(--text-sm); font-weight: 600; color: var(--estado-exito); }
  `,
})
export class ClaveAyudante implements OnInit {
  private readonly sesion = inject(SesionGateway);
  protected readonly largo = LARGO_CLAVE;
  /** null mientras se consulta. */
  protected readonly tieneClave = signal<boolean | null>(null);
  protected readonly clave = signal('');
  protected readonly ocupado = signal(false);
  protected readonly mensaje = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  private readonly motivo = computed(() => motivoClaveInvalida({ clave: this.clave(), telefono: '' }));

  async ngOnInit(): Promise<void> {
    try {
      this.tieneClave.set(await this.sesion.tengoClave());
    } catch {
      this.tieneClave.set(null);
    }
  }

  protected alEscribir(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const limpia = soloDigitos(entrada.value).slice(0, LARGO_CLAVE);
    entrada.value = limpia;
    this.clave.set(limpia);
  }

  protected async guardar(evento: Event): Promise<void> {
    evento.preventDefault();
    this.error.set(this.motivo());
    if (this.motivo()) return;
    this.ocupado.set(true);
    this.mensaje.set(null);
    try {
      await this.sesion.establecerClave(this.clave());
      this.mensaje.set('Listo. Desde otro celular entra con tu número y esta clave.');
      this.clave.set('');
      this.tieneClave.set(true);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo guardar la clave.');
    } finally {
      this.ocupado.set(false);
    }
  }
}
