import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NecesidadesLectura } from '../../core/ports/necesidades.ports';
import { ESTADOS_ACTIVOS } from '../../core/domain/ciclo-de-vida';
import { Categoria } from '../../core/domain/necesidad.model';
import { CATEGORIAS } from '../../core/domain/catalogos';
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
  protected readonly texto = signal('');
  protected readonly categoria = signal<Categoria | null>(null);
  protected readonly seleccionadaId = signal<string | null>(null);
  protected readonly listaAbierta = signal(false);
  protected readonly cargando = this.lectura.cargando;

  protected readonly activas = computed(() =>
    this.lectura.filtrar({
      estados: ESTADOS_ACTIVOS,
      texto: this.texto(),
      categoria: this.categoria() ?? undefined,
    }),
  );
  protected readonly cifras = computed(() => {
    this.lectura.todas();
    return this.lectura.cifras();
  });
  protected readonly seleccionada = computed(() => this.activas().find((n) => n.id === this.seleccionadaId()));

  protected alternarCategoria(valor: Categoria): void {
    this.categoria.update((actual) => (actual === valor ? null : valor));
  }

  protected alBuscar(evento: Event): void {
    this.texto.set((evento.target as HTMLInputElement).value);
  }
}
