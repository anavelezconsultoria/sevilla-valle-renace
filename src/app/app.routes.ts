import { Routes } from '@angular/router';

/** Cada pagina se carga bajo demanda: el mapa de inicio no paga el peso del formulario ni de los tableros. */
export const routes: Routes = [
  {
    path: '',
    title: 'Sevilla Renace | Mapa de necesidades',
    loadComponent: () => import('./features/mapa/mapa-page').then((m) => m.MapaPage),
  },
  {
    path: 'necesidades',
    title: 'Necesidades | Sevilla Renace',
    loadComponent: () => import('./features/tablero/tablero-page').then((m) => m.TableroPage),
  },
  {
    path: 'necesidades/:id',
    title: 'Necesidad | Sevilla Renace',
    loadComponent: () => import('./features/necesidad/detalle-page').then((m) => m.DetallePage),
  },
  {
    path: 'pedir-ayuda',
    title: 'Pedir ayuda | Sevilla Renace',
    loadComponent: () => import('./features/registrar/registrar-page').then((m) => m.RegistrarPage),
  },
  {
    path: 'seguimiento',
    title: 'Mis solicitudes | Sevilla Renace',
    loadComponent: () => import('./features/seguimiento/seguimiento-page').then((m) => m.SeguimientoPage),
  },
  {
    path: 'mis-atenciones',
    title: 'Mi panel | Sevilla Renace',
    loadComponent: () => import('./features/mis-atenciones/mis-atenciones-page').then((m) => m.MisAtencionesPage),
  },
  {
    path: 'ayudas-entregadas',
    title: 'Ayudas entregadas | Sevilla Renace',
    loadComponent: () => import('./features/entregadas/entregadas-page').then((m) => m.EntregadasPage),
  },
  {
    path: 'como-funciona',
    title: 'Cómo funciona | Sevilla Renace',
    loadComponent: () => import('./features/como-funciona/como-funciona-page').then((m) => m.ComoFuncionaPage),
  },
  { path: '**', redirectTo: '' },
];
