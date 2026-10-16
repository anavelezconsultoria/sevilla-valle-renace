import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { AyudanteGateway, SesionGateway } from '../../core/ports/necesidades.ports';
import { ContactoPrivado, EstadoNecesidad, Necesidad } from '../../core/domain/necesidad.model';
import { accionesDelAyudante, HORAS_AVISO_VENCIMIENTO, horasRestantes, puedeExtenderPlazo } from '../../core/domain/ciclo-de-vida';
import { tiempoRelativo } from '../../shared/lib/tiempo';
import { enlaceWhatsappA } from '../../shared/lib/whatsapp';
import { IdentificarseForm } from '../sesion/identificarse-form';
import { EntregaForm } from './entrega-form';

/** Panel de acciones para quien ayuda: tomar, ver el contacto, entregar o liberar. */
@Component({
  selector: 'sr-panel-ayudante',
  imports: [IdentificarseForm, EntregaForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './panel-ayudante.html',
  styleUrl: './panel-ayudante.css',
})
export class PanelAyudante {
  private readonly ayudanteGw = inject(AyudanteGateway);
  private readonly sesion = inject(SesionGateway);
  protected readonly ayudante = this.sesion.ayudante;
  protected readonly colectivos = this.sesion.colectivos;
  /** A nombre de quien se toma: vacio = a nombre propio. */
  protected readonly aNombreDe = signal<string>('');

  readonly necesidad = input.required<Necesidad>();

  protected readonly pidiendoIdentidad = signal(false);
  protected readonly entregando = signal(false);
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly contacto = signal<ContactoPrivado | null>(null);

  protected readonly esAsignado = computed(() => {
    const n = this.necesidad();
    return n.estado === EstadoNecesidad.EnAtencion && this.ayudanteGw.misAtenciones().some((m) => m.id === n.id);
  });
  /** Quien la atiende (en curso o ya entregada): conserva el contacto para avisar por WhatsApp. */
  protected readonly soyQuienAtiende = computed(() => {
    const n = this.necesidad();
    const yo = this.ayudante()?.id;
    const mios = new Set([yo, ...this.colectivos().map((c) => c.id)]);
    return !!yo && !!n.ayudanteId && mios.has(n.ayudanteId) && (n.estado === EstadoNecesidad.EnAtencion || n.estado === EstadoNecesidad.Entregada);
  });
  protected readonly acciones = computed(() =>
    accionesDelAyudante({ estado: this.necesidad().estado, esAsignado: this.esAsignado() }),
  );
  /** Horas que le quedan a quien atiende para entregar. */
  protected readonly horasQuedan = computed(() => {
    const h = horasRestantes(this.necesidad().venceEn);
    return h === null ? null : Math.max(0, Math.floor(h));
  });
  protected readonly plazoCorto = computed(() => {
    const h = horasRestantes(this.necesidad().venceEn);
    return h !== null && h <= HORAS_AVISO_VENCIMIENTO;
  });
  protected readonly puedeExtender = computed(() => puedeExtenderPlazo(this.necesidad()));
  protected readonly vence = computed(() => {
    const v = this.necesidad().venceEn;
    return v ? tiempoRelativo(v) : null;
  });
  protected readonly enlaceMapa = computed(() => {
    const c = this.contacto();
    return c ? `https://www.google.com/maps/dir/?api=1&destination=${c.ubicacionExacta.lat},${c.ubicacionExacta.lng}` : '';
  });
  protected readonly enlaceWhatsapp = computed(() => {
    const c = this.contacto();
    return c ? enlaceWhatsappA(c.telefono, `Hola ${c.nombre}, te escribo de Sevilla Renace por tu solicitud "${this.necesidad().titulo}". Voy a ayudarte.`) : '';
  });
  /** Aviso de entrega: lleva el enlace para que la familia confirme con un toque. */
  protected readonly enlaceAvisoEntrega = computed(() => {
    const c = this.contacto();
    const n = this.necesidad();
    if (!c) return '';
    const confirmar = `${location.origin}/seguimiento?necesidad=${n.id}`;
    return enlaceWhatsappA(
      c.telefono,
      `Hola ${c.nombre}, ya te entregué la ayuda de Sevilla Renace: "${n.titulo}". Por favor confirma que la recibiste aquí: ${confirmar}`,
    );
  });

  /** Video de la solicitud: privado, solo para quien la atiende. */
  protected readonly video = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (this.soyQuienAtiende()) {
        void this.cargarContacto();
        void this.cargarVideo();
      } else {
        this.contacto.set(null);
        this.video.set(null);
      }
    });
  }

  private async cargarVideo(): Promise<void> {
    try {
      this.video.set(await this.ayudanteGw.videoSolicitud(this.necesidad().id));
    } catch {
      this.video.set(null);
    }
  }

  protected async atender(): Promise<void> {
    if (!this.ayudante()) {
      this.pidiendoIdentidad.set(true);
      return;
    }
    const aNombreDe = this.aNombreDe() || undefined;
    await this.ejecutar(() => this.ayudanteGw.tomar({ necesidadId: this.necesidad().id, aNombreDe }));
  }

  protected async alIdentificarse(): Promise<void> {
    this.pidiendoIdentidad.set(false);
    await this.atender();
  }

  protected async extender(): Promise<void> {
    await this.ejecutar(() => this.ayudanteGw.extenderPlazo(this.necesidad().id));
  }

  protected async liberar(): Promise<void> {
    await this.ejecutar(() => this.ayudanteGw.liberar(this.necesidad().id));
  }

  private async cargarContacto(): Promise<void> {
    try {
      this.contacto.set(await this.ayudanteGw.contacto(this.necesidad().id));
    } catch {
      this.contacto.set(null);
    }
  }

  private async ejecutar(accion: () => Promise<unknown>): Promise<void> {
    this.ocupado.set(true);
    this.error.set(null);
    try {
      await accion();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo completar la acción.');
    } finally {
      this.ocupado.set(false);
    }
  }
}
