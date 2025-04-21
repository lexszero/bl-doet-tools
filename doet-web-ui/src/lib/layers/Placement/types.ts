import { type BasicLayerDisplayOptions } from '$lib/layers/LayerController.svelte';
import type { Feature, FeatureCollection } from '$lib/utils/geojson';
import type { Named } from '$lib/utils/types';
import type { Polygon } from 'geojson';
import type { GridPDUFeature } from '../PowerGrid/types';

export interface PlacementEntityProperties extends Named {
  description?: string;
  contactInfo?: string;
  nrOfPeople?: number;
  nrOfVechiles?: number;
  amplifiedSound?: number;
  powerNeed?: number;

  _nearPDUs?: [GridPDUFeature, number][];
};

export type PlacementFeature = Feature<Polygon, PlacementEntityProperties>;
export type PlacementFeatureCollection = FeatureCollection<Polygon, PlacementEntityProperties>;


export interface PlacementDisplayOptions extends BasicLayerDisplayOptions {
    mode: 'power_need' | 'grid_n_pdus' | 'grid_distance' | 'grid_loss' | 'sound',
    powerNeedThresholds: [number, number],
    pduSearchRadius: number,
    gridLoadPercent: number,
    soundMax: number
};
