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
        <div class="resumen" role="status">
          <span class="chip urgente">{{ conteo().urgente }} por vencerse</span>
          <span class="chip atento">{{ conteo().atento }} a mitad de camino</span>
          <span class="chip tranquilo">{{ conteo().tranquilo }} con tiempo</span>
        </div>
        <ul class="lista">
          @for (t of tarjetas(); track t.atencion.necesidadId; let i = $index) {
            <li class="card tarjeta entrada" [class]="t.ritmo" [style.--i]="i">
              <div class="cabecera">
                <span class="avatar" aria-hidden="true">{{ inicial(t.atencion) }}</span>
                <div class="quien">
                  <strong>{{ t.atencion.ayudanteAlias }}</strong>
                  <span class="muted">la tomó {{ tomada(t.atencion) }}</span>
                </div>
                <span class="tiempo">{{ textoTiempo(t) }}</span>
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
                  <a class="btn btn-whatsapp" [href]="t.whatsapp" target="_blank" rel="noopener">Escribirle</a>
                  <a class="btn btn-ghost" [href]="'tel:+57' + t.atencion.ayudanteCelular">Llamar</a>
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
    .resumen { display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .chip { padding: 6px 14px; border-radius: var(--radius-pill); font-size: var(--text-xs); font-weight: 700; }
    .chip.urgente { background: #fde8e4; color: #b3261e; }
    .chip.atento { background: #fff3d6; color: #8a5a00; }
    .chip.tranquilo { background: var(--color-montana-suave); color: var(--color-montana); }
    .lista { display: grid; gap: var(--space-3); list-style: none; margin: 0; padding: 0; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
    .tarjeta { --ritmo: var(--color-montana); display: grid; gap: var(--space-3); padding: var(--space-4); border-top: 4px solid var(--ritmo); }
    .tarjeta.atento { --ritmo: #e09a10; }
    .tarjeta.urgente { --ritmo: #d23c2a; }
    .cabecera { display: flex; align-items: center; gap: var(--space-3); }
    .avatar { width: 42px; height: 42px; flex: none; display: grid; place-items: center; border-radius: 50%; background: color-mix(in srgb, var(--ritmo) 16%, white); color: var(--ritmo); font-family: var(--font-marca); }
    .quien { display: grid; min-width: 0; }
    .quien .muted { font-size: var(--text-xs); }
    .tiempo { margin-left: auto; font-size: var(--text-sm); font-weight: 700; color: var(--ritmo); white-space: nowrap; }
    .que { display: grid; gap: 2px; padding: var(--space-3); border-radius: var(--radius-sm); background: var(--color-arena); text-decoration: none; color: inherit; }
    .que .titulo { font-weight: 650; }
    .que .muted { font-size: var(--text-xs); }
    .prioridad { width: fit-content; margin-top: 4px; padding: 2px 10px; border-radius: var(--radius-pill); background: #c8431f; color: #fff; font-size: var(--text-xs); font-weight: 650; }
    .barra { height: 8px; border-radius: var(--radius-pill); background: var(--color-linea); overflow: hidden; }
    .barra span { display: block; height: 100%; border-radius: inherit; background: var(--ritmo); transition: width .6s cubic-bezier(.22, 1, .36, 1); }
    .acciones { display: flex; gap: var(--space-2); }
    .acciones .btn { flex: 1; }
    .btn-whatsapp { background: #1faa53; color: #fff; }
    .sin-celular { font-size: var(--text-xs); }
    .vacio { padding: var(--space-5); border-radius: var(--radius-lg); background: var(--color-arena); color: var(--color-tenue); font-weight: 600; }
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
