import type {FeaturesDataElement} from '$lib/api_project';
import { type BasicLayerDisplayOptions } from '$lib/layers/LayerController.svelte';
import type { Feature, FeatureCollection } from '$lib/utils/geojson';
import type { Named } from '$lib/utils/types';
import type { Point, LineString } from 'geojson';

interface GridFeatureCommonProperties extends Named {
  description?: string;
  power_size: string;
  power_native?: boolean;

  _pathToSource?: string[];
  _drc?: ItemizedLogEntry[];
}

export interface ItemizedLogEntry {
  item_id?: string;
  level: number;
  message: string;
};


export interface GridPDUProperties extends GridFeatureCommonProperties {
  type: "power_grid_pdu"
  power_source?: boolean
  cable_in?: string;
  cables_out?: string[];

  _consumers: string[];
}

export type GridPDUFeature = Feature<Point, GridPDUProperties>;

export interface GridCableProperties extends GridFeatureCommonProperties {
  type: "power_grid_cable"
  pdu_from?: string;
  pdu_to?: string;
  length_m?: number;

  _length?: number;
}

export type GridCableFeature = Feature<LineString, GridCableProperties>;

export type GridFeatureProperties = GridPDUProperties | GridCableProperties;
export type GridFeature = Feature<Point | LineString, GridFeatureProperties>;

export interface PowerGridDataElement extends FeaturesDataElement<GridFeature> {
  log: ItemizedLogEntry[];
}

export interface PowerGridDisplayOptions extends BasicLayerDisplayOptions {
  mode: 'size' | 'loss';
  loadPercent: number;
  showCoverage: boolean;
  coverageRadius: number;
  scalePDU: number;
  scaleCable: number;
};
