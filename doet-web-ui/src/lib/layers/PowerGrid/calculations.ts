import { coordsToLatLng, distance } from "$lib/utils/geo";

import { Vref_LL, getGridItemSizeInfo } from "./constants";
import type {GridCableFeature, GridFeature} from "./types";

export interface LossParamsCable {
  loadAmps?: number;
  loadPercentage?: number;
}

export interface LossParamsPDU {
  method: 'capacity' | 'flow';
  fractionLoad: number
}

export interface LossInfoPDU {
  V: number;
  I_in: number;
  I_load: number;
}

export interface LossInfoCable {
  Phases: 3 | 1;
  L: number;
  R: number;
  I: number;
  V: number;
  Vdrop: number;
  Ploss: number;
}

export function cableLength(feature: GridCableFeature): number {
  if (feature.properties._loss?.L) {
    return feature.properties._loss.L;
  }
  let length = 0;
  for (let i = 0; i < feature.geometry.coordinates.length - 1; i++) {
    const p1 = feature.geometry.coordinates[i];
    const p2 = feature.geometry.coordinates[i+1];
    const d = distance(coordsToLatLng(p1), coordsToLatLng(p2));
    length += d || 0;
  }
  return length;
}

export function getCableAmps(params: LossParamsCable, max_amps: number) {
  return (params.loadAmps
    ? Math.min(max_amps, params.loadAmps)
    : (params.loadPercentage)
      ? max_amps * params.loadPercentage / 100.0
      : 0
  );
}

export function calculateCableLoss(
  cable: GridCableFeature,
  Vin: number,
  I: number,
): LossInfoCable {
  const sizeData = getGridItemSizeInfo(cable);
  const L = cableLength(cable);
  const R = L * sizeData.ohm_per_km / 1000.0;

  const Vdrop = 
    (sizeData.phases == 3) ?
    (R * I * Math.sqrt(3)) :
    (R * I * 2);
  const Ploss = Vdrop * I;
  return {
    Phases: sizeData.phases,
    L,
    R,
    I,
    V: Vin,
    Vdrop,
    Ploss
  };
}

export function calculatePathLoss(
  path: Array<GridFeature> | undefined,
  params: LossParamsCable
): LossInfoCable {
  let Length = 0;
  let Resistance = 0;
  let Imax = Infinity;
  let pathPhases: 3 | 1 = 3;
  let pathVdrop = 0;
  let pathPloss = 0;

  const infiniteLoss = {
    Phases: 3,
    L: Infinity,
    R: Infinity,
    I: 0,
    V: Vref_LL,
    Vdrop: Infinity,
    Ploss: 0
  } as LossInfoCable;


  if (!path || path.length < 1) {
    return infiniteLoss;
  }

  for (const feature of path) {
    if (feature.properties.type == 'power_grid_cable') {
      const cable = feature as GridCableFeature;
      const sizeData = getGridItemSizeInfo(cable);
      const cableImax = sizeData.max_amps;
      const I = getCableAmps(params, cableImax);
      const info = calculateCableLoss(cable, Vref_LL - pathVdrop, I);
      if (!info)
        return infiniteLoss;

      Length += info.L;
      Resistance += info.R;
      if (info.Phases < pathPhases) {
        pathPhases = info.Phases;
      }

      if (cableImax < Imax)
        Imax = cableImax;

      pathVdrop += info.Vdrop;
      pathPloss += info.Ploss;
    }
  }

  return {
    Phases: pathPhases,
    L: Length,
    R: Resistance,
    I: Imax,
    V: Vref_LL,
    Vdrop: pathVdrop / Math.sqrt(3),
    Ploss: pathPloss
  };
}
