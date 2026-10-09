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
          <a routerLink="/seguimiento" class="btn btn-ghost seguir">Seguir mi solicitud</a>
          <a routerLink="/pedir-ayuda" class="btn btn-primary">Necesito ayuda</a>
          <a routerLink="/mis-atenciones" class="avatar" [attr.aria-label]="ayudante() ? 'Mi panel de ' + ayudante()!.alias : 'Quiero ayudar: identificarme'">
            {{ ayudante()?.alias?.charAt(0) ?? '+' }}
          </a>
        </div>
      </div>
    </header>
  `,
  styles: `
    .header { position: sticky; top: 0; z-index: 1000; background: rgba(255,255,255,.92); backdrop-filter: blur(10px); border-bottom: 1px solid var(--color-line); }
    .barra { height: var(--header-height); display: flex; align-items: center; gap: var(--space-5); padding-inline: var(--gutter); max-width: 1600px; margin-inline: auto; }
    .marca { text-decoration: none; display: inline-flex; }
    .nav { display: flex; gap: var(--space-1); margin-left: var(--space-4); }
    .nav a { padding: 8px 14px; border-radius: var(--radius-pill); font-size: var(--text-sm); font-weight: 550; color: var(--color-muted); text-decoration: none; transition: background-color .15s, color .15s; }
    .nav a:hover { color: var(--color-ink); background: var(--color-lavender-soft); }
    .nav a.activo { color: var(--color-blue); background: var(--color-blue-soft); }
    .acciones { margin-left: auto; display: flex; align-items: center; gap: var(--space-2); }
    .avatar { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: var(--color-lavender); color: var(--color-navy); font-weight: 700; text-decoration: none; text-transform: uppercase; }
    @media (max-width: 1080px) { .seguir { display: none; } }
    @media (max-width: 860px) {
      .nav, .acciones .btn { display: none; }
      .barra { height: 60px; }
    }
  `,
})
export class SiteHeader {
  protected readonly navegacion = NAVEGACION;
  protected readonly ayudante = inject(SesionGateway).ayudante;
}
