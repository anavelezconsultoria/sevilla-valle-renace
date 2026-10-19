import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Marca } from '../shared/ui/marca';
import { SesionGateway } from '../core/ports/necesidades.ports';
import { NAVEGACION } from './navegacion';

@Component({
  selector: 'sr-site-header',
  imports: [RouterLink, RouterLinkActive, Marca],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="header">
      <div class="barra">
        <a routerLink="/" class="marca" aria-label="Sevilla Renace, inicio"><sr-marca /></a>
        <nav class="nav" aria-label="Principal">
          @for (item of navegacion; track item.ruta) {
            <a [routerLink]="item.ruta" routerLinkActive="activo" [routerLinkActiveOptions]="{ exact: item.ruta === '/' }">{{ item.etiqueta }}</a>
          }
        </nav>
        <div class="acciones">
          <a routerLink="/seguimiento" class="btn btn-ghost seguir">Mis solicitudes</a>
          <a routerLink="/seguimiento" class="seguir-movil">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5h10M9 12h10M9 19h10M4 5h.01M4 12h.01M4 19h.01" /></svg>
            <span><span class="mis">Mis </span>solicitudes</span>
          </a>
          <a routerLink="/pedir-ayuda" class="btn btn-accion">Necesito ayuda</a>
          <a routerLink="/mis-atenciones" class="avatar" [attr.aria-label]="ayudante() ? 'Mi panel de ' + ayudante()!.alias : 'Quiero ayudar: identificarme'">
            @if (ayudante(); as a) {
              {{ a.alias.charAt(0) }}
            } @else {
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" /></svg>
            }
          </a>
        </div>
      </div>
    </header>
  `,
  styles: `
    /* Sticky en el host: un sticky solo se pega dentro de su contenedor, y el contenedor es este componente. */
    :host { display: block; position: sticky; top: 0; z-index: 1000; }
    .header { background: rgba(255,255,255,.9); backdrop-filter: blur(10px); border-bottom: 1px solid var(--color-linea); }
    .barra { height: var(--header-height); display: flex; align-items: center; gap: var(--space-5); padding-inline: var(--gutter); max-width: 1600px; margin-inline: auto; }
    .marca { text-decoration: none; display: inline-flex; }
    .nav { display: flex; gap: var(--space-1); margin-left: var(--space-4); }
    .nav a { padding: 8px 14px; border-radius: var(--radius-pill); font-size: var(--text-sm); font-weight: 550; color: var(--color-tenue); text-decoration: none; transition: background-color .15s, color .15s; }
    .nav a:hover { color: var(--color-tinta); background: var(--color-arena); }
    .nav a.activo { color: var(--color-primario); background: var(--color-primario-suave); }
    .acciones { margin-left: auto; display: flex; align-items: center; gap: var(--space-2); }
    .avatar { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: var(--color-primario); color: #fff; transition: transform var(--dur-corta) var(--ease-salida); font-weight: 700; text-decoration: none; text-transform: uppercase; }
    .avatar svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
    .seguir-movil { display: none; }
    @media (max-width: 1080px) { .seguir { display: none; } }
    /* Celular: Mi panel y Pedir ayuda ya estan abajo; arriba solo "Mis solicitudes", que no esta en la barra. */
    @media (max-width: 860px) {
      .nav, .acciones .btn, .avatar { display: none; }
      .barra { height: 60px; gap: var(--space-2); }
      .seguir-movil { margin-left: auto; white-space: nowrap; display: inline-flex; align-items: center; gap: 6px; flex: none; min-height: 40px; padding: 0 12px; border-radius: var(--radius-pill); background: var(--color-primario-suave); color: var(--color-primario); font-size: var(--text-sm); font-weight: 650; text-decoration: none; }
      .seguir-movil svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; }
    }
    /* Celulares angostos (360-390 px): la marca y el boton caben sin cortarse. */
    @media (max-width: 390px) {
      .barra { padding-inline: var(--space-3); }
      :host ::ng-deep .marca .texto { font-size: .92rem; }
      .seguir-movil { padding: 0 10px; gap: 4px; }
      .seguir-movil .mis { display: none; }
    }
  `,
})
export class SiteHeader {
  protected readonly navegacion = NAVEGACION;
  protected readonly ayudante = inject(SesionGateway).ayudante;
}
