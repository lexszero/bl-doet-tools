import { type BasicLayerDisplayOptions } from '$lib/layers/LayerController.svelte';
import type { Feature, FeatureCollection } from '$lib/utils/geojson';
import type { CacheMixin, Named, ValidationLog } from '$lib/utils/types';
import type { Polygon } from 'geojson';

export interface PowerAreaCachedProperties extends ValidationLog {
  poly: L.Polyline;
  powerNeed: number;
  population: number;
}

export interface PowerAreaProperties extends Named, CacheMixin<PowerAreaCachedProperties> {
  description?: string;
}
export type PowerAreaGeometry = Polygon;
export type PowerAreaFeature = Feature<PowerAreaGeometry, PowerAreaProperties>;
export type PowerAreaFeatureCollection = FeatureCollection<PowerAreaGeometry, PowerAreaProperties>;

export interface PowerAreasDisplayOptions extends BasicLayerDisplayOptions {
  showTotalPower: boolean;
  divTotalPower: number;
}
