import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormField, form, max, maxLength, min, validate } from '@angular/forms/signals';
import { LARGOS, MAX_REFERENCIAS, validarLargo } from '../../shared/lib/validaciones';
import { SolicitudesLocales } from '../../shared/lib/solicitudes-locales';
import { SolicitanteGateway } from '../../core/ports/necesidades.ports';
import { Categoria, Coordenada, RegistroResultado, Urgencia } from '../../core/domain/necesidad.model';
import { CATEGORIAS, infoCategoria, OPCIONES_URGENCIA, SUGERENCIAS, URGENCIAS } from '../../core/domain/catalogos';
import { SelectorPunto } from '../../shared/mapa/selector-punto';
import { CategoriaIcono } from '../../shared/ui/categoria-icono';
import { ErroresCampo, EstadoCampo } from '../../shared/ui/errores-campo';
import { Celebracion } from '../../shared/ui/celebracion';
import { CodigoConfirmacion } from './codigo-confirmacion';
import { MAX_PERSONAS_DIBUJADAS, PASOS, PasoRegistro } from './pasos-registro';

interface FormularioNecesidad {
  categoria: Categoria | '';
  titulo: string;
  descripcion: string;
  urgencia: Urgencia | '';
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
  urgencia: '',
  personasHogar: 1,
  sector: '',
  nombre: '',
  telefono: '',
  referencias: '',
  autorizaDatos: false,
};

const TELEFONO_CO = /^3\d{9}$/;
const ESPERA_AVANCE_MS = 260;

/** Forma minima de un campo de Signal Forms que la vista necesita para validar y mostrar errores. */
type CampoConEstado = () => {
  errors(): readonly { readonly message?: string }[];
  touched(): boolean;
  invalid(): boolean;
};

/**
 * Asistente para pedir ayuda: una pregunta por pantalla. Cada paso valida solo
 * sus campos; las opciones de un toque avanzan solas para que sea rapido en el celular.
 */
@Component({
  selector: 'sr-registrar-page',
  imports: [FormField, SelectorPunto, CategoriaIcono, ErroresCampo, CodigoConfirmacion, Celebracion],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './registrar-page.html',
  styleUrl: './registrar-page.css',
})
export class RegistrarPage {
  private readonly solicitante = inject(SolicitanteGateway);
  private readonly solicitudesLocales = inject(SolicitudesLocales);

  protected readonly pasos = PASOS;
  protected readonly categorias = CATEGORIAS;
  protected readonly opcionesUrgencia = OPCIONES_URGENCIA;
  protected readonly etiquetasUrgencia = URGENCIAS;

  protected readonly modelo = signal<FormularioNecesidad>({ ...VACIO });
  protected readonly punto = signal<Coordenada | null>(null);
  protected readonly indice = signal(0);
  protected readonly direccion = signal<'adelante' | 'atras'>('adelante');
  protected readonly mostrarErrores = signal(false);
  protected readonly enviando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly resultado = signal<RegistroResultado | null>(null);
  protected readonly ubicando = signal(false);
  protected readonly errorUbicacion = signal<string | null>(null);

  protected readonly paso = computed(() => this.pasos[this.indice()]!);
  protected readonly progreso = computed(() => ((this.indice() + 1) / this.pasos.length) * 100);
  protected readonly sugerencias = computed(() => {
    const categoria = this.modelo().categoria;
    return categoria ? SUGERENCIAS[categoria] : [];
  });
  protected readonly categoriaElegida = computed(() => {
    const categoria = this.modelo().categoria;
    return categoria ? infoCategoria(categoria) : null;
  });
  protected readonly figurasPersonas = computed(() =>
    Array.from({ length: Math.min(this.modelo().personasHogar, MAX_PERSONAS_DIBUJADAS) }, (_, i) => i),
  );

  protected readonly formulario = form(this.modelo, (p) => {
    validate(p.categoria, ({ value }) => (value() ? null : { kind: 'categoria', message: 'Elige qué tipo de ayuda necesitas.' }));
    validate(p.urgencia, ({ value }) => (value() ? null : { kind: 'urgencia', message: 'Elige qué tan urgente es.' }));
    validate(p.titulo, ({ value }) => validarLargo(value(), LARGOS.titulo));
    validate(p.descripcion, ({ value }) => validarLargo(value(), LARGOS.descripcion));
    min(p.personasHogar, 1, { message: 'Al menos 1 persona.' });
    max(p.personasHogar, 30, { message: 'Máximo 30 personas.' });
    validate(p.sector, ({ value }) => validarLargo(value(), LARGOS.sector));
    validate(p.nombre, ({ value }) => validarLargo(value(), LARGOS.nombre));
    maxLength(p.referencias, MAX_REFERENCIAS, { message: `Máximo ${MAX_REFERENCIAS} caracteres.` });
    validate(p.telefono, ({ value }) =>
      TELEFONO_CO.test(value().replace(/\D/g, '')) ? null : { kind: 'telefono', message: 'Escribe un celular de 10 dígitos que empiece por 3.' },
    );
    validate(p.autorizaDatos, ({ value }) =>
      value() ? null : { kind: 'autorizacion', message: 'Necesitamos tu autorización para compartir tu contacto con quien te ayude.' },
    );
  });

  /** Campos que valida cada paso: el boton Continuar solo mira los suyos. */
  private readonly camposPorPaso: Record<PasoRegistro, () => readonly CampoConEstado[]> = {
    categoria: () => [this.formulario.categoria],
    urgencia: () => [this.formulario.urgencia, this.formulario.personasHogar],
    detalle: () => [this.formulario.titulo, this.formulario.descripcion],
    ubicacion: () => [this.formulario.sector, this.formulario.referencias],
    contacto: () => [this.formulario.nombre, this.formulario.telefono, this.formulario.autorizaDatos],
    revision: () => [],
  };

  protected estado(campo: CampoConEstado): EstadoCampo {
    const estado = campo();
    return { errores: estado.errors(), visible: this.mostrarErrores() };
  }

  protected pasoValido(id: PasoRegistro): boolean {
    const camposOk = this.camposPorPaso[id]().every((c) => !c().invalid());
    return id === 'ubicacion' ? camposOk && this.punto() !== null : camposOk;
  }

  protected continuar(): void {
    if (!this.pasoValido(this.paso().id)) {
      this.mostrarErrores.set(true);
      return;
    }
    this.irA(this.indice() + 1);
  }

  protected atras(): void {
    this.irA(this.indice() - 1);
  }

  /** Solo se puede saltar hacia atras, o hacia adelante si todo lo anterior esta completo. */
  protected irA(destino: number): void {
    if (destino < 0 || destino >= this.pasos.length) return;
    const pasosPrevios = this.pasos.slice(0, destino);
    if (destino > this.indice() && !pasosPrevios.every((p) => this.pasoValido(p.id))) return;
    this.direccion.set(destino > this.indice() ? 'adelante' : 'atras');
    this.mostrarErrores.set(false);
    this.indice.set(destino);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected irAPaso(id: PasoRegistro): void {
    this.irA(this.pasos.findIndex((p) => p.id === id));
  }

  protected elegirCategoria(valor: Categoria): void {
    const cambio = this.modelo().categoria !== valor;
    this.modelo.update((m) => ({ ...m, categoria: valor, titulo: cambio ? '' : m.titulo }));
    this.avanzarSolo();
  }

  protected elegirUrgencia(valor: Urgencia): void {
    this.modelo.update((m) => ({ ...m, urgencia: valor }));
  }

  protected usarSugerencia(texto: string): void {
    this.modelo.update((m) => ({ ...m, titulo: texto }));
  }

  protected cambiarPersonas(delta: number): void {
    this.modelo.update((m) => ({ ...m, personasHogar: Math.min(30, Math.max(1, m.personasHogar + delta)) }));
  }

  protected usarMiUbicacion(): void {
    if (!('geolocation' in navigator)) {
      this.errorUbicacion.set('Tu celular no permite compartir la ubicación. Marca el punto en el mapa.');
      return;
    }
    this.ubicando.set(true);
    this.errorUbicacion.set(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        this.punto.set({ lat: coords.latitude, lng: coords.longitude });
        this.ubicando.set(false);
      },
      () => {
        this.ubicando.set(false);
        this.errorUbicacion.set('No pudimos obtener tu ubicación. Marca el punto tocando el mapa.');
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  protected alPresionarTecla(evento: KeyboardEvent): void {
    const objetivo = evento.target as HTMLElement;
    if (evento.key === 'Enter' && objetivo.tagName !== 'TEXTAREA' && this.paso().id !== 'revision') {
      evento.preventDefault();
      this.continuar();
    }
  }

  protected async enviar(): Promise<void> {
    const m = this.modelo();
    const punto = this.punto();
    if (!punto || !m.categoria || !m.urgencia || !this.pasos.every((p) => this.pasoValido(p.id))) {
      this.mostrarErrores.set(true);
      return;
    }
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
      this.solicitudesLocales.guardar({
        necesidadId: resultado.necesidad.id,
        codigo: resultado.codigoSeguimiento,
        titulo: resultado.necesidad.titulo,
        registradaEn: resultado.necesidad.registradaEn,
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
    this.indice.set(0);
    this.mostrarErrores.set(false);
    this.resultado.set(null);
  }

  /** Las opciones de un toque avanzan solas, con una pausa breve para ver la seleccion. */
  private avanzarSolo(): void {
    setTimeout(() => this.continuar(), ESPERA_AVANCE_MS);
  }
}
