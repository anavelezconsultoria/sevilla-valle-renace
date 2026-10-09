import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccionSolicitante, NecesidadesLectura, SolicitanteGateway } from '../../core/ports/necesidades.ports';
import { CredencialSolicitante, Necesidad } from '../../core/domain/necesidad.model';
import { accionesDelSolicitante } from '../../core/domain/ciclo-de-vida';
import { LARGO_CLAVE, soloDigitos } from '../../core/domain/clave-solicitante';
import { EstadoBadge } from '../../shared/ui/estado-badge';
import { LineaTiempo } from '../../shared/ui/linea-tiempo';
import { tiempoRelativo } from '../../shared/lib/tiempo';
import { Celebracion } from '../../shared/ui/celebracion';
import { SolicitudesLocales, SolicitudLocal } from '../../shared/lib/solicitudes-locales';

const LARGO_TELEFONO = 10;

/**
 * Mis solicitudes: quien pidio ayuda ve su caso y confirma, reclama o cancela
 * sin crear cuenta. En el celular que registro entra con un toque; desde otro,
 * con su celular y la clave de 4 numeros que creo.
 */
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

  /** ?necesidad=<id> llega desde el registro o desde la pagina de la necesidad. */
  readonly necesidad = input<string>();

  protected readonly largoClave = LARGO_CLAVE;
  protected readonly telefono = signal('');
  protected readonly clave = signal('');
  protected readonly entrando = signal(false);
  protected readonly errorAcceso = signal<string | null>(null);
  /** Solicitudes que devolvio el acceso con celular y clave. */
  protected readonly idsConClave = signal<readonly string[]>([]);

  private readonly credencial = signal<CredencialSolicitante | null>(null);
  protected readonly necesidadId = signal<string | null>(null);
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly reclamando = signal(false);
  protected readonly notaReclamo = signal('');
  protected readonly mensaje = signal<string | null>(null);
  /** Se celebra solo cuando la ayuda llego: es el momento que da sentido a todo el flujo. */
  protected readonly celebrar = signal(false);

  protected readonly puedeEntrar = computed(
    () => this.telefono().length === LARGO_TELEFONO && this.clave().length === LARGO_CLAVE && !this.entrando(),
  );
  /** Se releen del almacen para reflejar cambios en vivo (por ejemplo, el cierre automatico). */
  protected readonly elegida = computed<Necesidad | undefined>(() => {
    this.lectura.todas();
    const id = this.necesidadId();
    return id ? this.lectura.obtener(id) : undefined;
  });
  protected readonly conClave = computed<readonly Necesidad[]>(() => {
    this.lectura.todas();
    return this.idsConClave()
      .map((id) => this.lectura.obtener(id))
      .filter((n): n is Necesidad => n !== undefined);
  });
  protected readonly acciones = computed(() => {
    const n = this.elegida();
    return n ? accionesDelSolicitante(n.estado) : [];
  });
  protected readonly vence = computed(() => {
    const v = this.elegida()?.venceEn;
    return v ? tiempoRelativo(v) : null;
  });

  constructor() {
    effect(() => {
      const id = this.necesidad();
      const local = id ? untracked(() => this.locales.todas().find((s) => s.necesidadId === id)) : undefined;
      if (local) untracked(() => this.abrirLocal(local));
    });
  }

  // ---- Entrar ----

  protected abrirLocal(solicitud: SolicitudLocal): void {
    this.abrir(solicitud.necesidadId, { tipo: 'dispositivo', codigo: solicitud.codigo });
  }

  protected abrirConClave(necesidadId: string): void {
    this.abrir(necesidadId, { tipo: 'clave', telefono: this.telefono(), clave: this.clave() });
  }

  protected alEscribirTelefono(evento: Event): void {
    this.telefono.set(this.limpiarEntrada(evento, LARGO_TELEFONO));
  }

  protected alEscribirClave(evento: Event): void {
    this.clave.set(this.limpiarEntrada(evento, LARGO_CLAVE));
  }

  protected async entrar(evento: Event): Promise<void> {
    evento.preventDefault();
    if (!this.puedeEntrar()) return;
    this.entrando.set(true);
    this.errorAcceso.set(null);
    try {
      const propias = await this.solicitante.misNecesidades({ telefono: this.telefono(), clave: this.clave() });
      this.idsConClave.set(propias.map((n) => n.id));
      if (propias.length === 1) this.abrirConClave(propias[0]!.id);
    } catch (e) {
      this.errorAcceso.set(e instanceof Error ? e.message : 'No pudimos revisar tus datos. Inténtalo de nuevo.');
    } finally {
      this.entrando.set(false);
    }
  }

  protected volver(): void {
    this.necesidadId.set(null);
    this.credencial.set(null);
    this.mensaje.set(null);
    this.error.set(null);
    this.reclamando.set(false);
  }

  // ---- Acciones sobre la solicitud ----

  protected async confirmar(): Promise<void> {
    const listo = await this.ejecutar(
      (accion) => this.solicitante.confirmarRecibida(accion),
      'Gracias por confirmar. Tu necesidad quedó registrada como atendida.',
    );
    if (listo) this.celebrar.set(true);
  }

  protected async reclamar(): Promise<void> {
    const nota = this.notaReclamo().trim() || 'No recibí la ayuda.';
    await this.ejecutar(
      (accion) => this.solicitante.reportarNoRecibida({ ...accion, nota }),
      'Avisamos a quien la tomó. Tiene 48 horas para resolverlo; si no, vuelve a estar disponible.',
    );
    this.reclamando.set(false);
  }

  protected async cancelar(): Promise<void> {
    await this.ejecutar((accion) => this.solicitante.cancelar(accion), 'Cancelaste tu solicitud. Ya no aparece en el mapa.');
  }

  protected alEscribirReclamo(evento: Event): void {
    this.notaReclamo.set((evento.target as HTMLTextAreaElement).value);
  }

  // ---- Internos ----

  private abrir(necesidadId: string, credencial: CredencialSolicitante): void {
    this.credencial.set(credencial);
    this.necesidadId.set(necesidadId);
    this.mensaje.set(null);
    this.error.set(null);
  }

  /** Solo digitos y con tope: el campo nunca guarda lo que la base rechazaria. */
  private limpiarEntrada(evento: Event, largo: number): string {
    const entrada = evento.target as HTMLInputElement;
    const limpia = soloDigitos(entrada.value).slice(0, largo);
    entrada.value = limpia;
    return limpia;
  }

  /** Devuelve true si la accion se completo. */
  private async ejecutar(
    accion: (datos: AccionSolicitante) => Promise<Necesidad>,
    exito: string,
  ): Promise<boolean> {
    const necesidadId = this.necesidadId();
    const credencial = this.credencial();
    if (!necesidadId || !credencial) return false;
    this.ocupado.set(true);
    this.error.set(null);
    try {
      await accion({ necesidadId, credencial });
      this.mensaje.set(exito);
      return true;
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo completar la acción.');
      return false;
    } finally {
      this.ocupado.set(false);
    }
  }
}
