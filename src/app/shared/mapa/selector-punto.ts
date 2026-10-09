import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  model,
  viewChild,
} from '@angular/core';
import * as L from 'leaflet';
import { Coordenada } from '../../core/domain/necesidad.model';
import { crearMapa, iconoPuntoElegido } from './mapa-base';

/** Selector de ubicacion para el formulario: un toque en el mapa fija el punto. */
@Component({
  selector: 'sr-selector-punto',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #lienzo class="lienzo" role="application" aria-label="Toca el mapa para marcar dónde estás"></div>`,
  styleUrl: './mapa.css',
})
export class SelectorPunto {
  readonly punto = model<Coordenada | null>(null);

  private readonly lienzo = viewChild.required<ElementRef<HTMLDivElement>>('lienzo');
  private mapa: L.Map | null = null;
  private marcador: L.Marker | null = null;

  constructor() {
    afterNextRender(() => {
      this.mapa = crearMapa(this.lienzo().nativeElement, { zoom: 15 });
      this.mapa.on('click', (e: L.LeafletMouseEvent) => this.punto.set({ lat: e.latlng.lat, lng: e.latlng.lng }));
      this.dibujar();
    });
    effect(() => {
      this.punto();
      this.dibujar();
    });
    inject(DestroyRef).onDestroy(() => this.mapa?.remove());
  }

  private dibujar(): void {
    const punto = this.punto();
    if (!this.mapa || !punto) return;
    const latLng = L.latLng(punto.lat, punto.lng);
    this.marcador ??= L.marker(latLng, { icon: iconoPuntoElegido(), draggable: true })
      .on('dragend', () => {
        const p = this.marcador?.getLatLng();
        if (p) this.punto.set({ lat: p.lat, lng: p.lng });
      })
      .addTo(this.mapa);
    this.marcador.setLatLng(latLng);
    this.mapa.panTo(latLng);
  }
}
