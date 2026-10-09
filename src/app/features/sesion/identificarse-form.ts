import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { email, form, FormField, maxLength, minLength, required, submit } from '@angular/forms/signals';
import { SesionGateway } from '../../core/ports/necesidades.ports';

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
        <button type="submit" class="btn btn-primary btn-block" [disabled]="enviando()">{{ enviando() ? 'Entrando...' : textoBoton() }}</button>
      </form>
    }
  `,
  styles: `
    .form { display: grid; gap: var(--space-3); }
    .ok { font-size: var(--text-sm); padding: var(--space-3); border-radius: var(--radius-sm); background: var(--estado-exito-bg); }
  `,
})
export class IdentificarseForm {
  private readonly sesion = inject(SesionGateway);
  readonly identificado = output<void>();

  protected readonly modelo = signal<DatosIdentificacion>({ alias: '', correo: '' });
  protected readonly enviando = signal(false);
  protected readonly enlaceEnviado = signal(false);
  protected readonly intento = signal(false);
  protected readonly textoBoton = signal('Continuar');

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
      try {
        const resultado = await this.sesion.iniciarSesion(this.modelo());
        if (resultado === 'enlace_enviado') this.enlaceEnviado.set(true);
        else this.identificado.emit();
      } finally {
        this.enviando.set(false);
      }
      return undefined;
    });
  }
}
