import {
  Categoria,
  CierreAtencion,
  ContactoPrivado,
  EstadoNecesidad,
  EventoNecesidad,
  Necesidad,
  TipoEvento,
  Urgencia,
} from '../../core/domain/necesidad.model';
import { CENTRO_SEVILLA } from '../../core/domain/catalogos';
import { HORAS_PARA_CONFIRMAR, HORAS_PARA_ENTREGAR, sumarHoras } from '../../core/domain/ciclo-de-vida';

/**
 * Datos FICTICIOS para el modo demostracion. Ninguna persona, sector ni caso
 * es real; la UI muestra siempre el aviso de demostracion mientras se usen.
 */

export interface RegistroDemo {
  necesidad: Necesidad;
  contacto: ContactoPrivado;
  codigo: string;
  ayudanteId?: string;
}

const AHORA = Date.now();
const haceHoras = (h: number): string => new Date(AHORA - h * 3_600_000).toISOString();

const cerca = (dLat: number, dLng: number) => ({ lat: CENTRO_SEVILLA.lat + dLat, lng: CENTRO_SEVILLA.lng + dLng });

function evento(id: string, tipo: TipoEvento, horas: number, actor: string, nota?: string, fotos: readonly string[] = []): EventoNecesidad {
  return {
    id,
    tipo,
    ocurridoEn: haceHoras(horas),
    actor,
    nota,
    evidencias: fotos.map((url, i) => ({ id: `${id}-f${i}`, url, descripcion: 'Evidencia de entrega (demostración)' })),
  };
}

/** Ilustracion SVG sin personas: representa la entrega sin exponer a nadie. */
function ilustracion(color: string, texto: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'><rect width='400' height='300' fill='${color}'/><rect x='120' y='110' width='160' height='110' rx='6' fill='#fff' opacity='.9'/><path d='M120 140h160M200 110v110' stroke='${color}' stroke-width='6'/><text x='200' y='265' font-family='sans-serif' font-size='20' fill='#fff' text-anchor='middle'>${texto}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

interface SemillaBase {
  id: string;
  codigo: string;
  categoria: Categoria;
  titulo: string;
  descripcion: string;
  urgencia: Urgencia;
  personasHogar: number;
  sector: string;
  dLat: number;
  dLng: number;
  registradaHace: number;
}

function base(s: SemillaBase, estado: EstadoNecesidad, eventos: EventoNecesidad[], extra: Partial<Necesidad> = {}): RegistroDemo {
  const ubicacion = cerca(s.dLat, s.dLng);
  return {
    codigo: s.codigo,
    contacto: { nombre: 'Persona de ejemplo', telefono: '300 000 0000', ubicacionExacta: ubicacion, referencias: 'Dato ficticio de demostración' },
    necesidad: {
      id: s.id,
      categoria: s.categoria,
      titulo: s.titulo,
      descripcion: s.descripcion,
      urgencia: s.urgencia,
      personasHogar: s.personasHogar,
      sector: s.sector,
      ubicacionAproximada: cerca(s.dLat + 0.0012, s.dLng - 0.0009),
      estado,
      registradaEn: haceHoras(s.registradaHace),
      actualizadaEn: eventos[eventos.length - 1]?.ocurridoEn ?? haceHoras(s.registradaHace),
      eventos,
      ...extra,
    },
  };
}

export function crearSemillaDemo(): RegistroDemo[] {
  const r = (id: string, horas: number) => evento(`${id}-e0`, TipoEvento.Registrada, horas, 'Solicitante');
  return [
    base({ id: 'demo-1', codigo: 'DEMO-AGUA', categoria: Categoria.Agua, titulo: 'Agua potable para una semana', descripcion: 'El tanque se rajó con el temblor. Somos 5 en casa, dos niños.', urgencia: Urgencia.Alta, personasHogar: 5, sector: 'Sector de ejemplo A', dLat: 0.004, dLng: 0.006, registradaHace: 5 }, EstadoNecesidad.Registrada, [r('demo-1', 5)]),
    base({ id: 'demo-2', codigo: 'DEMO-TECH', categoria: Categoria.Techo, titulo: 'Tejas para cubrir una habitación', descripcion: 'Se cayó parte del techo del cuarto de los niños. Necesitamos unas 20 tejas o un plástico grueso.', urgencia: Urgencia.Alta, personasHogar: 4, sector: 'Sector de ejemplo B', dLat: -0.006, dLng: 0.003, registradaHace: 20 }, EstadoNecesidad.Registrada, [r('demo-2', 20)]),
    base({ id: 'demo-3', codigo: 'DEMO-MEDI', categoria: Categoria.Medicamentos, titulo: 'Medicamento para la presión', descripcion: 'Adulto mayor sin su medicamento de la presión desde hace tres días. Tenemos la fórmula.', urgencia: Urgencia.Alta, personasHogar: 2, sector: 'Sector de ejemplo C', dLat: 0.009, dLng: -0.004, registradaHace: 9 }, EstadoNecesidad.EnAtencion, [r('demo-3', 9), evento('demo-3-e1', TipoEvento.Tomada, 3, 'Voluntaria Marta (demo)')], { ayudanteAlias: 'Voluntaria Marta (demo)', venceEn: sumarHoras(haceHoras(3), HORAS_PARA_ENTREGAR) }),
    base({ id: 'demo-4', codigo: 'DEMO-ALIM', categoria: Categoria.Alimentos, titulo: 'Mercado básico', descripcion: 'Perdimos lo que teníamos en la cocina. Arroz, granos, aceite.', urgencia: Urgencia.Media, personasHogar: 6, sector: 'Sector de ejemplo A', dLat: 0.002, dLng: 0.011, registradaHace: 30 }, EstadoNecesidad.Entregada, [r('demo-4', 30), evento('demo-4-e1', TipoEvento.Tomada, 26, 'Parroquia (demo)'), evento('demo-4-e2', TipoEvento.Entregada, 4, 'Parroquia (demo)', 'Se entregó un mercado para 6 personas.', [ilustracion('#e8590c', 'Mercado entregado')])], { ayudanteAlias: 'Parroquia (demo)', venceEn: sumarHoras(haceHoras(4), HORAS_PARA_CONFIRMAR) }),
    base({ id: 'demo-5', codigo: 'DEMO-ROPA', categoria: Categoria.Ropa, titulo: 'Cobijas para la noche', descripcion: 'Dormimos en el patio por miedo a las réplicas y hace mucho frío.', urgencia: Urgencia.Media, personasHogar: 3, sector: 'Sector de ejemplo D', dLat: -0.003, dLng: -0.008, registradaHace: 70 }, EstadoNecesidad.Atendida, [r('demo-5', 70), evento('demo-5-e1', TipoEvento.Tomada, 66, 'Juan (demo)'), evento('demo-5-e2', TipoEvento.Entregada, 60, 'Juan (demo)', 'Tres cobijas térmicas.', [ilustracion('#0c8599', 'Cobijas entregadas')]), evento('demo-5-e3', TipoEvento.Confirmada, 58, 'Solicitante', 'Gracias, llegaron bien.')], { ayudanteAlias: 'Juan (demo)', cierre: CierreAtencion.Confirmada }),
    base({ id: 'demo-6', codigo: 'DEMO-MASC', categoria: Categoria.Mascotas, titulo: 'Concentrado para dos perros', descripcion: 'Los perros quedaron con nosotros pero no tenemos con qué alimentarlos.', urgencia: Urgencia.Baja, personasHogar: 2, sector: 'Sector de ejemplo B', dLat: -0.008, dLng: 0.009, registradaHace: 14 }, EstadoNecesidad.Registrada, [r('demo-6', 14)]),
    base({ id: 'demo-7', codigo: 'DEMO-ASEO', categoria: Categoria.Aseo, titulo: 'Kit de aseo y pañales', descripcion: 'Bebé de 8 meses. Pañales talla 3 y jabón.', urgencia: Urgencia.Media, personasHogar: 4, sector: 'Sector de ejemplo C', dLat: 0.012, dLng: 0.002, registradaHace: 110 }, EstadoNecesidad.Atendida, [r('demo-7', 110), evento('demo-7-e1', TipoEvento.Tomada, 100, 'Fundación (demo)'), evento('demo-7-e2', TipoEvento.Entregada, 96, 'Fundación (demo)', 'Kit de aseo y dos paquetes de pañales.', [ilustracion('#2f9e44', 'Kit de aseo entregado')]), evento('demo-7-e3', TipoEvento.CerradaAutomaticamente, 48, 'Sistema')], { ayudanteAlias: 'Fundación (demo)', cierre: CierreAtencion.Automatica }),
    base({ id: 'demo-8', codigo: 'DEMO-MATE', categoria: Categoria.Materiales, titulo: 'Cemento para reparar una pared', descripcion: 'La pared de la cocina quedó agrietada. Un ingeniero dijo que se puede reparar.', urgencia: Urgencia.Baja, personasHogar: 5, sector: 'Sector de ejemplo D', dLat: -0.011, dLng: -0.002, registradaHace: 40 }, EstadoNecesidad.Registrada, [r('demo-8', 40)]),
  ];
}
