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
        <div class="col">
          <p class="titulo">Emergencias</p>
          <a href="tel:123">Línea de emergencias 123</a>
          <a routerLink="/como-funciona">Cómo funciona</a>
          <a routerLink="/seguimiento">Mis solicitudes</a>
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
    .grid { display: grid; grid-template-columns: 1.4fr 1fr auto; gap: var(--space-6); align-items: start; }
    .col { display: grid; gap: var(--space-2); }
    .col p.muted { max-width: 360px; }
    .titulo { font-weight: 650; color: var(--color-tinta); }
    a { text-decoration: none; color: var(--color-tenue); }
    a:hover { color: var(--color-primario); }
    .autora { display: flex; align-items: center; gap: var(--space-3); font-size: var(--text-xs); line-height: 1.4; }
    .autora img { height: 64px; width: auto; }
    @media (max-width: 860px) { .grid { grid-template-columns: 1fr; } .footer { padding-bottom: 110px; } }
  `,
})
export class SiteFooter {}
