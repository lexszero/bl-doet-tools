import { SvelteMap } from 'svelte/reactivity';
import L from 'leaflet';
import { parseISO as parseTimestamp } from 'date-fns';

import type {
  API,
  GridFeature,
  GridCableFeature,
  GridPDUProperties,
  ItemizedLogEntry
} from './api';

export const Vref_LL = 400;
export const Vref_LN = Vref_LL / Math.sqrt(3);

interface StyleWeightColor {
  weight: number;
  color: string;
}

interface GridItemSizeData {
  phases: 3 | 1;
  max_amps: number;
  ohm_per_km: number;
  style: StyleWeightColor;
}

export const logLevelToColor = (level: number) => (
  (level >= 40) ? 'error'
  : (level >= 30) ? 'warning'
    : (level >= 20) ? 'success'
      : 'surface');


export const gridItemSizes = ['250', '125', '63', '32', '16', '1f'];
export const gridItemSizeData = (size: string) => ({
    '250': {
      phases: 3,
      max_amps: 250,
      ohm_per_km: 0.366085,
      style: {
        weight: 6,
        color: '#B50E85',
      }
    },
    '125': {
      phases: 3,
      max_amps: 125,
      ohm_per_km: 0.522522,
      style: {
        weight: 5,
        color: '#C4162A',
      }
    },
    '63': {
      phases: 3,
      max_amps: 63,
      ohm_per_km: 1.14402,
      style: {
        weight: 4,
        color: '#F2495C',
      }
    },
    '32': {
      phases: 3,
      max_amps: 32,
      ohm_per_km: 3.05106,
      style: {
        weight: 3,
        color: '#FF9830',
      }
    },
    '16': {
      phases: 3,
      max_amps: 16,
      ohm_per_km: 7.32170,
      style: {
        weight: 2,
        color: '#FADE2A'
      }
    },
    '1f': {
      phases: 1,
      max_amps: 16,
      ohm_per_km: 7.32170,
      style: {
        weight: 1,
        color: '#5794F2'
      }
    },
    'unknown': {
      phases: undefined,
      max_amps: undefined,
      ohm_per_km: undefined,
      style: {
        weight: 5,
        color: '#FF0000'
      }
    },
  }[size] as GridItemSizeData);

interface LossCalculationParams {
  loadAmps?: number;
  loadPercentage?: number;
};

export interface LossCalculationResult {
  Phases: 3 | 1;
  L: number;
  R: number;
  I: number;
  Vdrop: number;
  VdropPercent: number;
  Ploss: number;
}

type DistanceFunction = ((a: L.LatLngExpression, b: L.LatLngExpression) => number);

export class GridData {
  api: API;
  features: SvelteMap<string, GridFeature> = $state(new SvelteMap<string, GridFeature>);

  timestamp?: Date;
  log?: ItemizedLogEntry[];

  distance: DistanceFunction = L.CRS.Earth.distance;
  lossCalculationParams: LossCalculationParams = { loadPercentage: 50 };

  calculatedLossToSource: SvelteMap<string, LossCalculationResult>;

  constructor(api: API) {
    this.api = api;
    this.features = new SvelteMap<string, GridFeature>();
  }

  async load(timeEnd?: Date) {
    const data = await this.api.getPowerGridProcessed(timeEnd);
    this.timestamp = parseTimestamp(data.timestamp);

    const features = new SvelteMap<string, GridFeature>(
      data.features.features.map(
        (it: GridFeature) => ([it.id, it])
      ));
    for (const f of features.values()) {
      f.properties._drc = []
      if (f.properties.type == 'power_grid_cable') {
        const props = f.properties;
        if (props.pdu_from) {
          const p = features.get(props.pdu_from)?.properties as GridPDUProperties;
          if ((p.cables_out?.indexOf(f.id) || -1) >= 0) {
            continue;
          }
          if (!p.cables_out) {
            p.cables_out = []
          }
          p.cables_out.push(f.id);
        }
      }
    }
    if (data.log) {
      this.log = data.log.toSorted((a, b) => (b.level - a.level));
      for (const entry of (this.log || [])) {
        if (entry.item_id) {
          const props = features.get(entry.item_id)?.properties;
          if (props) {
            if (props._drc) {
              props._drc.push(entry);
            } else {
              props._drc = [entry]
            }
          }
        }
      }
    }
    this.calculatedLossToSource = new SvelteMap<string, LossCalculationResult>();
    this.updateCalculatedInfo(this.lossCalculationParams);
    this.features = features;
  }

  updateCalculatedInfo(
    params: LossCalculationParams,
    allFeatures: Map<string, GridFeature> = this.features) {
    this.lossCalculationParams = params;
    for (const f of this.features.values()) {
      if (f.properties.type == 'power_grid_pdu') {
        this.calculateLossToSource(f, params, allFeatures)
      }
    }
  }

  getLossToSource(
    feature: GridFeature,
  ) {
    let loss = this.calculatedLossToSource.get(feature.id);
    if (!loss) {
      loss = this.calculateLossToSource(feature)
    }
  }

  calculateLossToSource(
    feature: GridFeature,
    params: LossCalculationParams = { loadPercentage: 50 },
    allFeatures: Map<string, GridFeature> = this.features
  ) {
    return this.calculatedLossToSource.set(
      feature.id,
      this.calculatePathLoss(
        this.getGridPathToSource(feature, allFeatures),
        params)
    );
  }

  cableLength(feature: GridCableFeature): number {
    if (feature.properties.length_m) {
      return feature.properties.length_m;
    }
    let length = 0;
    for (let i = 0; i < feature.geometry.coordinates.length - 1; i++) {
      const p1 = feature.geometry.coordinates[i];
      const p2 = feature.geometry.coordinates[i+1];
      const d = L.CRS.Earth.distance(new L.LatLng(p1[1], p1[0]), new L.LatLng(p2[1], p2[0]));
      length += d || 0;
    }
    return length;
  }

  calculateCableLoss(
    cable: GridCableFeature,
    params: LossCalculationParams = this.lossCalculationParams
  ): LossCalculationResult {
    const sizeData = gridItemSizeData(cable.properties.power_size);
    const L = this.cableLength(cable);
    const R = L * sizeData.ohm_per_km / 1000.0;
    const I = (
       (params.loadAmps) ? Math.min(sizeData.max_amps, params.loadAmps)
       : (params.loadPercentage) ? sizeData.max_amps * params.loadPercentage / 100.0
         : 0
     );

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
      Vdrop,
      VdropPercent: Vdrop/Vref_LL*100.0,
      Ploss };
  }

  calculatePathLoss(
    path: Iterable<GridFeature>,
    params: LossCalculationParams = this.lossCalculationParams
  ): LossCalculationResult {
    let Length = 0;
    let Resistance = 0;
    let Imax = Infinity;
    let pathPhases: 3 | 1 = 3;
    let pathVdrop = 0;
    let pathPloss = 0;

    for (const feature of path) {
      if (feature.properties.type == 'power_grid_cable') {
        const cable = feature as GridCableFeature;
        const sizeData = gridItemSizeData(cable.properties.power_size);
        const { Phases, L, R, Vdrop, Ploss } = this.calculateCableLoss(cable, params)

        Length += L;
        Resistance += R;
        if (Phases < pathPhases) {
          pathPhases = Phases;
        }

        const cableImax = sizeData.max_amps;
        if (cableImax < Imax)
          Imax = cableImax;

        pathVdrop += Vdrop;
        pathPloss += Ploss;
      }
    }

    return {
      Phases: pathPhases,
      L: Length,
      R: Resistance,
      I: Imax,
      Vdrop: pathVdrop / Math.sqrt(3),
      VdropPercent: pathVdrop / Vref_LL / Math.sqrt(3) * 100.0,
      Ploss: pathPloss
    };
  }

  getGridPathToSource(
    feature: GridFeature,
    allFeatures: Map<string, GridFeature> = this.features
  ): GridFeature[] {
    if (feature.properties._pathToSource) {
      return feature.properties._pathToSource.map((id) => (allFeatures.get(id) as GridFeature));
    } else {
      const path = this.findGridPathToSource(feature);
      feature.properties._pathToSource = path.map((f) => f.id);
      return path;
    }
  }

  getGridPathToSourceIds(
    feature: GridFeature,
    allFeatures: Map<string, GridFeature> = this.features
  ): string[] {
    if (!feature.properties._pathToSource) {
      const path = this.findGridPathToSource(feature);
      feature.properties._pathToSource = path.map((f) => f.id);
    }
    return feature.properties._pathToSource;
  }

  getGridPreviousId(item: string | GridFeature): string | undefined {
    const feature = (typeof item === 'string') ? this.features.get(item) : item;
    const props = feature?.properties;
    if (props?.type == 'power_grid_pdu') {
      const id = props.cable_in;
      if (!props.power_source)
        return id;
    } else if (props?.type == 'power_grid_cable') {
      return props.pdu_from;
    }
    return undefined;
  }

  findGridPathToSource(
    feature: GridFeature,
    allFeatures: Map<string, GridFeature> = this.features
  ): Array<GridFeature> {
    const features = allFeatures || this.features;
    const idNext = this.getGridPreviousId(feature);
    const next = idNext ? features.get(idNext) : undefined;
    //console.log(layer.feature.id, "->", idNext);
    if (next)
      return [feature, ...this.findGridPathToSource(next)];
    else 
      return [feature];
  }
}
