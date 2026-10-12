import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NecesidadesLectura } from '../../core/ports/necesidades.ports';
import { ESTADOS_ACTIVOS } from '../../core/domain/ciclo-de-vida';
import { Categoria, EstadoNecesidad } from '../../core/domain/necesidad.model';
import { AVISOS, CATEGORIAS, COLOR_ESTADO, ESTADOS } from '../../core/domain/catalogos';

type VistaLista = 'esperando' | 'curso';

const ESTADOS_LEYENDA = [EstadoNecesidad.Registrada, EstadoNecesidad.EnAtencion, EstadoNecesidad.Entregada] as const;
import { MapaNecesidades } from '../../shared/mapa/mapa-necesidades';
import { NecesidadCard } from '../../shared/ui/necesidad-card';
import { PanelCifras } from './panel-cifras';

@Component({
  selector: 'sr-mapa-page',
  imports: [RouterLink, MapaNecesidades, NecesidadCard, PanelCifras],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mapa-page.html',
  styleUrl: './mapa-page.css',
})
export class MapaPage {
  private readonly lectura = inject(NecesidadesLectura);

  protected readonly categorias = CATEGORIAS;
  protected readonly avisos = AVISOS;
  /** Leyenda del mapa: mismo color que los pines y las etiquetas de estado. */
  protected readonly leyenda = ESTADOS_LEYENDA.map((e) => ({ etiqueta: ESTADOS[e].etiqueta, color: COLOR_ESTADO[e] }));
  /** La lista abre en lo que espera ayuda: es lo que mas importa ver. */
  protected readonly vista = signal<VistaLista>('esperando');
  protected readonly texto = signal('');
  protected readonly categoria = signal<Categoria | null>(null);
  protected readonly seleccionadaId = signal<string | null>(null);
  protected readonly listaAbierta = signal(false);
  /** En escritorio los paneles se pueden esconder para ver el mapa completo. */
  protected readonly panelesOcultos = signal(false);
  /** En celular las categorias se despliegan como lista en lugar de deslizarse de lado. */
  protected readonly categoriasAbiertas = signal(false);
  protected readonly etiquetaCategoria = computed(() => {
    const actual = this.categoria();
    return actual ? (CATEGORIAS.find((c) => c.valor === actual)?.etiqueta ?? 'Categorías') : 'Todas las categorías';
  });
  protected readonly cargando = this.lectura.cargando;

  protected readonly activas = computed(() =>
    this.lectura.filtrar({
      estados: ESTADOS_ACTIVOS,
      texto: this.texto(),
      categoria: this.categoria() ?? undefined,
    }),
  );
  protected readonly esperando = computed(() => this.activas().filter((n) => n.estado === EstadoNecesidad.Registrada));
  protected readonly enCurso = computed(() => this.activas().filter((n) => n.estado !== EstadoNecesidad.Registrada));
  protected readonly lista = computed(() => (this.vista() === 'esperando' ? this.esperando() : this.enCurso()));
  protected readonly cifras = computed(() => {
    this.lectura.todas();
    return this.lectura.cifras();
  });
  protected readonly seleccionada = computed(() => this.activas().find((n) => n.id === this.seleccionadaId()));

  protected alternarCategoria(valor: Categoria): void {
    this.categoria.update((actual) => (actual === valor ? null : valor));
    this.categoriasAbiertas.set(false);
  }

  protected alBuscar(evento: Event): void {
    this.texto.set((evento.target as HTMLInputElement).value);
  }
}
