import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Marca } from '../shared/ui/marca';

@Component({
  selector: 'sr-site-footer',
  imports: [RouterLink, Marca],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="footer">
      <div class="container grid">
        <div class="col">
          <sr-marca [tamano]="32" />
          <p class="muted">Plataforma comunitaria para que cada necesidad de Sevilla, Valle del Cauca, encuentre quién la atienda.</p>
        </div>
        <nav class="col" aria-label="Sevilla Renace">
          <p class="titulo">Sevilla Renace</p>
          <a routerLink="/como-funciona">Cómo funciona</a>
          <a routerLink="/seguimiento">Mis solicitudes</a>
          <a routerLink="/ayudas-entregadas">Ayudas entregadas</a>
          <a routerLink="/vecinos-que-ayudan">Vecinos que han ayudado</a>
        </nav>
        <div class="col">
          <p class="titulo">Emergencias</p>
          <a class="emergencia" href="tel:123">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>
            Llamar a la línea 123
          </a>
          <p class="muted nota">Si hay riesgo para la vida de alguien, llama primero.</p>
        </div>
        <a class="autora" href="https://anavelezconsultora.com" target="_blank" rel="noopener">
          <span>Desarrollado por</span>
          <img src="ana-velez-logo.png" alt="Ana Vélez · Consultoría, Software y Tecnología" height="64" loading="lazy" />
        </a>
      </div>
    </footer>
  `,
  styles: `
    .footer { margin-top: var(--space-7); padding-block: var(--space-6); border-top: 1px solid var(--color-linea); background: var(--color-superficie); font-size: var(--text-sm); }
    .grid { display: grid; grid-template-columns: 1.4fr 1fr 1fr auto; gap: var(--space-6); align-items: start; }
    .col { display: grid; gap: 2px; align-content: start; }
    .col a { padding-block: 6px; }
    .emergencia { display: inline-flex; align-items: center; gap: 8px; width: fit-content; margin-top: 4px; padding: 8px 14px !important; border-radius: var(--radius-pill); background: var(--color-accion-suave); color: var(--color-accion-fuerte) !important; font-weight: 650; }
    .emergencia svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .nota { font-size: var(--text-xs); margin-top: 6px; }
    .col p.muted { max-width: 360px; }
    .titulo { font-weight: 650; color: var(--color-tinta); margin-bottom: 4px; }
    a { text-decoration: none; color: var(--color-tenue); }
    a:hover { color: var(--color-primario); }
    .autora { display: flex; align-items: center; gap: var(--space-3); font-size: var(--text-xs); line-height: 1.4; }
    .autora img { height: 64px; width: auto; }
    @media (max-width: 1080px) { .grid { grid-template-columns: 1fr 1fr; } }
    @media (max-width: 860px) { .grid { grid-template-columns: 1fr; gap: var(--space-5); } .footer { padding-bottom: 110px; } }
  `,
})
export class SiteFooter {}
