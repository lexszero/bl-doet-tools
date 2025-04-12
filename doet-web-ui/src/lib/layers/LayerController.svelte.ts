import { get } from 'svelte/store';
import { persisted, type Persisted } from 'svelte-persisted-store';
import { SvelteMap } from 'svelte/reactivity';

import L from 'leaflet';
import type {Geometry} from 'geojson';
import type {Feature, FeatureCollection} from '$lib/utils/geojson';

import { type IconType, IconFeatureDefault } from '$lib/Icons';
import { type SearchboxItem, type InfoItem, type ChipItem } from '$lib/utils/types';

export function featureChip<G extends Geometry, P extends {name: string}>(f?: Feature<G, P>): ChipItem{
  return f ? {id: f.id, label: f.properties.name} : {label: "<unknown>"}
}

export type MapLayer<G extends Geometry, P extends object, F = FeatureCollection<G, P>> = L.GeoJSON<P> & {
  feature: F;
};

export type MapFeatureLayer<G extends Geometry, P extends object, F = Feature<G, P>> = L.FeatureGroup<P> & {
  feature: F;
}

export interface BasicLayerDisplayOptions {
  visible: boolean;
  opacity: number;
};

export class LayerController<
  G extends Geometry,
  P extends object,
  D extends BasicLayerDisplayOptions = BasicLayerDisplayOptions,
  F extends Feature<G, P> = Feature<G, P>
  > {
  public layerName = 'layer';
  public layerZIndex = 0;

  public mapRoot: L.Map;
  public mapBaseLayer?: MapLayer<G, P> = $state();
  public opacity: number = $state(1);

  public features: SvelteMap<string, F> = $state(new SvelteMap<string, F>());

  public displayOptions: D = $state({visible: true, opacity: 1.0} as D);
  displayOptionsStore: Persisted<D>;

  constructor(name: string, mapRoot: L.Map, defaultDisplayOptions: D = {visible: true, opacity: 1.0} as D) {
    console.info(`Initializing layer ${name} with `, defaultDisplayOptions);
    this.displayOptionsStore = persisted('layer_'+name, defaultDisplayOptions);
    this.displayOptions = get(this.displayOptionsStore);
    $effect(() => {
      this.displayOptionsStore.set(this.displayOptions);
    });

    this.mapRoot = mapRoot;
    const pane = this.mapRoot.createPane('overlayPane-'+name);
    pane.style.zIndex = (400+this.layerZIndex).toString();
    $effect(() => {
      if (this.features && this.displayOptions) {
        this.updateStyle();
      }
    });
    $effect(() => {
      console.log(`Layer ${this.layerName}: set ZIndex ${this.layerZIndex}`);
      this.mapBaseLayer?.setZIndex(400+this.layerZIndex);
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

  featureLabel: ((f: F) => string) = (f: F) => (f.id as string).replaceAll('_', ' ').trim();
  featureIcon: ((f: F) => IconType) = () => IconFeatureDefault;
  featureColorForStatus: ((f: F) => string) = () => "surface";

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
      //pane: 'overlayPane-'+this.layerName,
      onEachFeature: (f: F, layer: MapFeatureLayer<G, P, F>) => this.onEachFeature(f, layer),
      style: this.style,
      pointToLayer: (f: F, latlng: L.LatLng) => this.pointToLayer(f, latlng),
    }
  }

  onEachFeature(featur: F, layer: MapFeatureLayer<G, P, F>) {
    //layer.setZIndex(400+this.layerZIndex);
    layer.on({
      click: (e) => this.selectFeature(e.target),
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

  selectFeature(item: string | MapFeatureLayer<G, P, F>, fly: boolean = false): MapFeatureLayer<G, P, F> | undefined {
    this.resetSelectedFeature();
    const layer = (typeof item === 'string') ? this.mapLayers?.get(item) : item;
    if (!layer)
      return;

    console.log(`${this.layerName}: select ${layer.feature.id}`);
    layer.setStyle(this.styleSelected);
    if (fly && this.layerSelected?.feature.id != layer.feature.id) {
      if (layer.getLatLng) {
        this.mapRoot?.flyTo(layer.getLatLng(), 17, this.flyToOptions);
      } else {
        this.mapRoot?.flyToBounds(layer.getBounds(), this.flyToOptions);
      }
    }
    this.layerSelected = layer;
    return layer;
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

  highlightFeature(item: string | MapFeatureLayer<G, P, F>) {
    const layer = (typeof item === 'string') ? this.mapLayers?.get(item) : item;
    if (!layer)
      return;

    //console.log(`${this.layerName}: highlight ${layer.feature.id}`);
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
