import { get } from 'svelte/store';
import { persisted, type Persisted } from 'svelte-persisted-store';
import { SvelteMap } from 'svelte/reactivity';

import L from 'leaflet';
import geojson from 'geojson';
import type {Feature, FeatureCollection} from '$lib/utils/geojson';
import { type InfoItem, type ChipItem, type Named, type SearchboxItem } from '$lib/utils/types';
import { type LayerData, type Props} from '$lib/layers/LayerData.svelte';
import type {LayerID} from './Layers';
import {IconFeatureDefault, type IconType} from '$lib/Icons';

export function featureChip<G extends geojson.Geometry, P extends Named>(f?: Feature<G, P>): ChipItem {
  return f ? {id: f.id, label: f.properties.name} : {label: "<unknown>"}
}

export type MapLayer<G extends geojson.Geometry, P extends Props> = L.FeatureGroup<P> & {
  feature: FeatureCollection<G, P>;
};

export type MapFeatureLayer<G extends geojson.Geometry, P extends Props> = L.FeatureGroup<P> & {
  feature: Feature<G, P>;
}

export enum MapLayerControls {
  Off = 'off',
  Simple = 'simple',
  Full = 'full'
}

export interface BasicLayerDisplayOptions {
  visible: boolean;
  opacity: number;
};

export interface LayerControllerOptions<D extends BasicLayerDisplayOptions> {
  zIndex: number;
  priorityHighlight: number;
  prioritySelect: number;
  controls: MapLayerControls;
  filter?: ((f: Feature<geojson.Geometry, Props>) => boolean);
  style?: ((f: Feature<geojson.Geometry, Props>) => L.PathOptions);

  defaultDisplayOptions: D;
  initDisplayOptions?: D;
  onClick?: ((e: L.LeafletMouseEvent) => void);
};

export abstract class LayerController<
  G extends geojson.Geometry,
  P extends Props,
  DO extends BasicLayerDisplayOptions = BasicLayerDisplayOptions,
  > {
  public readonly id: LayerID;
  public readonly data: LayerData<G, P>;
  public readonly options: LayerControllerOptions<DO>;
  public readonly mapRoot: L.Map;

  public mapBaseLayer?: MapLayer<G, P> = $state();

  public opacity: number = $state(1);

  public features: SvelteMap<string, Feature<G, P>> = $derived(
    this.options.filter
    ? new SvelteMap<string, Feature<G, P>>(
      this.data.features.entries().filter(([id, f]) => this.options.filter(f))
    )
    : this.data.features
  );

  public displayOptions: DO = $state({visible: true, opacity: 1.0} as DO);
  private displayOptionsStore?: Persisted<DO>;

  readonly DisplayOptionsComponent? = undefined;
  readonly FeatureDetailsComponent? = undefined;

  public highlightable: boolean = $state(true);
  public selectable: boolean = $state(true);
  public infoBoxTab: string = $state('general');

  constructor(
    mapRoot: L.Map,
    data: LayerData<G, P>,
    options: LayerControllerOptions<DO>) {
    this.options = options;
    this.data = data;
    this.data.ctl = this;
    this.id = this.data.id;

    const defaultDisplayOptions = options.defaultDisplayOptions || {visible: true, opacity: 1.0} as DO;

    console.info(`Initializing layer ${this.id} with options`, options);
    if (options.initDisplayOptions) {
      this.displayOptions = {
        ...defaultDisplayOptions,
        ...options.initDisplayOptions
      };
    } else {
      this.displayOptionsStore = persisted('layer_'+this.id, defaultDisplayOptions);
      this.displayOptions = {
        ...defaultDisplayOptions,
        ...get(this.displayOptionsStore)
      };
      $effect(() => {
        this.displayOptionsStore?.set(this.displayOptions);
      });
    }

    if (this.options.priorityHighlight < 0)
      this.highlightable = false;
    if (this.options.prioritySelect < 0)
      this.selectable = false;

    this.mapRoot = mapRoot;
    const pane = this.mapRoot.createPane('layer-'+this.id);
    pane.style.zIndex = options.zIndex.toString();
    $effect(() => {
      if (this.displayOptions) {
        this.updateStyle();
      }
    });

    if (options.onClick) {
      $effect(() => {
        //console.log(`${this.id}: effect mapBaseLayer`);
        if (this.mapBaseLayer) {
          this.mapBaseLayer.on('click', (e) => options.onClick?.(e))
        }
      });
    }
  }

  getDisplayOptions() {
    return this.displayOptions.visible ? this.displayOptions : {visible: false};
  }

  featureProperties = (f: Feature<G, P>) => {
    const exclude = ['name', '_cache'];
    return (Object.entries(f.properties)
      .filter(([k]) => (!exclude.includes(k)))
      .map(([k, v]) => ({label: k, value: v} as InfoItem))
      )

  };

  mapLayers?: SvelteMap<string, MapFeatureLayer<G, P>> = $derived(
    this.mapBaseLayer ?
      new SvelteMap<string, MapFeatureLayer<G, P>> (
        (this.mapBaseLayer?.getLayers() as MapFeatureLayer<G, P>[]).map(
          (l) => [
            l.feature.id as string,
            l
          ]))
      : undefined)

  mapLayerOptions(): L.GeoJSONOptions {
    return {
      pmIgnore: true,
      pane: 'layer-'+this.id,
      onEachFeature: (f: Feature<G, P>, layer: MapFeatureLayer<G, P>) => this.onEachFeature(f, layer),
      style: (f?: Feature<G, P>): L.PathOptions => this.style(f),
      pointToLayer: (f: Feature<geojson.Point, P>, latlng: L.LatLng) => this.pointToLayer(f, latlng),
      bubblingMouseEvents: false,
      markersInheritOptions: true
    }
  }

  onEachFeature(_: Feature<G, P>, layer: MapFeatureLayer<G, P>) {
    layer.on({
      click: (e) => this.selectFeature(e.target),
      mouseover: (e) => this.highlightFeature(e.target),
      mouseout: () => this.resetHighlightedFeature(),
    });
  }

  style = (feature?: Feature<G, P>): L.PathOptions => {
    if (!feature)
      return {}

    if (this.layerHighlighted?.feature.id == feature.id) {
      return this.styleHighlighted;
    }
    else if (this.layerSelected?.feature.id == feature.id) {
      return this.styleSelected;
    }
    else {
      return this.options.style?.(feature) || {};
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

  selectFeature(item: string | MapFeatureLayer<G, P>, fly: boolean = false): MapFeatureLayer<G, P> | undefined {
    if (!this.selectable)
      return;
    this.resetSelectedFeature();
    const layer = (typeof item === 'string') ? this.mapLayers?.get(item) : item;
    if (!layer)
      return;

    console.info(`${this.data.id}: select ${layer.feature.id}`);
    layer.setStyle(this.styleSelected);
    if (fly && this.layerSelected?.feature.id != layer.feature.id) {
      if (layer.getLatLng) {
        this.mapRoot?.flyTo(layer.getLatLng(), Math.max(this.mapRoot?.getZoom(), 17));
      } else {
        this.mapRoot?.flyToBounds(layer.getBounds(), {maxZoom: 17});
      }
    }
    this.layerSelected = layer;
    return layer;
  }

  resetSelectedFeature() {
    this.mapBaseLayer?.resetStyle(this.layerSelected);
    this.layerSelected = undefined;
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
    if (!this.highlightable)
      return;
    const layer = (typeof item === 'string') ? this.mapLayers?.get(item) : item;
    if (!layer)
      return;

    //console.log(`${this.id}: highlight ${layer.feature.id}`);
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

  setInfoBoxTab(tab: string) {
    this.infoBoxTab = tab;
  }

  featureLabel: ((f: Feature<G, P>) => string) = (f: Feature<G, P>) => (f.id as string).replaceAll('_', ' ').trim();
  featureIcon: ((f: Feature<G, P>) => IconType) = () => IconFeatureDefault;
  featureColorForStatus: ((f: Feature<G, P>) => string) = () => "surface";

  searchItems: Array<SearchboxItem> = $derived([
    ...this.data?.features.values().map(
      (f: Feature<G, P>) => ({
        label: this.featureLabel(f),
        value: f.id,
        icon: this.featureIcon(f),
      } as SearchboxItem) 
    ) || []]);


}
