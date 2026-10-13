import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, output, signal } from '@angular/core';
import { LARGO_CLAVE, motivoClaveInvalida, soloDigitos } from '../../core/domain/clave-solicitante';
import { form, FormField, submit, validate } from '@angular/forms/signals';
import { ErrorLimiteEnvios, SesionGateway } from '../../core/ports/necesidades.ports';

interface DatosIdentificacion {
  alias: string;
  celular: string;
  clave: string;
}

const CELULAR_CO = /^3\d{9}$/;

type ModoIdentificacion = 'antes' | 'nuevo';

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
      <div class="modos" role="tablist" aria-label="¿Ya ayudaste antes?">
        <button type="button" role="tab" [attr.aria-selected]="modo() === 'antes'" (click)="elegirModo('antes')">Ya ingresé antes</button>
        <button type="button" role="tab" [attr.aria-selected]="modo() === 'nuevo'" (click)="elegirModo('nuevo')">Es mi primera vez</button>
      </div>
      @if (modo() === 'antes') {
        <p class="ayuda">Usa el celular y la clave con que entraste antes, para ayudar o para pedir ayuda: es la misma.</p>
      }
      @if (modo() === 'nuevo') {
      <label class="field">
        <span class="field-label">¿Cómo quieres aparecer?</span>
        <input class="input" [formField]="formulario.alias" autocomplete="nickname" placeholder="Ej.: Marta, Parroquia San Luis, Bomberos" />
        <span class="field-hint">Es público: así sabrán quién ayudó.</span>
        @if (mostrarError(formulario.alias().errors(), formulario.alias().touched())) {
          <span class="field-error">{{ formulario.alias().errors()[0]?.message }}</span>
        }
      </label>
      }
      <label class="field">
        <span class="field-label">Tu celular</span>
        <input class="input" type="tel" inputmode="numeric" [formField]="formulario.celular" autocomplete="tel" placeholder="3001234567" />
        <span class="field-hint">Privado. Solo lo ve la coordinación si necesita contactarte. No es público.</span>
        @if (mostrarError(formulario.celular().errors(), formulario.celular().touched())) {
          <span class="field-error">{{ formulario.celular().errors()[0]?.message }}</span>
        }
      </label>
      <label class="field">
        <span class="field-label">{{ modo() === 'antes' ? 'Tu clave' : 'Crea una clave de 4 números' }}</span>
        <input class="input clave" type="password" inputmode="numeric" maxlength="4" [value]="modelo().clave" (input)="alEscribirClave($event)" autocomplete="off" placeholder="••••" />
        <span class="field-hint">{{ modo() === 'antes' ? 'La misma de antes, también si fue cuando pediste ayuda. Si la olvidaste, escríbele a la coordinación.' : 'Con tu celular y esta clave entras desde cualquier celular. Si ya pediste ayuda con este número, usa esa misma clave.' }}</span>
        @if (intento() && motivoClave(); as m) {
          <span class="field-error">{{ m }}</span>
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
    .clave { font-family: var(--font-marca); letter-spacing: .4em; max-width: 200px; }
    .modos { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 4px; border-radius: var(--radius-pill); background: var(--color-arena); }
    .modos button { min-height: 44px; border: 0; border-radius: var(--radius-pill); background: none; font: inherit; font-size: var(--text-sm); font-weight: 650; color: var(--color-tenue); cursor: pointer; }
    .modos button[aria-selected='true'] { background: var(--color-primario); color: #fff; }
    .ayuda { font-size: var(--text-sm); color: var(--color-tenue); }
    .error { font-size: var(--text-sm); padding: var(--space-3); border-radius: var(--radius-sm); background: var(--estado-pendiente-bg); color: var(--estado-pendiente); animation: aparecer var(--dur-media) var(--ease-salida); }
  `,
})
export class IdentificarseForm {
  private readonly sesion = inject(SesionGateway);
  readonly identificado = output<void>();

  /** La mayoria de quienes vuelven ya tienen perfil: se abre en "Ya ayude antes". */
  protected readonly modo = signal<ModoIdentificacion>('antes');
  protected readonly modelo = signal<DatosIdentificacion>({ alias: '', celular: '', clave: '' });
  protected readonly motivoClave = computed(() =>
    motivoClaveInvalida({ clave: this.modelo().clave, telefono: soloDigitos(this.modelo().celular) }),
  );
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
    validate(p.alias, ({ value }) => {
      if (this.modo() === 'antes') return null;
      const largo = value().trim().length;
      if (largo < 2) return { kind: 'alias', message: 'Escribe cómo quieres aparecer (mínimo 2 letras).' };
      return largo > 40 ? { kind: 'alias', message: 'Máximo 40 caracteres.' } : null;
    });
    validate(p.celular, ({ value }) =>
      CELULAR_CO.test(value().replace(/\D/g, '')) ? null : { kind: 'celular', message: 'Escribe un celular de 10 dígitos que empiece por 3.' },
    );
  });

  protected elegirModo(modo: ModoIdentificacion): void {
    this.modo.set(modo);
    this.error.set(null);
    this.intento.set(false);
  }

  protected alEscribirClave(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const limpia = soloDigitos(entrada.value).slice(0, LARGO_CLAVE);
    entrada.value = limpia;
    this.modelo.update((m) => ({ ...m, clave: limpia }));
  }

  protected mostrarError(errores: readonly unknown[], tocado: boolean): boolean {
    return errores.length > 0 && (tocado || this.intento());
  }

  protected async enviar(evento: Event): Promise<void> {
    evento.preventDefault();
    this.intento.set(true);
    if (this.motivoClave()) return;
    await submit(this.formulario, async () => {
      this.enviando.set(true);
      this.error.set(null);
      try {
        const m = this.modelo();
        await this.sesion.iniciarSesion({ ...m, alias: this.modo() === 'antes' ? '' : m.alias });
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
