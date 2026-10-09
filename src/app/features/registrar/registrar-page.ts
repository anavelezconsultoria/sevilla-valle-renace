import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormField, form, max, maxLength, min, minLength, required, submit, validate } from '@angular/forms/signals';
import { SolicitanteGateway } from '../../core/ports/necesidades.ports';
import { Categoria, Coordenada, RegistroResultado, Urgencia } from '../../core/domain/necesidad.model';
import { CATEGORIAS, URGENCIAS } from '../../core/domain/catalogos';
import { SelectorPunto } from '../../shared/mapa/selector-punto';
import { CategoriaIcono } from '../../shared/ui/categoria-icono';
import { ErroresCampo, EstadoCampo } from '../../shared/ui/errores-campo';
import { CodigoConfirmacion } from './codigo-confirmacion';

interface FormularioNecesidad {
  categoria: Categoria | '';
  titulo: string;
  descripcion: string;
  urgencia: Urgencia;
  personasHogar: number;
  sector: string;
  nombre: string;
  telefono: string;
  referencias: string;
  autorizaDatos: boolean;
}

const VACIO: FormularioNecesidad = {
  categoria: '',
  titulo: '',
  descripcion: '',
  urgencia: Urgencia.Media,
  personasHogar: 1,
  sector: '',
  nombre: '',
  telefono: '',
  referencias: '',
  autorizaDatos: false,
};

const TELEFONO_CO = /^3\d{9}$/;

/** Forma minima de un campo de Signal Forms que necesita la vista para mostrar errores. */
type CampoConEstado = () => {
  errors(): readonly { readonly message?: string }[];
  touched(): boolean;
};

@Component({
  selector: 'sr-registrar-page',
  imports: [FormField, SelectorPunto, CategoriaIcono, ErroresCampo, CodigoConfirmacion],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './registrar-page.html',
  styleUrl: './registrar-page.css',
})
export class RegistrarPage {
  private readonly solicitante = inject(SolicitanteGateway);

  protected readonly categorias = CATEGORIAS;
  protected readonly urgencias = Object.entries(URGENCIAS) as [Urgencia, string][];
  protected readonly modelo = signal<FormularioNecesidad>({ ...VACIO });
  protected readonly punto = signal<Coordenada | null>(null);
  protected readonly intentoEnviar = signal(false);
  protected readonly enviando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly resultado = signal<RegistroResultado | null>(null);
  protected readonly ubicando = signal(false);

  protected readonly formulario = form(this.modelo, (p) => {
    validate(p.categoria, ({ value }) => (value() ? null : { kind: 'categoria', message: 'Elige qué tipo de ayuda necesitas.' }));
    required(p.titulo, { message: 'Escribe en pocas palabras qué necesitas.' });
    maxLength(p.titulo, 80, { message: 'Máximo 80 caracteres.' });
    required(p.descripcion, { message: 'Cuéntanos un poco más.' });
    minLength(p.descripcion, 15, { message: 'Agrega un poco más de detalle (mínimo 15 caracteres).' });
    maxLength(p.descripcion, 600, { message: 'Máximo 600 caracteres.' });
    min(p.personasHogar, 1, { message: 'Al menos 1 persona.' });
    max(p.personasHogar, 30, { message: 'Máximo 30 personas.' });
    required(p.sector, { message: 'Escribe tu barrio, vereda o corregimiento.' });
    required(p.nombre, { message: 'Escribe un nombre para contactarte.' });
    validate(p.telefono, ({ value }) =>
      TELEFONO_CO.test(value().replace(/\D/g, '')) ? null : { kind: 'telefono', message: 'Escribe un celular de 10 dígitos que empiece por 3.' },
    );
    validate(p.autorizaDatos, ({ value }) =>
      value() ? null : { kind: 'autorizacion', message: 'Necesitamos tu autorización para compartir tu contacto con quien te ayude.' },
    );
  });

  /** Estado visible de un campo: sus errores, solo despues de tocarlo o de intentar enviar. */
  protected estado(campo: CampoConEstado): EstadoCampo {
    const estado = campo();
    return { errores: estado.errors(), visible: estado.touched() || this.intentoEnviar() };
  }

  protected elegirCategoria(valor: Categoria): void {
    this.modelo.update((m) => ({ ...m, categoria: valor }));
  }

  protected elegirUrgencia(valor: Urgencia): void {
    this.modelo.update((m) => ({ ...m, urgencia: valor }));
  }

  protected cambiarPersonas(delta: number): void {
    this.modelo.update((m) => ({ ...m, personasHogar: Math.min(30, Math.max(1, m.personasHogar + delta)) }));
  }

  protected usarMiUbicacion(): void {
    if (!('geolocation' in navigator)) return;
    this.ubicando.set(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        this.punto.set({ lat: coords.latitude, lng: coords.longitude });
        this.ubicando.set(false);
      },
      () => this.ubicando.set(false),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  protected async enviar(evento: Event): Promise<void> {
    evento.preventDefault();
    this.intentoEnviar.set(true);
    if (!this.punto()) return;
    await submit(this.formulario, async () => {
      await this.registrar();
      return undefined;
    });
  }

  private async registrar(): Promise<void> {
    const m = this.modelo();
    const punto = this.punto();
    if (!punto || !m.categoria) return;
    this.enviando.set(true);
    this.errorGeneral.set(null);
    try {
      const resultado = await this.solicitante.registrar({
        categoria: m.categoria,
        titulo: m.titulo,
        descripcion: m.descripcion,
        urgencia: m.urgencia,
        personasHogar: m.personasHogar,
        sector: m.sector,
        ubicacion: punto,
        contacto: { nombre: m.nombre.trim(), telefono: m.telefono.replace(/\D/g, ''), referencias: m.referencias.trim() },
      });
      this.resultado.set(resultado);
      window.scrollTo({ top: 0 });
    } catch (error) {
      this.errorGeneral.set(error instanceof Error ? error.message : 'No pudimos registrar la necesidad. Inténtalo de nuevo.');
    } finally {
      this.enviando.set(false);
    }
  }

  protected nuevaSolicitud(): void {
    this.modelo.set({ ...VACIO });
    this.punto.set(null);
    this.intentoEnviar.set(false);
    this.resultado.set(null);
  }
}
