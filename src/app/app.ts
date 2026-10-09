import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { SiteHeader } from './layout/site-header';
import { SiteFooter } from './layout/site-footer';
import { NavMovil } from './layout/nav-movil';
import { AvisoDemo } from './layout/aviso-demo';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SiteHeader, SiteFooter, NavMovil, AvisoDemo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.modo-mapa]': 'esMapa()' },
  template: `
    <sr-aviso-demo />
    <sr-site-header />
    <main id="contenido" [class.pantalla-completa]="esMapa()">
      <router-outlet />
    </main>
    @if (!esMapa()) {
      <sr-site-footer />
    }
    <sr-nav-movil />
  `,
  styles: `
    :host { display: flex; flex-direction: column; min-height: 100dvh; }
    /* En el mapa la app ocupa exactamente la pantalla: el mapa toma el alto que dejen el aviso y el header. */
    :host(.modo-mapa) { height: 100dvh; overflow: hidden; }
    main { flex: 1; display: flex; flex-direction: column; min-height: 0; }
    @media (max-width: 860px) {
      main:not(.pantalla-completa) { padding-bottom: 96px; }
      main.pantalla-completa { padding-bottom: 72px; }
    }
  `,
})
export class App {
  private readonly url = toSignal(
    inject(Router).events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: '/' },
  );
  /** El mapa ocupa toda la pantalla, sin pie de pagina, como una app. */
  protected readonly esMapa = computed(() => this.url().split('?')[0] === '/');
}
