import { type PowerAreasDisplayOptions } from './PowerAreas/types';
import { type PowerGridDisplayOptions } from './PowerGrid/types';
import { type PlacementDisplayOptions } from './Placement/types';

export interface MapPosition {
  center: [number, number];
  zoom: number,
}

export interface MapDisplayOptionsDTO {
  selected?: string,
  position?: MapPosition,
  PowerAreas?: PowerAreasDisplayOptions,
  PowerGrid?: PowerGridDisplayOptions,
  Placement?: PlacementDisplayOptions,
}
