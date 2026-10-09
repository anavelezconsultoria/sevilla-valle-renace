import { ChangeDetectionStrategy, Component, DestroyRef, inject, output, signal } from '@angular/core';
import { form, FormField, maxLength, minLength, required, submit, validate } from '@angular/forms/signals';
import { ErrorLimiteEnvios, SesionGateway } from '../../core/ports/necesidades.ports';

interface DatosIdentificacion {
  alias: string;
  celular: string;
}

const CELULAR_CO = /^3\d{9}$/;

/**
 * Identificacion de quien ayuda, sin correo: un alias publico y un celular
 * privado. Entra al instante; la sesion queda guardada en este celular.
 */
@Component({
  selector: 'sr-identificarse-form',
  imports: [FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="form" (submit)="enviar($event)" novalidate>
      <label class="field">
        <span class="field-label">¿Cómo quieres aparecer?</span>
        <input class="input" [formField]="formulario.alias" autocomplete="nickname" placeholder="Ej.: Marta, Parroquia San Luis, Bomberos" />
        <span class="field-hint">Es público: así sabrán quién ayudó.</span>
        @if (mostrarError(formulario.alias().errors(), formulario.alias().touched())) {
          <span class="field-error">{{ formulario.alias().errors()[0]?.message }}</span>
        }
      </label>
      <label class="field">
        <span class="field-label">Tu celular</span>
        <input class="input" type="tel" inputmode="numeric" [formField]="formulario.celular" autocomplete="tel" placeholder="3001234567" />
        <span class="field-hint">Privado. Solo lo ve la coordinación si necesita contactarte. No es público.</span>
        @if (mostrarError(formulario.celular().errors(), formulario.celular().touched())) {
          <span class="field-error">{{ formulario.celular().errors()[0]?.message }}</span>
        }
      </label>
      @if (error(); as e) {
        <p class="error" role="alert">{{ e }}</p>
      }
      <button type="submit" class="btn btn-primary btn-block" [disabled]="enviando() || espera() > 0">
        @if (enviando()) {
          Entrando...
        } @else if (espera() > 0) {
          Intenta de nuevo en {{ espera() }} s
        } @else {
          Continuar
        }
      </button>
    </form>
  `,
  styles: `
    .form { display: grid; gap: var(--space-3); }
    .error { font-size: var(--text-sm); padding: var(--space-3); border-radius: var(--radius-sm); background: var(--estado-pendiente-bg); color: var(--estado-pendiente); animation: aparecer var(--dur-media) var(--ease-salida); }
  `,
})
export class IdentificarseForm {
  private readonly sesion = inject(SesionGateway);
  readonly identificado = output<void>();

  protected readonly modelo = signal<DatosIdentificacion>({ alias: '', celular: '' });
  protected readonly enviando = signal(false);
  protected readonly intento = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Segundos que faltan para poder reintentar despues de un limite de intentos. */
  protected readonly espera = signal(0);
  private temporizador: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.detenerCuenta());
  }

  protected readonly formulario = form(this.modelo, (p) => {
    required(p.alias, { message: 'Escribe cómo quieres aparecer.' });
    minLength(p.alias, 2, { message: 'Mínimo 2 caracteres.' });
    maxLength(p.alias, 40, { message: 'Máximo 40 caracteres.' });
    validate(p.celular, ({ value }) =>
      CELULAR_CO.test(value().replace(/\D/g, '')) ? null : { kind: 'celular', message: 'Escribe un celular de 10 dígitos que empiece por 3.' },
    );
  });

  protected mostrarError(errores: readonly unknown[], tocado: boolean): boolean {
    return errores.length > 0 && (tocado || this.intento());
  }

  protected async enviar(evento: Event): Promise<void> {
    evento.preventDefault();
    this.intento.set(true);
    await submit(this.formulario, async () => {
      this.enviando.set(true);
      this.error.set(null);
      try {
        await this.sesion.iniciarSesion(this.modelo());
        this.identificado.emit();
      } catch (e) {
        this.mostrarFallo(e);
      } finally {
        this.enviando.set(false);
      }
      return undefined;
    });
  }

  private mostrarFallo(e: unknown): void {
    this.error.set(e instanceof Error ? e.message : 'No pudimos continuar. Inténtalo de nuevo.');
    if (e instanceof ErrorLimiteEnvios) this.iniciarCuenta(e.segundosEspera);
  }

  private iniciarCuenta(segundos: number): void {
    this.detenerCuenta();
    this.espera.set(segundos);
    this.temporizador = setInterval(() => {
      this.espera.update((s) => s - 1);
      if (this.espera() <= 0) this.detenerCuenta();
    }, 1000);
  }

  private detenerCuenta(): void {
    if (this.temporizador) clearInterval(this.temporizador);
    this.temporizador = null;
  }
}
