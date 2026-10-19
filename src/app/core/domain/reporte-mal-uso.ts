/** Por que un vecino reporta una solicitud. Los valores coinciden con la base (migracion 0028). */
export enum MotivoReporte {
  Vende = 'vende',
  NoViveAhi = 'no_vive_ahi',
  PideMucho = 'pide_mucho',
  Otro = 'otro',
}

export const MOTIVOS_REPORTE: Readonly<Record<MotivoReporte, string>> = {
  [MotivoReporte.Vende]: 'Vende las ayudas que recibe',
  [MotivoReporte.NoViveAhi]: 'No vive ahí o la dirección es falsa',
  [MotivoReporte.PideMucho]: 'Pide muchas veces o con varios celulares',
  [MotivoReporte.Otro]: 'Otra razón',
};

export const LARGO_NOTA_REPORTE = 300;
