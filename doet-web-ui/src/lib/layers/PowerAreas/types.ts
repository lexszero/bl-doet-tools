import { type BasicLayerDisplayOptions } from '$lib/layers/LayerController.svelte';
import type { Feature, FeatureCollection } from '$lib/utils/geojson';
import type { Named } from '$lib/utils/types';
import type { Polygon } from 'geojson';

interface PowerAreaPrivateAttrs {
  poly: L.Polyline;
  powerNeed: number;
  population: number;
}

export interface PowerAreaProperties extends Named {
  description?: string;
  _attrs?: PowerAreaPrivateAttrs;
}

export type PowerAreaFeature = Feature<Polygon, PowerAreaProperties>;
export type PowerAreaFeatureCollection = FeatureCollection<Polygon, PowerAreaProperties>;

export interface PowerAreasDisplayOptions extends BasicLayerDisplayOptions {
  showTotalPower: boolean;
  divTotalPower: number;
}
