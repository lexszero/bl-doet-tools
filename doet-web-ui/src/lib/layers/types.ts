import { type PowerAreasDisplayOptions } from './PowerAreas/types';
import { type PowerGridDisplayOptions } from './PowerGrid/types';
import { type PlacementDisplayOptions } from './Placement/types';
import { type SimpleDisplayOptions } from './Simple/Controller.svelte';

export interface MapPosition {
  center: [number, number];
  zoom: number,
}

export interface MapDisplayOptionsDTO {
  selected?: string,
  position?: MapPosition,
  roads?: SimpleDisplayOptions,
  power_areas?: PowerAreasDisplayOptions,
  power_grid?: PowerGridDisplayOptions,
  placement?: PlacementDisplayOptions,
}
