import { ApplicationConfig, provideBrowserGlobalErrorListeners, Provider } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
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

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    ...(supabaseConfigurado(CONFIG_SUPABASE) ? PUERTOS_SUPABASE : PUERTOS_DEMO),
  ],
};
