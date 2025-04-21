import { type BasicLayerDisplayOptions } from '$lib/layers/LayerController.svelte';
import type { Feature, FeatureCollection } from '$lib/utils/geojson';
import type { Polygon } from 'geojson';

export interface PowerAreaProperties extends Named {
  description?: string;
  population?: number;
  total_power?: number;
  area?: number;
}

export type PowerAreaFeature = Feature<Polygon, PowerAreaProperties>;
export type PowerAreaFeatureCollection = FeatureCollection<Polygon, PowerAreaProperties>;

export type PowerAreasDisplayOptions = BasicLayerDisplayOptions;
