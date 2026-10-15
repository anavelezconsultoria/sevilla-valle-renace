export interface ItemNavegacion {
  readonly ruta: string;
  readonly etiqueta: string;
  readonly icono: string;
}

export const NAVEGACION: readonly ItemNavegacion[] = [
  { ruta: '/', etiqueta: 'Mapa', icono: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14' },
  { ruta: '/necesidades', etiqueta: 'Necesidades', icono: 'M4 6h16M4 12h16M4 18h10' },
  { ruta: '/comunidad', etiqueta: 'Comunidad', icono: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3.1a4 4 0 0 1 0 7.8M22 21a7 7 0 0 0-5-6.7' },
  { ruta: '/mis-atenciones', etiqueta: 'Mi panel', icono: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0' },
];
