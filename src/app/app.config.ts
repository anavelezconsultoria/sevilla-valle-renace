import { ApplicationConfig, provideBrowserGlobalErrorListeners, Provider } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling, withViewTransitions } from '@angular/router';
import { routes } from './app.routes';
import {
  AyudanteGateway,
  ModoDatos,
  NecesidadesLectura,
  SesionGateway,
  SolicitanteGateway,
} from './core/ports/necesidades.ports';
import { DemoBackend } from './infrastructure/demo/demo-backend';
import { CONFIG_SUPABASE, SUPABASE_CONFIG, supabaseConfigurado } from './infrastructure/supabase/supabase.config';
import { SupabaseNecesidades } from './infrastructure/supabase/supabase-necesidades';
import { SupabaseSesion } from './infrastructure/supabase/supabase-sesion';

/**
 * Composicion de dependencias: el unico lugar que sabe que backend se usa.
 * Las pantallas solo conocen los puertos.
 */
const PUERTOS_DEMO: Provider[] = [
  { provide: NecesidadesLectura, useExisting: DemoBackend },
  { provide: SolicitanteGateway, useExisting: DemoBackend },
  { provide: AyudanteGateway, useExisting: DemoBackend },
  { provide: SesionGateway, useExisting: DemoBackend },
  { provide: ModoDatos, useExisting: DemoBackend },
];

const PUERTOS_SUPABASE: Provider[] = [
  { provide: SUPABASE_CONFIG, useValue: CONFIG_SUPABASE },
  { provide: SesionGateway, useExisting: SupabaseSesion },
  { provide: NecesidadesLectura, useExisting: SupabaseNecesidades },
  { provide: SolicitanteGateway, useExisting: SupabaseNecesidades },
  { provide: AyudanteGateway, useExisting: SupabaseNecesidades },
  { provide: ModoDatos, useExisting: SupabaseNecesidades },
];

/**
 * Datos de ejemplo forzados para revisar el diseno: solo en la maquina local
 * con ?demo en la URL. En el sitio publicado no se puede activar.
 */
function demoLocalForzado(): boolean {
  if (typeof location === 'undefined') return false;
  const esLocal = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
  return esLocal && new URLSearchParams(location.search).has('demo');
}

const usarSupabase = supabaseConfigurado(CONFIG_SUPABASE) && !demoLocalForzado();

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
      withViewTransitions({ skipInitialTransition: true }),
    ),
    ...(usarSupabase ? PUERTOS_SUPABASE : PUERTOS_DEMO),
  ],
};
