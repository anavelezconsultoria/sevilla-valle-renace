import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NecesidadesLectura, SolicitanteGateway } from '../../core/ports/necesidades.ports';
import { Necesidad } from '../../core/domain/necesidad.model';
import { accionesDelSolicitante } from '../../core/domain/ciclo-de-vida';
import { normalizarCodigo } from '../../core/domain/privacidad';
import { EstadoBadge } from '../../shared/ui/estado-badge';
import { LineaTiempo } from '../../shared/ui/linea-tiempo';
import { tiempoRelativo } from '../../shared/lib/tiempo';
import { Celebracion } from '../../shared/ui/celebracion';
import { SolicitudesLocales } from '../../shared/lib/solicitudes-locales';

/** Seguimiento por codigo: el solicitante ve su caso y confirma, reclama o cancela sin crear cuenta. */
@Component({
  selector: 'sr-seguimiento-page',
  imports: [RouterLink, EstadoBadge, LineaTiempo, Celebracion],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './seguimiento-page.html',
  styleUrl: './seguimiento-page.css',
})
export class SeguimientoPage {
  private readonly solicitante = inject(SolicitanteGateway);
  private readonly lectura = inject(NecesidadesLectura);
  protected readonly locales = inject(SolicitudesLocales);

  /** ?codigo=XXXX-XXXX llega por enlace de WhatsApp o desde el registro. */
  readonly codigo = input<string>();

  protected readonly entrada = signal('');
  protected readonly codigoActivo = signal<string | null>(null);
  protected readonly necesidadId = signal<string | null>(null);
  protected readonly buscando = signal(false);
  protected readonly noEncontrada = signal(false);
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly reclamando = signal(false);
  protected readonly notaReclamo = signal('');
  protected readonly mensaje = signal<string | null>(null);
  /** Se celebra solo cuando la ayuda llego: es el momento que da sentido a todo el flujo. */
  protected readonly celebrar = signal(false);

  /** Se relee del almacen para reflejar cambios en vivo (por ejemplo, el cierre automatico). */
  protected readonly necesidad = computed<Necesidad | undefined>(() => {
    this.lectura.todas();
    const id = this.necesidadId();
    return id ? this.lectura.obtener(id) : undefined;
  });
  protected readonly acciones = computed(() => {
    const n = this.necesidad();
    return n ? accionesDelSolicitante(n.estado) : [];
  });
  protected readonly vence = computed(() => {
    const v = this.necesidad()?.venceEn;
    return v ? tiempoRelativo(v) : null;
  });

  constructor() {
    effect(() => {
      const desdeEnlace = this.codigo();
      if (desdeEnlace) untracked(() => void this.buscar(desdeEnlace));
    });
  }

  protected async abrirLocal(codigo: string): Promise<void> {
    await this.buscar(codigo);
  }

  protected alEscribir(evento: Event): void {
    this.entrada.set((evento.target as HTMLInputElement).value);
  }

  protected async alEnviar(evento: Event): Promise<void> {
    evento.preventDefault();
    await this.buscar(this.entrada());
  }

  private async buscar(codigo: string): Promise<void> {
    const normalizado = normalizarCodigo(codigo);
    this.entrada.set(normalizado);
    this.buscando.set(true);
    this.noEncontrada.set(false);
    this.mensaje.set(null);
    try {
      const n = await this.solicitante.consultarPorCodigo(normalizado);
      this.necesidadId.set(n?.id ?? null);
      this.codigoActivo.set(n ? normalizado : null);
      this.noEncontrada.set(!n);
    } finally {
      this.buscando.set(false);
    }
  }

  protected async confirmar(): Promise<void> {
    await this.ejecutar(
      (codigo) => this.solicitante.confirmarRecibida(codigo),
      'Gracias por confirmar. Tu necesidad quedó registrada como atendida.',
    );
    if (!this.error()) this.celebrar.set(true);
  }

  protected async reclamar(): Promise<void> {
    const nota = this.notaReclamo().trim() || 'No recibí la ayuda.';
    await this.ejecutar(
      (codigo) => this.solicitante.reportarNoRecibida({ codigo, nota }),
      'Avisamos a quien la tomó. Tiene 48 horas para resolverlo; si no, vuelve a estar disponible.',
    );
    this.reclamando.set(false);
  }

  protected async cancelar(): Promise<void> {
    await this.ejecutar((codigo) => this.solicitante.cancelar(codigo), 'Cancelaste tu solicitud. Ya no aparece en el mapa.');
  }

  protected alEscribirReclamo(evento: Event): void {
    this.notaReclamo.set((evento.target as HTMLTextAreaElement).value);
  }

  private async ejecutar(accion: (codigo: string) => Promise<Necesidad>, exito: string): Promise<void> {
    const codigo = this.codigoActivo();
    if (!codigo) return;
    this.ocupado.set(true);
    this.error.set(null);
    try {
      await accion(codigo);
      this.mensaje.set(exito);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo completar la acción.');
    } finally {
      this.ocupado.set(false);
    }
  }
}
