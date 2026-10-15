import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AyudanteGateway, SesionGateway } from '../../core/ports/necesidades.ports';
import { EstadoNecesidad, Necesidad } from '../../core/domain/necesidad.model';
import { horasRestantes } from '../../core/domain/ciclo-de-vida';
import { NecesidadCard } from '../../shared/ui/necesidad-card';
import { IdentificarseForm } from '../sesion/identificarse-form';
import { RestablecerClave } from './restablecer-clave';
import { RevisionSolicitudes } from './revision-solicitudes';
import { HistorialCelularHerramienta } from './historial-celular';
import { HogaresAtendidos } from './hogares-atendidos';
import { EnCursoSoporte } from './en-curso-soporte';
import { ErroresRecientes } from './errores-recientes';
import { CoordinacionEstado } from './coordinacion-estado';
import { AvisoVencimientos } from './aviso-vencimientos';
import { ClaveAyudante } from './clave-ayudante';

interface Columna {
  readonly titulo: string;
  readonly ayuda: string;
  readonly necesidades: readonly Necesidad[];
}

type Pestana = 'mis-ayudas' | 'revision' | 'en-curso' | 'hogares' | 'sistema';

interface PestanaInfo {
  readonly id: Pestana;
  readonly etiqueta: string;
  /** Trazo SVG del icono (24x24). */
  readonly icono: string;
  readonly conteo?: number;
  /** Pide atencion: el contador se pinta de color. */
  readonly alerta?: boolean;
}

const HORAS_URGENTE = 6;
const PESTANA_INICIAL: Pestana = 'mis-ayudas';

/**
 * Mi panel. Quien ayuda ve sus ayudas en columnas; la coordinacion, ademas,
 * sus herramientas en pestanas (revision, soporte en curso, hogares, claves).
 * La pestana activa vive en la URL (?pestana=...): se comparte y el boton
 * atras funciona.
 */
@Component({
  selector: 'sr-mis-atenciones-page',
  imports: [
    RouterLink,
    NecesidadCard,
    IdentificarseForm,
    RestablecerClave,
    RevisionSolicitudes,
    HistorialCelularHerramienta,
    HogaresAtendidos,
    EnCursoSoporte,
    ErroresRecientes,
    AvisoVencimientos,
    ClaveAyudante,
  ],
  providers: [CoordinacionEstado],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container pagina">
      @if (ayudante(); as a) {
        <header class="encabezado">
          <div>
            <p class="eyebrow">Mi panel</p>
            <h1>Hola, {{ a.alias }}</h1>
            <p class="muted">Has ayudado a <strong>{{ personasAyudadas() }}</strong> personas. Gracias por estar.</p>
          </div>
          <div class="acciones">
            <a routerLink="/necesidades" class="btn btn-primary">Buscar a quién ayudar</a>
            <button type="button" class="btn btn-ghost" (click)="salir()">Salir</button>
          </div>
        </header>

        @if (a.esCoordinador) {
          <nav class="pestanas" aria-label="Secciones de Mi panel">
            <div class="riel" role="tablist">
              @for (p of pestanas(); track p.id) {
                <button
                  type="button"
                  role="tab"
                  class="pestana"
                  [class.activa]="activa() === p.id"
                  [attr.aria-selected]="activa() === p.id"
                  (click)="elegir(p.id)"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="p.icono" /></svg>
                  <span>{{ p.etiqueta }}</span>
                  @if (p.conteo !== undefined) {
                    <span class="conteo" [class.alerta]="p.alerta && p.conteo > 0">{{ p.conteo }}</span>
                  }
                </button>
              }
            </div>
            @if (activa() !== 'mis-ayudas') {
              <button type="button" class="actualizar" (click)="actualizar()" [disabled]="estado.cargando()" aria-label="Actualizar">
                <svg viewBox="0 0 24 24" aria-hidden="true" [class.girando]="estado.cargando()"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" /></svg>
              </button>
            }
          </nav>
        }

        <div class="contenido" role="tabpanel">
          @switch (activa()) {
            @case ('revision') {
              <section class="seccion entrada">
                <h2 class="titulo-seccion">Solicitudes en revisión</h2>
                <sr-revision-solicitudes />
              </section>
            }
            @case ('en-curso') {
              <section class="seccion entrada">
                <h2 class="titulo-seccion">Ayudas en curso</h2>
                <sr-en-curso-soporte />
              </section>
            }
            @case ('hogares') {
              <section class="seccion dos-columnas entrada">
                <sr-hogares-atendidos (elegir)="celularElegido.set($event)" />
                <sr-historial-celular [celularElegido]="celularElegido()" />
              </section>
            }
            @case ('sistema') {
              <section class="seccion dos-columnas entrada">
                <sr-restablecer-clave />
                <sr-errores-recientes />
              </section>
            }
            @default {
              <section class="seccion entrada">
                <sr-clave-ayudante />
                <sr-aviso-vencimientos [necesidades]="mias()" />
                <div class="columnas">
                  @for (col of columnas(); track col.titulo) {
                    <section class="columna">
                      <div class="col-cabecera">
                        <h2>{{ col.titulo }}</h2>
                        <span class="col-conteo">{{ col.necesidades.length }}</span>
                      </div>
                      <p class="ayuda muted">{{ col.ayuda }}</p>
                      <div class="tarjetas">
                        @for (n of col.necesidades; track n.id) {
                          <sr-necesidad-card [necesidad]="n" [compacta]="true" [descripcionVisible]="true" />
                        } @empty {
                          <p class="vacia">Nada por aquí.</p>
                        }
                      </div>
                    </section>
                  }
                </div>
              </section>
            }
          }
        </div>
      } @else {
        <section class="card acceso">
          <p class="eyebrow">Quiero ayudar</p>
          <h1>Identifícate para atender necesidades</h1>
          <p class="muted">Si ya ingresaste antes, para ayudar o para pedir ayuda, entra con tu celular y tu clave. Si es tu primera vez, te pedimos un nombre público, tu celular (privado) y una clave.</p>
          <sr-identificarse-form />
        </section>
      }
    </div>
  `,
  styles: `
    .pagina { padding-block: var(--space-6); }
    .encabezado { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: var(--space-4); margin-bottom: var(--space-4); }
    .encabezado h1 { font-size: var(--text-2xl); margin-block: 4px; }
    .acciones { display: flex; gap: var(--space-2); }

    /* Pestanas: riel fijo bajo la cabecera, se desliza de lado en celular. */
    .pestanas { position: sticky; top: var(--header-height); z-index: 20; display: flex; align-items: center; gap: var(--space-2); margin-inline: calc(var(--gutter) * -1); padding: var(--space-3) var(--gutter); background: color-mix(in srgb, var(--color-fondo) 88%, transparent); backdrop-filter: blur(12px); border-bottom: 1px solid var(--color-linea); }
    .riel { display: flex; gap: 6px; flex: 1; min-width: 0; padding: 5px; border-radius: var(--radius-pill); background: var(--color-arena); overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; }
    .riel::-webkit-scrollbar { display: none; }
    .pestana { display: inline-flex; align-items: center; gap: 8px; flex: none; scroll-snap-align: start; min-height: 44px; padding: 0 16px; border: 0; border-radius: var(--radius-pill); background: transparent; color: var(--color-tenue); font: inherit; font-size: var(--text-sm); font-weight: 650; cursor: pointer; transition: background-color .25s, color .25s, box-shadow .25s, transform .2s; }
    .pestana:hover { color: var(--color-tinta); }
    .pestana:active { transform: scale(.96); }
    .pestana.activa { background: var(--color-superficie); color: var(--color-primario); box-shadow: 0 6px 18px rgba(106, 79, 224, .18); }
    .pestana svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .conteo { min-width: 22px; height: 22px; padding: 0 6px; display: grid; place-items: center; border-radius: var(--radius-pill); background: var(--color-linea); color: var(--color-texto); font-size: 12px; font-weight: 700; }
    .conteo.alerta { background: var(--color-accion); color: #fff; animation: latir 2s ease-in-out infinite; }
    @keyframes latir { 50% { transform: scale(1.12); } }
    .actualizar { width: 44px; height: 44px; flex: none; display: grid; place-items: center; border: 1px solid var(--color-linea); border-radius: 50%; background: var(--color-superficie); color: var(--color-tenue); cursor: pointer; }
    .actualizar svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .girando { animation: girar .9s linear infinite; }
    @keyframes girar { to { transform: rotate(360deg); } }

    .contenido { padding-top: var(--space-5); }
    .seccion { display: grid; gap: var(--space-4); }
    .titulo-seccion { font-family: var(--font-body); font-weight: 750; font-size: var(--text-xl); }
    .dos-columnas { grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); align-items: start; }
    .dos-columnas > * { min-width: 0; }

    .columnas { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-4); align-items: start; }
    .columna { display: grid; gap: var(--space-2); padding: var(--space-4); border-radius: var(--radius-lg); background: var(--color-arena); }
    .col-cabecera { display: flex; justify-content: space-between; align-items: center; }
    h2 { font-family: var(--font-body); font-weight: 700; font-size: var(--text-md); }
    .col-conteo { min-width: 28px; height: 28px; display: grid; place-items: center; border-radius: var(--radius-pill); background: var(--color-superficie); font-weight: 700; font-size: var(--text-sm); }
    .ayuda { font-size: var(--text-xs); }
    .tarjetas { display: grid; gap: var(--space-2); }
    .vacia { font-size: var(--text-sm); color: var(--color-tenue); padding: var(--space-4); text-align: center; border: 1.5px dashed var(--color-linea-fuerte); border-radius: var(--radius-md); }
    .acceso { max-width: 520px; margin-inline: auto; padding: var(--space-6) var(--space-5); display: grid; gap: var(--space-3); }
    .acceso h1 { font-size: var(--text-xl); }
    @media (max-width: 960px) { .columnas { grid-template-columns: minmax(0, 1fr); } }
    /* Celular: cinco botones iguales, icono arriba y nombre corto abajo, como una barra de app. */
    @media (max-width: 600px) {
      .pestanas { padding-block: var(--space-2); }
      .riel { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 2px; padding: 4px; border-radius: var(--radius-lg); overflow: visible; }
      .pestana { position: relative; flex-direction: column; gap: 2px; min-height: 56px; padding: 6px 2px; border-radius: var(--radius-md); font-size: 11px; }
      .pestana span:not(.conteo) { white-space: nowrap; }
      .pestana .conteo { position: absolute; top: 3px; right: calc(50% - 22px); min-width: 18px; height: 18px; font-size: 10px; }
      .actualizar { display: none; }
    }
  `,
})
export class MisAtencionesPage {
  private readonly sesion = inject(SesionGateway);
  private readonly ayudanteGw = inject(AyudanteGateway);
  private readonly router = inject(Router);
  protected readonly estado = inject(CoordinacionEstado);

  /** Viene de la URL (?pestana=...) gracias al enlace de inputs del router. */
  readonly pestana = input<string>();
  /** Celular elegido en la lista de hogares: abre su historial. */
  protected readonly celularElegido = signal<string | null>(null);
  protected readonly ayudante = this.sesion.ayudante;

  protected readonly mias = computed(() => {
    this.ayudante();
    return this.ayudanteGw.misAtenciones();
  });

  protected readonly pestanas = computed<readonly PestanaInfo[]>(() => {
    const urgentes = this.estado.enCurso().filter((a) => (horasRestantes(a.venceEn) ?? Infinity) <= HORAS_URGENTE).length;
    const hace24h = Date.now() - 86_400_000;
    const erroresHoy = this.estado.errores().filter((e) => new Date(e.ultimaVez).getTime() > hace24h).length;
    return [
      { id: 'mis-ayudas', etiqueta: 'Mis ayudas', icono: 'M12 21s-7-4.5-9.5-9A5 5 0 0 1 12 6a5 5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z', conteo: this.mias().filter((n) => n.estado === EstadoNecesidad.EnAtencion).length },
      { id: 'revision', etiqueta: 'Revisión', icono: 'M9 4h6v3H9zM7 5H5v16h14V5h-2M9 14l2 2 4-4', conteo: this.estado.enRevision().length, alerta: true },
      { id: 'en-curso', etiqueta: 'En curso', icono: 'M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-.01M17 19a2 2 0 1 0 0-.01', conteo: this.estado.enCurso().length, alerta: urgentes > 0 },
      { id: 'hogares', etiqueta: 'Hogares', icono: 'M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6' },
      { id: 'sistema', etiqueta: 'Sistema', icono: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 14H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 10h.1a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1z', conteo: erroresHoy, alerta: true },
    ];
  });

  protected readonly activa = computed<Pestana>(() => {
    const pedida = this.pestana();
    const permitida = this.ayudante()?.esCoordinador && this.pestanas().some((p) => p.id === pedida);
    return permitida ? (pedida as Pestana) : PESTANA_INICIAL;
  });

  protected readonly columnas = computed<readonly Columna[]>(() => {
    const mias = this.mias();
    const en = (...estados: EstadoNecesidad[]) => mias.filter((n) => estados.includes(n.estado));
    return [
      { titulo: 'En curso', ayuda: 'Las tomaste y debes entregarlas en 48 horas.', necesidades: en(EstadoNecesidad.EnAtencion) },
      { titulo: 'Esperando confirmación', ayuda: 'Ya las entregaste. Se cierran solas en 48 horas si nadie reclama.', necesidades: en(EstadoNecesidad.Entregada) },
      { titulo: 'Atendidas', ayuda: 'Ayudas que llegaron. Tu historial.', necesidades: en(EstadoNecesidad.Atendida) },
    ];
  });

  protected readonly personasAyudadas = computed(() =>
    this.mias()
      .filter((n) => n.estado === EstadoNecesidad.Atendida)
      .reduce((total, n) => total + n.personasHogar, 0),
  );

  constructor() {
    // Las herramientas de coordinacion se cargan una vez al entrar como coordinacion.
    let cargado = false;
    effect(() => {
      if (!this.ayudante()?.esCoordinador || cargado) return;
      cargado = true;
      void this.estado.cargar();
    });
  }

  protected elegir(pestana: Pestana): void {
    // Al abrir una herramienta de coordinacion, sus datos se refrescan solos.
    if (pestana !== PESTANA_INICIAL && pestana !== this.activa()) void this.estado.cargar();
    void this.router.navigate([], {
      queryParams: { pestana: pestana === PESTANA_INICIAL ? null : pestana },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected actualizar(): void {
    void this.estado.cargar();
  }

  protected async salir(): Promise<void> {
    await this.sesion.cerrarSesion();
  }
}
