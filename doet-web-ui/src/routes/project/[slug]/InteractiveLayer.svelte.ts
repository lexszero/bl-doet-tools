import { SvelteMap } from 'svelte/reactivity';
import type {Feature, FeatureCollection} from '$lib/api';

import L from 'leaflet';
import type {Geometry} from 'geojson';

import { type IconType, IconFeatureDefault } from './Icons.svelte';

export interface SearchboxItem {
  label: string;
  value: string;
  icon: IconType;
};

export interface ChipItem {
  id?: string;
  label: string;
}

export function featureChip<G extends Geometry, P extends {name: string}>(f?: Feature<G, P>): ChipItem{
  return f ? {id: f.id, label: f.properties.name} : {label: "<unknown>"}
}

export interface InfoItem {
  label: string;
  value: any;
  icon?: IconType;
  classes?: string;
  chips?: ChipItem[];
};

export type MapLayer<G extends Geometry, P extends object, F = FeatureCollection<G, P>> = L.GeoJSON<P> & {
  feature: F;
};

export type MapFeatureLayer<G extends Geometry, P extends object, F = Feature<G, P>> = L.FeatureGroup<P> & {
  feature: F;
}

export class InteractiveLayer<G extends Geometry, P extends object, F extends Feature<G, P> = Feature<G, P>> {
  public mapRoot?: L.Map = $state();
  public mapBaseLayer?: MapLayer<G, P> = $state();

  public features: SvelteMap<string, F> = $state(new SvelteMap<string, F>());
  constructor() {
    $effect(() => {
      if (this.features) {
        this.updateStyle();
      }
    });
  }

  /*
  $derived(this.geojson ?
    new SvelteMap<string, F>(
      this.geojson.features?.map(
        (x) => [x.id as string, x]
      ))
    : new SvelteMap());
  */
  geojson: FeatureCollection<G, P> = $derived({type: 'FeatureCollection', features: [...this.features.values()]});

  featureLabel = (f: F) => (f.id as string).replaceAll('_', ' ').trim();
  featureIcon: ((f: F) => IconType) = () => IconFeatureDefault;
  featureColorForStatus = (f: F) => "surface";

  featureProperties = (f: F) => {
    const exclude = ['name', 'type'];
    return (Object.entries(f.properties)
      .filter(([k]) => (!exclude.includes(k)))
      .map(([k, v]) => ({label: k, value: v} as InfoItem))
      )
  };

  searchItems: Array<SearchboxItem> = $derived.by(() => {
    if (!this.features)
      return [];
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

  mapLayers?: SvelteMap<string, MapFeatureLayer<G, P, F>> = $derived.by(() =>
    (this.mapBaseLayer ?
      new SvelteMap<string, MapFeatureLayer<G, P, F>> (
        (this._getLayers() as MapFeatureLayer<G, P, F>[]).map(
          (l) => [
            l.feature.id as string,
            l
          ]))
      : undefined))

  _getLayers = () => this.mapBaseLayer?.getLayers();

  mapLayerOptions() {
    return {
      pmIgnore: true,
      onEachFeature: (f: F, layer: MapFeatureLayer<G, P, F>) => this.onEachFeature(f, layer),
      style: this.style,
      pointToLayer: (f: F, latlng: L.LatLng) => this.pointToLayer(f, latlng),
    }
  }

  onEachFeature(feature: F, layer: MapFeatureLayer<G, P, F>) {
    layer.on({
      click: (e) => this.selectFeature(e.target.feature.id),
      mouseover: (e) => this.highlightFeature(e.target),
      mouseout: (e) => this.resetHighlightedFeature(e.target),
    });
  }

  style = (feature: F): L.PathOptions => {
    if (this.layerHighlighted?.feature.id == feature.id) {
      return this.styleHighlighted;
    }
    else if (this.layerSelected?.feature.id == feature.id) {
      return this.styleSelected;
    }
    else {
      return {};
    }
  }
  pointToLayer(feature: F, latlng: L.LatLng) {}

  updateStyle() {
    this.mapBaseLayer?.setStyle(this.style);
  }

  layerSelected?: MapFeatureLayer<G, P, F> = $state();
  styleSelected = {
    weight: 7,
    color: '#01FF00',
    fillColor: '#01FF00',
    fillOpacity: 1
  };

  flyToOptions: L.FitBoundsOptions = { maxZoom: 17 };

  selectFeature(item: string | MapFeatureLayer<G, P, F>, fly: boolean = false) {
    this.resetSelectedFeature();
    const layer = (typeof item === 'string') ? this.mapLayers?.get(item) : item;
    if (!layer)
      return;

    //console.log("Select ", layer.feature.id);
    layer.setStyle(this.styleSelected);
    if (fly && this.layerSelected?.feature.id != layer.feature.id) {
      if (layer.getLatLng) {
        this.mapRoot?.flyTo(layer.getLatLng(), 17, this.flyToOptions);
      } else {
        this.mapRoot?.flyToBounds(layer.getBounds(), this.flyToOptions);
      }
    }
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
