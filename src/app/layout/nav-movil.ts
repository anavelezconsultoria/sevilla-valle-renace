import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NAVEGACION } from './navegacion';

/** Barra inferior en celular: la accion principal (pedir ayuda) queda al centro, al alcance del pulgar. */
@Component({
  selector: 'sr-nav-movil',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="barra" aria-label="Navegación móvil">
      @for (item of izquierda; track item.ruta) {
        <a [routerLink]="item.ruta" routerLinkActive="activo" [routerLinkActiveOptions]="{ exact: item.ruta === '/' }">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="item.icono" /></svg>
          <span>{{ item.etiqueta }}</span>
        </a>
      }
      <a routerLink="/pedir-ayuda" class="principal" routerLinkActive="activo">
        <span class="mas" aria-hidden="true">+</span>
        <span>Pedir ayuda</span>
      </a>
      @for (item of derecha; track item.ruta) {
        <a [routerLink]="item.ruta" routerLinkActive="activo">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="item.icono" /></svg>
          <span>{{ item.corta }}</span>
        </a>
      }
    </nav>
  `,
  styles: `
    :host { display: none; }
    @media (max-width: 860px) { :host { display: block; position: fixed; left: 0; right: 0; bottom: 0; z-index: 1000; } }
    .barra { display: grid; grid-template-columns: repeat(5, 1fr); align-items: end; padding: 6px 4px calc(6px + env(safe-area-inset-bottom)); background: rgba(250,247,242,.97); backdrop-filter: blur(10px); border-top: 1px solid var(--color-linea); }
    a { display: grid; justify-items: center; gap: 2px; padding: 4px 0; font-size: 11px; font-weight: 550; color: var(--color-tenue); text-decoration: none; }
    a.activo { color: var(--color-primario); }
    .principal:active .mas { transform: scale(.92); }
    svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .principal { margin-top: -22px; color: var(--color-tinta); }
    .mas { width: 52px; height: 52px; border-radius: 50%; display: grid; place-items: center; background: var(--color-accion); color: #fff; font-size: 30px; font-weight: 300; line-height: 1; box-shadow: 0 6px 16px rgba(185,83,43,.35); border: 4px solid var(--color-fondo); transition: transform var(--dur-corta) var(--ease-salida); }
  `,
})
export class NavMovil {
  protected readonly izquierda = NAVEGACION.slice(0, 2);
  protected readonly derecha = NAVEGACION.slice(2).map((i) => ({ ...i, corta: i.ruta === '/ayudas-entregadas' ? 'Entregadas' : i.etiqueta }));
}
