import { type BasicLayerDisplayOptions } from '$lib/layers/LayerController.svelte';
import type { Feature, FeatureCollection } from '$lib/utils/geojson';
import type { CacheMixin, Named, ValidationLog } from '$lib/utils/types';
import type { Polygon } from 'geojson';
import type { GridPDUFeature, PowerPlugType } from '../PowerGrid/types';

export interface PowerAppliance {
  name: string;
  amount: number;
  watt: number;
}

export interface PlacementEntityCachedProperties extends ValidationLog {
  nearPDUs?: [GridPDUFeature, number][];
}

export interface PlacementEntityProperties extends Named, CacheMixin<PlacementEntityCachedProperties> {
  description?: string;
  contactInfo?: string;
  nrOfPeople?: number;
  nrOfVechiles?: number;
  amplifiedSound?: number;

  techContactInfo?: string;
  powerPlugType?: PowerPlugType;
  powerExtraInfo?: string;
  powerImage?: string;
  powerAppliances?: PowerAppliance[];
  powerNeed?: number;
};

export type PlacementFeatureGeometry = Polygon;
export type PlacementFeature = Feature<PlacementFeatureGeometry, PlacementEntityProperties>;
export type PlacementFeatureCollection = FeatureCollection<PlacementFeatureGeometry, PlacementEntityProperties>;

export interface PlacementDisplayOptions extends BasicLayerDisplayOptions {
    mode: 'power_need' | 'grid_n_pdus' | 'grid_distance' | 'grid_loss' | 'sound',
    powerNeedThresholds: [number, number],
    pduSearchRadius: number,
    gridLoadPercent: number,
    soundMax: number
};
