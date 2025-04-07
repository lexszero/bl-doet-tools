import { SvelteMap } from 'svelte/reactivity';
import type {Feature, FeatureCollection} from '$lib/api';

import { type Layer, GeoJSON, FeatureGroup, LatLng} from 'leaflet';
import type {Geometry} from 'geojson';

import {
  type Icon as IconType,
  MapPinCheckInside
} from '@lucide/svelte';

export const IconFeatureDefault = MapPinCheckInside;

export interface SearchboxItem {
  label: string;
  value: string;
  icon: IconType;
}

export type MapLayer<G extends Geometry, P, F = FeatureCollection<G, P>> = GeoJSON<P> & {
  feature: F;
};

export type MapFeatureLayer<G extends Geometry, P, F = Feature<G, P>> = FeatureGroup<P> & {
  feature: F;
}

export class InteractiveLayer<G extends Geometry, P, F extends Feature<G, P> = Feature<G, P>> {
  geojson?: FeatureCollection<G, P> = $state();
  constructor(geojson?: FeatureCollection<G, P>) {
    this.geojson = geojson;
  }

  public mapRoot?: L.Map = $state();
  public mapBaseLayer?: MapLayer<G, P> = $state();

  public features: SvelteMap<string, F> = $derived(this.geojson ?
    new SvelteMap<string, F>(
      this.geojson.features.map(
        (x: F) => [x.id as string, x]
      ))
    : new SvelteMap());

  featureLabel = (f: F) => (f.id as string).replaceAll('_', ' ').trim();
  featureIcon = (f: F) => IconFeatureDefault;

  searchItems?: Array<SearchboxItem> = $derived.by(() => {
    const items = [...this.features.values().map(
      (f: F) => ({
        label: this.featureLabel(f),
        value: f.id,
        icon: this.featureIcon(f),
      } as SearchboxItem)
    )];
    //console.log("searchItems: ", items);
    return items;
  });

  mapLayers?: SvelteMap<string, MapFeatureLayer<G, P, F>> = $derived.by(() => (this.mapBaseLayer ?
    new SvelteMap<string, MapFeatureLayer<G, P, F>> (
      this.mapBaseLayer.getLayers().map(
        (l: MapFeatureLayer<G, P, F>) => [
          l.feature.id as string,
          l
        ]))
    : undefined))

  mapLayerOptions() {
    return {
      onEachFeature: (feature: F, layer: MapFeatureLayer) => {
        layer.on({
          click: (e) => this.selectFeature(e.target.feature.id),
          mouseover: (e) => this.highlightFeature(e.target),
          mouseout: (e) => this.resetHighlightedFeature(e.target),
        });
      },
      style: (f: F) => this.style(f),
      pointToLayer: (f: F, latlng: LatLng) => this.pointToLayer(f, latlng),
    }
  }
  style(feature: F) {}
  pointToLayer(feature: F, latlng: LatLng) {}

  layerSelected?: MapFeatureLayer<G, P, F> = $state();
  styleSelected = {
    weight: 5,
    color: '#01FF00',
    fillColor: '#01FF00',
    fillOpacity: 1
  };

  selectFeature(item: string | MapLayer<G, P, F>) {
    this.resetSelectedFeature();
    const layer = (typeof item === 'string') ? this.mapLayers?.get(item) : item;
    if (!layer)
      return;

    console.log("Select ", layer.feature.id);
    layer.setStyle(this.styleSelected);
    this.layerSelected = layer;
  }
  resetSelectedFeature() {
    this.mapBaseLayer?.resetStyle(this.layerSelected);
  }

  layerHighlighted?: MapFeatureLayer<G, P, F> = $state();
  styleHighlighted = {
    weight: 5,
    color: '#FFFD00',
    fillColor: '#FFFD00',
    fillOpacity: 1
  };
  highlightBringsToFront: boolean = true;

  highlightFeature(layer: MapFeatureLayer<G, P, F>) {
    //console.log(`Feature ${layer.feature.id}: highlighted`);
    layer.setStyle(this.styleHighlighted);
    if (this.highlightBringsToFront) {
      layer.bringToFront();
    }
    this.layerHighlighted = layer;
  }

  resetHighlightedFeature(layer: MapFeatureLayer<G, P, F>) {
    if (this.layerSelected?.feature.id == layer.feature.id) {
      layer.setStyle(this.styleSelected)
    }
    else {
      this.mapBaseLayer?.resetStyle(this.layerHighlighted)
    }
    this.layerHighlighted = undefined;
  }
}
