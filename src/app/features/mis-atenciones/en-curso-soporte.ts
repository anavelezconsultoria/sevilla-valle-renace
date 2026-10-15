import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AtencionEnCurso, SesionGateway } from '../../core/ports/necesidades.ports';
import { infoCategoria } from '../../core/domain/catalogos';
import { HORAS_PARA_ENTREGAR, horasRestantes } from '../../core/domain/ciclo-de-vida';
import { enlaceWhatsappA } from '../../shared/lib/whatsapp';
import { tiempoRelativo } from '../../shared/lib/tiempo';
import { CoordinacionEstado } from './coordinacion-estado';

const HORAS_URGENTE = 6;
const HORAS_ATENTO = 18;

type Ritmo = 'tranquilo' | 'atento' | 'urgente';

interface TarjetaSoporte {
  readonly atencion: AtencionEnCurso;
  readonly horas: number | null;
  /** Fraccion del plazo que ya paso (0 a 1), para la barra. */
  readonly avance: number;
  readonly ritmo: Ritmo;
  readonly whatsapp?: string;
}

/**
 * Soporte de la coordinacion: cada ayuda que alguien esta llevando, cuanto le
 * queda del plazo y un toque para escribirle o llamarle. La mas cerca de
 * vencerse va primero. El celular de quien ayuda es privado: solo se ve aqui.
 */
@Component({
  selector: 'sr-en-curso-soporte',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="soporte">
      <p class="muted">Quienes están llevando una ayuda ahora. Escríbeles para saber cómo van o si necesitan apoyo: un mensaje a tiempo evita que una ayuda se venza.</p>

      @if (estado.cargando()) {
        <p class="muted">Cargando...</p>
      } @else if (!tarjetas().length) {
        <div class="vacio">Nadie está llevando una ayuda en este momento.</div>
      } @else {
        <dl class="resumen" role="status">
          <div class="dato" [class.alerta]="conteo().urgente > 0"><dt>Por vencerse</dt><dd>{{ conteo().urgente }}</dd></div>
          <div class="dato"><dt>A mitad de camino</dt><dd>{{ conteo().atento }}</dd></div>
          <div class="dato"><dt>Con tiempo</dt><dd>{{ conteo().tranquilo }}</dd></div>
        </dl>
        <ul class="lista">
          @for (t of tarjetas(); track t.atencion.necesidadId; let i = $index) {
            <li class="card tarjeta entrada" [class]="t.ritmo" [style.--i]="i">
              <div class="cabecera">
                <span class="avatar" aria-hidden="true">{{ inicial(t.atencion) }}</span>
                <div class="quien">
                  <strong>{{ t.atencion.ayudanteAlias }}</strong>
                  <span class="muted">la tomó {{ tomada(t.atencion) }}</span>
                </div>
                <span class="tiempo" [class]="t.ritmo">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" /></svg>
                  {{ textoTiempo(t) }}
                </span>
              </div>

              <a class="que" [routerLink]="['/necesidades', t.atencion.necesidadId]">
                <span class="titulo">{{ t.atencion.titulo }}</span>
                <span class="muted">{{ categoria(t.atencion) }} · {{ t.atencion.sector }}</span>
                @if (t.atencion.prioridadCero) {
                  <span class="prioridad">Prioridad 0</span>
                }
              </a>

              <div class="barra" role="progressbar" [attr.aria-valuenow]="porcentaje(t)" aria-valuemin="0" aria-valuemax="100" [attr.aria-label]="'Tiempo usado del plazo: ' + porcentaje(t) + '%'">
                <span [style.width.%]="porcentaje(t)"></span>
              </div>

              <div class="acciones">
                @if (t.whatsapp) {
                  <a class="btn btn-secondary" [href]="t.whatsapp" target="_blank" rel="noopener">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 21l2.1-5.2A8.5 8.5 0 1 1 21 11.5z" /></svg>Escribirle
                  </a>
                  <a class="btn btn-secondary" [href]="'tel:+57' + t.atencion.ayudanteCelular">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>Llamar
                  </a>
                } @else {
                  <span class="muted sin-celular">Sin celular registrado</span>
                }
              </div>
            </li>
          }
        </ul>
      }
      @if (estado.errorEnCurso(); as e) {
        <p class="field-error" role="alert">{{ e }}</p>
      }
    </section>
  `,
  styles: `
    .soporte { display: grid; gap: var(--space-4); }
    .resumen { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-2); max-width: 560px; margin: 0; }
    .dato { display: grid; gap: 2px; padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); background: var(--color-superficie); border: 1px solid var(--color-linea); }
    .dato dt { font-size: var(--text-xs); color: var(--color-tenue); }
    .dato dd { margin: 0; font-family: var(--font-marca); font-size: var(--text-xl); color: var(--color-tinta); }
    .dato.alerta { background: var(--color-tinta); border-color: var(--color-tinta); }
    .dato.alerta dt { color: #d7d4ee; }
    .dato.alerta dd { color: #fff; }
    .lista { display: grid; gap: var(--space-3); list-style: none; margin: 0; padding: 0; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
    .tarjeta { display: grid; gap: var(--space-3); padding: var(--space-4); }
    .tarjeta.urgente { border-color: var(--color-tinta); box-shadow: 0 0 0 1px var(--color-tinta), var(--shadow-sm); }
    .cabecera { display: flex; align-items: center; gap: var(--space-3); }
    .avatar { width: 40px; height: 40px; flex: none; display: grid; place-items: center; border-radius: 50%; background: var(--color-primario-suave); color: var(--color-primario); font-family: var(--font-marca); }
    .quien { display: grid; min-width: 0; }
    .quien strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .quien .muted { font-size: var(--text-xs); }
    /* Tiempo restante: pildora; solo la urgente se rellena (tinta) para que salte a la vista. */
    .tiempo { margin-left: auto; display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: var(--radius-pill); font-size: var(--text-xs); font-weight: 700; white-space: nowrap; background: var(--color-arena); color: var(--color-texto); }
    .tiempo svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; }
    .tiempo.atento { background: var(--color-primario-suave); color: var(--color-primario-fuerte); }
    .tiempo.urgente { background: var(--color-tinta); color: #fff; }
    .que { display: grid; gap: 2px; padding: var(--space-3); border-radius: var(--radius-sm); background: var(--color-arena); text-decoration: none; color: inherit; transition: background-color .15s; }
    .que:hover { background: var(--color-primario-suave); }
    .que .titulo { font-weight: 650; }
    .que .muted { font-size: var(--text-xs); }
    .prioridad { width: fit-content; margin-top: 4px; padding: 2px 10px; border-radius: var(--radius-pill); background: linear-gradient(135deg, #2b4cf2, #6a4fe0); color: #fff; font-size: var(--text-xs); font-weight: 650; }
    /* Barra del plazo: un solo color de la marca; se oscurece al final. */
    .barra { height: 6px; border-radius: var(--radius-pill); background: var(--color-linea); overflow: hidden; }
    .barra span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--color-accion), var(--color-primario)); transition: width .6s cubic-bezier(.22, 1, .36, 1); }
    .tarjeta.urgente .barra span { background: var(--color-tinta); }
    .acciones { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); }
    .sin-celular { font-size: var(--text-xs); }
    .vacio { padding: var(--space-5); border-radius: var(--radius-lg); background: var(--color-arena); color: var(--color-tenue); font-weight: 600; }
    @media (max-width: 600px) { .dato { padding: var(--space-2) var(--space-3); } .dato dd { font-size: var(--text-lg); } }
    `,
})
export class EnCursoSoporte {
  protected readonly estado = inject(CoordinacionEstado);
  private readonly sesion = inject(SesionGateway);
  /** Se recalcula cada minuto para que las barras y los tiempos avancen solos. */
  private readonly ahora = signal(new Date());

  protected readonly tarjetas = computed<readonly TarjetaSoporte[]>(() =>
    this.estado.enCurso().map((atencion) => this.aTarjeta(atencion, this.ahora())),
  );

  protected readonly conteo = computed(() => {
    const ritmos = this.tarjetas().map((t) => t.ritmo);
    const contar = (r: Ritmo) => ritmos.filter((x) => x === r).length;
    return { urgente: contar('urgente'), atento: contar('atento'), tranquilo: contar('tranquilo') };
  });

  constructor() {
    const reloj = setInterval(() => this.ahora.set(new Date()), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(reloj));
  }

  protected inicial(a: AtencionEnCurso): string {
    return a.ayudanteAlias.trim().charAt(0).toUpperCase();
  }

  protected categoria(a: AtencionEnCurso): string {
    return infoCategoria(a.categoria).etiqueta;
  }

  protected tomada(a: AtencionEnCurso): string {
    return a.tomadaEn ? tiempoRelativo(a.tomadaEn) : 'hace un rato';
  }

  protected porcentaje(t: TarjetaSoporte): number {
    return Math.round(t.avance * 100);
  }

  protected textoTiempo(t: TarjetaSoporte): string {
    if (t.horas === null) return 'sin plazo';
    if (t.horas <= 0) return 'vencida';
    if (t.horas < 1) return 'menos de 1 h';
    return `quedan ${Math.floor(t.horas)} h`;
  }

  private aTarjeta(atencion: AtencionEnCurso, ahora: Date): TarjetaSoporte {
    const horas = horasRestantes(atencion.venceEn, ahora);
    const avance = horas === null ? 0 : Math.min(1, Math.max(0, 1 - horas / HORAS_PARA_ENTREGAR));
    const ritmo: Ritmo = horas !== null && horas <= HORAS_URGENTE ? 'urgente' : horas !== null && horas <= HORAS_ATENTO ? 'atento' : 'tranquilo';
    return {
      atencion,
      horas,
      avance,
      ritmo,
      whatsapp: atencion.ayudanteCelular ? enlaceWhatsappA(atencion.ayudanteCelular, this.mensaje(atencion)) : undefined,
    };
  }

  private mensaje(a: AtencionEnCurso): string {
    const yo = this.sesion.ayudante()?.alias ?? 'la coordinación';
    return `Hola ${a.ayudanteAlias}, te escribe ${yo} de Sevilla Renace. ¿Cómo vas con la ayuda «${a.titulo}» (${a.sector})? Si necesitas apoyo, transporte o más tiempo, cuéntanos y te ayudamos. ¡Gracias por ayudar!`;
  }

}
