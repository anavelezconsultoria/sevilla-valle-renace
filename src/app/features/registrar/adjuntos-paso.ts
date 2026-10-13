import { ChangeDetectionStrategy, Component, DestroyRef, inject, model, signal } from '@angular/core';
import { prepararFoto } from '../../shared/lib/imagen';

export const MAX_FOTOS_SOLICITUD = 3;
const MAX_SEGUNDOS_VIDEO = 30;
const MAX_MB_VIDEO = 25;

export interface FotoSolicitud {
  readonly blob: Blob;
  readonly vistaPrevia: string;
}

export interface VideoSolicitud {
  readonly archivo: File;
  readonly vistaPrevia: string;
}

function duracionVideo(archivo: File): Promise<number> {
  return new Promise((resolver, rechazar) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(archivo);
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolver(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      rechazar(new Error('No pudimos leer ese video.'));
    };
    video.src = url;
  });
}

/**
 * Paso opcional del asistente: hasta 3 fotos (publicas, sin ubicacion) y un
 * video corto (privado). Los archivos se suben despues de registrar.
 */
@Component({
  selector: 'sr-adjuntos-paso',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="regla">
      <strong>Fotografía el daño o lo que necesitas, sin rostros de personas, sobre todo de niños.</strong>
      Las fotos se ven en la página de tu necesidad y ayudan a que alguien se anime. Les quitamos la ubicación antes de subirlas.
    </div>

    <div class="bloque">
      <p class="titulo">Fotos <span class="muted">(hasta {{ maxFotos }})</span></p>
      <div class="fotos">
        @for (f of fotos(); track f.vistaPrevia; let i = $index) {
          <figure>
            <img [src]="f.vistaPrevia" alt="Foto {{ i + 1 }}" />
            <button type="button" (click)="quitarFoto(i)" aria-label="Quitar foto">×</button>
          </figure>
        }
        @if (fotos().length < maxFotos) {
          <label class="agregar">
            <input type="file" accept="image/*" (change)="alElegirFoto($event)" class="visually-hidden" />
            <span>{{ procesando() ? 'Procesando...' : '+ Agregar foto' }}</span>
          </label>
        }
      </div>
    </div>

    <div class="bloque">
      <p class="titulo">Video corto <span class="muted">(máximo {{ maxSegundos }} segundos)</span></p>
      @if (video(); as v) {
        <figure class="video">
          <video [src]="v.vistaPrevia" controls playsinline></video>
          <button type="button" (click)="quitarVideo()" aria-label="Quitar video">×</button>
        </figure>
      } @else {
        <label class="agregar ancho">
          <input type="file" accept="video/*" (change)="alElegirVideo($event)" class="visually-hidden" />
          <span>{{ procesando() ? 'Revisando el video...' : '+ Agregar video' }}</span>
        </label>
      }
      <p class="nota">El video solo lo ve la persona que tome tu solicitud: los videos del celular guardan la ubicación de tu casa.</p>
    </div>

    @if (error(); as e) {
      <p class="field-error" role="alert">{{ e }}</p>
    }
  `,
  styles: `
    :host { display: grid; gap: var(--space-4); }
    .regla { font-size: var(--text-sm); line-height: 1.5; padding: var(--space-3) var(--space-4); border-radius: var(--radius-sm); background: var(--estado-pendiente-bg); }
    .regla strong { display: block; margin-bottom: 2px; }
    .bloque { display: grid; gap: var(--space-2); }
    .titulo { font-weight: 650; }
    .fotos { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    figure { position: relative; margin: 0; }
    figure img { width: 110px; height: 110px; object-fit: cover; border-radius: var(--radius-md); }
    figure button { position: absolute; top: 6px; right: 6px; width: 28px; height: 28px; border: 0; border-radius: 50%; background: rgba(0,0,0,.6); color: #fff; font-size: 18px; cursor: pointer; }
    .video video { width: 100%; max-height: 260px; border-radius: var(--radius-md); background: #000; }
    .agregar { width: 110px; height: 110px; display: grid; place-items: center; text-align: center; border: 2px dashed var(--color-linea-fuerte); border-radius: var(--radius-md); background: var(--color-superficie); font-weight: 650; color: var(--color-primario); cursor: pointer; }
    .agregar.ancho { width: 100%; height: 72px; }
    .nota { font-size: var(--text-xs); color: var(--color-tenue); }
  `,
})
export class AdjuntosPaso {
  readonly fotos = model.required<readonly FotoSolicitud[]>();
  readonly video = model.required<VideoSolicitud | null>();

  protected readonly maxFotos = MAX_FOTOS_SOLICITUD;
  protected readonly maxSegundos = MAX_SEGUNDOS_VIDEO;
  protected readonly procesando = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.fotos().forEach((f) => URL.revokeObjectURL(f.vistaPrevia));
      const v = this.video();
      if (v) URL.revokeObjectURL(v.vistaPrevia);
    });
  }

  protected async alElegirFoto(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';
    if (!archivo) return;
    this.procesando.set(true);
    this.error.set(null);
    try {
      const blob = await prepararFoto(archivo);
      this.fotos.update((f) => [...f, { blob, vistaPrevia: URL.createObjectURL(blob) }]);
    } catch {
      this.error.set('No pudimos procesar esa foto. Intenta con otra.');
    } finally {
      this.procesando.set(false);
    }
  }

  protected quitarFoto(indice: number): void {
    const foto = this.fotos()[indice];
    if (foto) URL.revokeObjectURL(foto.vistaPrevia);
    this.fotos.update((f) => f.filter((_, i) => i !== indice));
  }

  protected async alElegirVideo(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';
    if (!archivo) return;
    this.error.set(null);
    if (archivo.size > MAX_MB_VIDEO * 1024 * 1024) {
      this.error.set(`El video pesa mucho (máximo ${MAX_MB_VIDEO} MB). Graba uno más corto.`);
      return;
    }
    this.procesando.set(true);
    try {
      const segundos = await duracionVideo(archivo);
      if (segundos > MAX_SEGUNDOS_VIDEO + 1) {
        this.error.set(`El video dura ${Math.round(segundos)} segundos. Graba uno de máximo ${MAX_SEGUNDOS_VIDEO}.`);
        return;
      }
      this.video.set({ archivo, vistaPrevia: URL.createObjectURL(archivo) });
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No pudimos leer ese video.');
    } finally {
      this.procesando.set(false);
    }
  }

  protected quitarVideo(): void {
    const v = this.video();
    if (v) URL.revokeObjectURL(v.vistaPrevia);
    this.video.set(null);
  }
}
