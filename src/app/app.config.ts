import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
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

/**
 * Composicion de dependencias. Hoy todos los puertos apuntan al backend de
 * demostracion; al conectar Supabase solo cambian estas lineas.
 */
const PUERTOS_DEMO = [
  { provide: NecesidadesLectura, useExisting: DemoBackend },
  { provide: SolicitanteGateway, useExisting: DemoBackend },
  { provide: AyudanteGateway, useExisting: DemoBackend },
  { provide: SesionGateway, useExisting: DemoBackend },
  { provide: ModoDatos, useExisting: DemoBackend },
];

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    ...PUERTOS_DEMO,
  ],
};
