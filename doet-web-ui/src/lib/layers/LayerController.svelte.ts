import { get } from 'svelte/store';
import { persisted, type Persisted } from 'svelte-persisted-store';
import { SvelteMap } from 'svelte/reactivity';

import L from 'leaflet';
import geojson from 'geojson';
import type {Feature, FeatureCollection} from '$lib/utils/geojson';

import { type IconType, IconFeatureDefault } from '$lib/Icons';
import { type SearchboxItem, type InfoItem, type ChipItem } from '$lib/utils/types';

export function featureChip<G extends geojson.Geometry, P extends {name: string}>(f?: Feature<G, P>): ChipItem{
  return f ? {id: f.id, label: f.properties.name} : {label: "<unknown>"}
}

export type MapLayer<G extends geojson.Geometry, P extends object> = L.GeoJSON<P> & {
  feature: FeatureCollection<G, P>;
};

export type MapFeatureLayer<G extends geojson.Geometry, P extends object> = L.FeatureGroup<P> & {
  feature: Feature<G, P>;
}

export interface BasicLayerDisplayOptions {
  visible: boolean;
  opacity: number;
};

export class LayerController<
  G extends geojson.Geometry,
  P extends object,
  D extends BasicLayerDisplayOptions = BasicLayerDisplayOptions,
  > {
  public layerName = 'layer';

  public mapRoot: L.Map;
  public mapBaseLayer?: MapLayer<G, P> = $state();
  public opacity: number = $state(1);

  public features: SvelteMap<string, Feature<G, P>> = $state(new SvelteMap<string, Feature<G, P>>());

  public displayOptions: D = $state({visible: true, opacity: 1.0} as D);
  displayOptionsStore: Persisted<D>;

  constructor(name: string, zIndex: number, mapRoot: L.Map, defaultDisplayOptions: D = {visible: true, opacity: 1.0} as D) {
    console.info(`Initializing layer ${name} with zIndex ${zIndex}`, defaultDisplayOptions);
    this.displayOptionsStore = persisted('layer_'+name, defaultDisplayOptions);
    this.displayOptions = {...defaultDisplayOptions, ...get(this.displayOptionsStore)};
    $effect(() => {
      this.displayOptionsStore.set(this.displayOptions);
    });

    this.mapRoot = mapRoot;
    const pane = this.mapRoot.createPane('layer-'+name);
    pane.style.zIndex = zIndex.toString();
    $effect(() => {
      if (this.displayOptions) {
        this.updateStyle();
      }
    });
  }

  /*
  $derived(this.geojson ?
    new SvelteMap<string, Feature<G, P>>(
      this.geojson.features?.map(
        (x) => [x.id as string, x]
      ))
    : new SvelteMap());
  */
  geojson: FeatureCollection<G, P> = $derived({type: 'FeatureCollection', features: [...this.features.values()]});

  featureLabel: ((f: Feature<G, P>) => string) = (f: Feature<G, P>) => (f.id as string).replaceAll('_', ' ').trim();
  featureIcon: ((f: Feature<G, P>) => IconType) = () => IconFeatureDefault;
  featureColorForStatus: ((f: Feature<G, P>) => string) = () => "surface";

  featureProperties = (f: Feature<G, P>) => {
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
      (f: Feature<G, P>) => ({
        label: this.featureLabel(f),
        value: f.id,
        icon: this.featureIcon(f),
      } as SearchboxItem)
    )];
    //console.log("searchItems: ", items);
    return items;
  });

  mapLayers?: SvelteMap<string, MapFeatureLayer<G, P>> = $derived.by(() =>
    (this.mapBaseLayer ?
      new SvelteMap<string, MapFeatureLayer<G, P>> (
        (this._getLayers() as MapFeatureLayer<G, P>[]).map(
          (l) => [
            l.feature.id as string,
            l
          ]))
      : undefined))

  _getLayers = () => this.mapBaseLayer?.getLayers();

  mapLayerOptions(): L.GeoJSONOptions {
    return {
      pmIgnore: true,
      pane: 'layer-'+this.layerName,
      onEachFeature: (f: Feature<G, P>, layer: MapFeatureLayer<G, P>) => this.onEachFeature(f, layer),
      style: (f?: Feature<G, P>): L.PathOptions => this.style(f),
      pointToLayer: (f: Feature<geojson.Point, P>, latlng: L.LatLng) => this.pointToLayer(f, latlng)
    }
  }

  onEachFeature(_: Feature<G, P>, layer: MapFeatureLayer<G, P>) {
    layer.on({
      click: (e) => this.selectFeature(e.target),
      mouseover: (e) => this.highlightFeature(e.target),
      mouseout: () => this.resetHighlightedFeature(),
    });
  }

  style(feature?: Feature<G, P>): L.PathOptions {
    if (!feature)
      return {}

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

  pointToLayer(_: Feature<geojson.Point, P>, latlng: L.LatLng): L.Layer {
    return L.marker(latlng);
  }

  updateStyle() {
    this.mapBaseLayer?.setStyle(this.style);
  }

  layerSelected?: MapFeatureLayer<G, P> = $state();
  styleSelected: L.PathOptions = {
    weight: 7,
    color: '#01FF00',
    fillColor: '#01FF00',
    fillOpacity: 1
  };

  flyToOptions: L.FitBoundsOptions = { maxZoom: 17 };

  selectFeature(item: string | MapFeatureLayer<G, P>, fly: boolean = false): MapFeatureLayer<G, P> | undefined {
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

  layerHighlighted?: MapFeatureLayer<G, P> = $state();
  styleHighlighted: L.PathOptions = {
    weight: 5,
    color: '#FFFD00',
    fillColor: '#FFFD00',
    fillOpacity: 1
  };
  highlightBringsToFront: boolean = true;

  highlightFeature(item: string | MapFeatureLayer<G, P>) {
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

  resetHighlightedFeature() {
    if (!this.layerHighlighted)
      return;

    if (this.layerSelected?.feature.id == this.layerHighlighted.feature.id) {
      this.layerHighlighted.setStyle(this.styleSelected)
    }
    else {
      this.mapBaseLayer?.resetStyle(this.layerHighlighted)
    }
    this.layerHighlighted = undefined;
  }
}
