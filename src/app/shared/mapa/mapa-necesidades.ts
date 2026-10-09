import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import * as L from 'leaflet';
import { Necesidad } from '../../core/domain/necesidad.model';
import { infoCategoria } from '../../core/domain/catalogos';
import { crearMapa, iconoNecesidad } from './mapa-base';

/** Mapa publico: pinta las necesidades en su ubicacion APROXIMADA y avisa cual se selecciono. */
@Component({
  selector: 'sr-mapa-necesidades',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #lienzo class="lienzo" role="region" aria-label="Mapa de necesidades de Sevilla"></div>`,
  styleUrl: './mapa.css',
})
export class MapaNecesidades {
  readonly necesidades = input.required<readonly Necesidad[]>();
  readonly seleccionadaId = input<string | null>(null);
  readonly seleccionar = output<string>();

  private readonly lienzo = viewChild.required<ElementRef<HTMLDivElement>>('lienzo');
  private mapa: L.Map | null = null;
  private readonly capa = L.layerGroup();
  /** Los pines caen solo la primera vez; las actualizaciones en vivo no repiten la animacion. */
  private yaPintado = false;

  constructor() {
    afterNextRender(() => {
      this.mapa = crearMapa(this.lienzo().nativeElement);
      this.capa.addTo(this.mapa);
      this.pintar();
    });
    effect(() => {
      this.necesidades();
      this.seleccionadaId();
      this.pintar();
    });
    inject(DestroyRef).onDestroy(() => this.mapa?.remove());
  }

  private pintar(): void {
    if (!this.mapa) return;
    this.capa.clearLayers();
    const seleccionada = this.seleccionadaId();
    const animar = !this.yaPintado && this.necesidades().length > 0;
    for (const [orden, n] of this.necesidades().entries()) {
      const icono = iconoNecesidad({
        categoria: infoCategoria(n.categoria),
        estado: n.estado,
        seleccionado: n.id === seleccionada,
        orden,
        animar,
      });
      L.marker([n.ubicacionAproximada.lat, n.ubicacionAproximada.lng], { icon: icono, title: n.titulo, zIndexOffset: n.id === seleccionada ? 1000 : 0 })
        .on('click', () => this.seleccionar.emit(n.id))
        .addTo(this.capa);
    }
    if (animar) this.yaPintado = true;
    this.centrarEnSeleccionada();
  }

  private centrarEnSeleccionada(): void {
    const n = this.necesidades().find((x) => x.id === this.seleccionadaId());
    if (n && this.mapa) this.mapa.panTo([n.ubicacionAproximada.lat, n.ubicacionAproximada.lng], { animate: true });
  }
}
