import { ChangeDetectionStrategy, Component, DestroyRef, inject, output, signal } from '@angular/core';
import { email, form, FormField, maxLength, minLength, required, submit } from '@angular/forms/signals';
import { ErrorLimiteEnvios, SesionGateway } from '../../core/ports/necesidades.ports';

interface DatosIdentificacion {
  alias: string;
  correo: string;
}

/**
 * Identificacion de quien ayuda: un alias publico y un correo para el enlace de acceso.
 * Sin contrasenas: en produccion llega un enlace al correo (Supabase Auth).
 */
@Component({
  selector: 'sr-identificarse-form',
  imports: [FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (enlaceEnviado()) {
      <p class="ok">Te enviamos un enlace a <strong>{{ modelo().correo }}</strong>. Ábrelo en este mismo celular para continuar.</p>
    } @else {
      <form class="form" (submit)="enviar($event)" novalidate>
        <label class="field">
          <span class="field-label">¿Cómo quieres aparecer?</span>
          <input class="input" [formField]="formulario.alias" placeholder="Ej.: Marta, Parroquia San Luis, Bomberos" />
          <span class="field-hint">Es público: así sabrán quién ayudó.</span>
          @if (mostrarError(formulario.alias().errors(), formulario.alias().touched())) {
            <span class="field-error">{{ formulario.alias().errors()[0]?.message }}</span>
          }
        </label>
        <label class="field">
          <span class="field-label">Correo</span>
          <input class="input" type="email" [formField]="formulario.correo" autocomplete="email" placeholder="tu@correo.com" />
          <span class="field-hint">Privado. Solo lo usamos para que entres sin contraseña.</span>
          @if (mostrarError(formulario.correo().errors(), formulario.correo().touched())) {
            <span class="field-error">{{ formulario.correo().errors()[0]?.message }}</span>
          }
        </label>
        @if (error(); as e) {
          <p class="error" role="alert">{{ e }}</p>
        }
        <button type="submit" class="btn btn-primary btn-block" [disabled]="enviando() || espera() > 0">
          @if (enviando()) {
            Enviando enlace...
          } @else if (espera() > 0) {
            Intenta de nuevo en {{ espera() }} s
          } @else {
            Continuar
          }
        </button>
      </form>
    }
  `,
  styles: `
    .form { display: grid; gap: var(--space-3); }
    .ok { font-size: var(--text-sm); padding: var(--space-3); border-radius: var(--radius-sm); background: var(--estado-exito-bg); animation: aparecer var(--dur-media) var(--ease-salida); }
    .error { font-size: var(--text-sm); padding: var(--space-3); border-radius: var(--radius-sm); background: var(--estado-pendiente-bg); color: var(--estado-pendiente); animation: aparecer var(--dur-media) var(--ease-salida); }
  `,
})
export class IdentificarseForm {
  private readonly sesion = inject(SesionGateway);
  readonly identificado = output<void>();

  protected readonly modelo = signal<DatosIdentificacion>({ alias: '', correo: '' });
  protected readonly enviando = signal(false);
  protected readonly enlaceEnviado = signal(false);
  protected readonly intento = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Segundos que faltan para poder reintentar despues de un limite de envios. */
  protected readonly espera = signal(0);
  private temporizador: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.detenerCuenta());
  }

  protected readonly formulario = form(this.modelo, (p) => {
    required(p.alias, { message: 'Escribe cómo quieres aparecer.' });
    minLength(p.alias, 2, { message: 'Mínimo 2 caracteres.' });
    maxLength(p.alias, 40, { message: 'Máximo 40 caracteres.' });
    required(p.correo, { message: 'Escribe tu correo.' });
    email(p.correo, { message: 'Ese correo no parece válido.' });
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
        const resultado = await this.sesion.iniciarSesion(this.modelo());
        if (resultado === 'enlace_enviado') this.enlaceEnviado.set(true);
        else this.identificado.emit();
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
