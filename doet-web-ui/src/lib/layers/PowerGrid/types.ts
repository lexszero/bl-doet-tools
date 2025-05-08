import type {FeaturesDataElement} from '$lib/api_project';
import { type BasicLayerDisplayOptions } from '$lib/layers/LayerController.svelte';
import type { Feature } from '$lib/utils/geojson';
import type { CacheMixin, Named, ValidationLog } from '$lib/utils/types';
import type { ItemLogEntry } from '$lib/utils/misc';
import type { Point, LineString } from 'geojson';
import type { LossInfoCable, LossInfoPDU } from './calculations';

export type GridFeatureCommonCachedProperties = ValidationLog & {
  pathToSource: string[];
}

interface GridFeatureCommonProperties extends Named {
  description?: string;
  power_size: string;
  power_native?: boolean;
}

export interface GridPDUCachedProperties extends GridFeatureCommonCachedProperties {
  consumers: string[];
  loss?: LossInfoPDU;
}

export interface GridPDUProperties extends GridFeatureCommonProperties, CacheMixin<GridPDUCachedProperties> {
  type: "power_grid_pdu"
  power_source?: boolean
  cable_in?: string;
  cables_out?: string[];
}

export type GridPDUFeature = Feature<Point, GridPDUProperties>;

export interface GridCableCachedProperties extends GridFeatureCommonCachedProperties {
  loss?: LossInfoCable;
}

export interface GridCableProperties extends GridFeatureCommonProperties, CacheMixin<GridCableCachedProperties> {
  type: "power_grid_cable"
  pdu_from?: string;
  pdu_to?: string;
}

export type GridCableFeature = Feature<LineString, GridCableProperties>;

export type GridFeatureGeometry = Point | LineString
export type GridFeatureProperties = GridPDUProperties | GridCableProperties;
export type GridFeature = Feature<GridFeatureGeometry, GridFeatureProperties>;

export interface PowerGridDataElement extends FeaturesDataElement<GridFeature> {
  log: ItemLogEntry[];
}

export interface PowerGridDisplayOptions extends BasicLayerDisplayOptions {
  mode: 'size' | 'loss';
  loadPercent: number;
  showCoverage: boolean;
  coverageRadius: number;
  scalePDU: number;
  scaleCable: number;
};

export enum PowerPlugType {
  SinglePhase_Schuko = '1p_schuko',
  SinglePhase_Danish = '1p_dk',
  SinglePhase_CEE = '1p_cee',
  ThreePhase_16A = '3p_16',
  ThreePhase_32A = '3p_32',
  ThreePhase_63A = '3p_63',
  ThreePhase_125A = '3p_125'
};
