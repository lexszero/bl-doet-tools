import { SvelteMap } from 'svelte/reactivity';
import L from 'leaflet';
import { parseISO as parseTimestamp } from 'date-fns';

import type {
  API,
  GridFeature,
  GridCableFeature,
  GridPDUFeature,
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

  featuresLoaded: Map<string, GridFeature>;
  featuresChanged: Map<string, GridFeature | null>;

  timestamp?: Date;
  log?: ItemizedLogEntry[];

  distance: DistanceFunction = L.CRS.Earth.distance;
  lossCalculationParams: LossCalculationParams = { loadPercentage: 50 };

  constructor(api: API) {
    this.api = api;
    this.features = new SvelteMap<string, GridFeature>();
    this.featuresChanged = new SvelteMap<string, GridFeature | null>();
  }

  async load(timeEnd?: Date) {
    const data = await this.api.getPowerGridProcessed(timeEnd);
    this.timestamp = parseTimestamp(data.timestamp);

    const features = new Map<string, GridFeature>(
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
    this.updateCalculatedInfo(this.lossCalculationParams);
    this.featuresLoaded = features;
    this.resetChanges();
  }

  resetChanges() {
    this.features = new SvelteMap<string, GridFeature>(this.featuresLoaded.entries().map(
      ([k, v]) => ([k, structuredClone(v)])
    ));
  }

  getFeature(id?: string, allFeatures: Map<string, GridFeature> = this.features) {
    if (id)
      return allFeatures.get(id);
  }

  getCable(id?: string, allFeatures: Map<string, GridFeature> = this.features) {
    return this.getFeature(id, allFeatures) as GridCableFeature | undefined;
  }

  getPDU(id?: string, allFeatures: Map<string, GridFeature> = this.features) {
    return this.getFeature(id, allFeatures) as GridPDUFeature | undefined;
  }

  updateCalculatedInfo(
    params: LossCalculationParams,
    allFeatures: Map<string, GridFeature> = this.features) {
    this.lossCalculationParams = params;
    for (const f of this.features.values()) {
      if (f.properties.type == 'power_grid_pdu') {
        this.calculatePathLoss(f, params, allFeatures)
      }
    }
  }

  getLossToSource(
    feature: GridFeature,
    params: LossCalculationParams = this.lossCalculationParams,
    allFeatures: Map<string, GridFeature> = this.features
  ) {
    return this.calculatePathLoss(
      this.getGridPathToSource(feature, allFeatures),
      params
    );
  }

  cableLength(feature: GridCableFeature): number {
    if (feature.properties._length) {
      return feature.properties.length;
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
    path: Iterable<GridFeature> | undefined,
    params: LossCalculationParams = this.lossCalculationParams
  ): LossCalculationResult {
    let Length = 0;
    let Resistance = 0;
    let Imax = Infinity;
    let pathPhases: 3 | 1 = 3;
    let pathVdrop = 0;
    let pathPloss = 0;

    if (!path) {
      return {
        Phases: 3,
        L: Infinity,
        R: Infinity,
        I: 0,
        Vdrop: Infinity,
        VdropPercent: 100,
        Ploss: 0
      }
    }

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

  forEachGridFeatureDownstream(feature: GridFeature, fn: ((f: GridFeature) => undefined)) {
    switch (feature.properties.type) {
      case 'power_grid_pdu': {
        const props = feature.properties;
        for (const id of props.cables_out || []) {
          const cable = this.getCable(id);
          if (cable) {
            this.forEachGridFeatureDownstream(cable, fn)
          }
        }
        break;
      }
      case 'power_grid_cable': {
        const props = feature.properties;
        const pdu = this.getPDU(props.pdu_to);
        if (pdu) {
          this.forEachGridFeatureDownstream(pdu, fn)
        }
        break;
      }
    }
    fn(feature);
  }

  getGridPathToSource(
    feature: GridFeature,
    allFeatures: Map<string, GridFeature> = this.features
  ): GridFeature[] | undefined {
    if (feature.properties._pathToSource) {
      return feature.properties._pathToSource.map((id) => this.getFeature(id, allFeatures));
    } else {
      const path = this.findGridPathToSource(feature, allFeatures);
      feature.properties._pathToSource = path?.map((f) => f.id);
      return path;
    }
  }

  getGridPathToSourceIds(
    feature: GridFeature,
    allFeatures: Map<string, GridFeature> = this.features
  ): string[] | undefined {
    if (!feature.properties._pathToSource) {
      const path = this.findGridPathToSource(feature, allFeatures);
      feature.properties._pathToSource = path?.map((f) => f.id);
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
  ): Array<GridFeature> | undefined {
    const idNext = this.getGridPreviousId(feature);
    const next = this.getFeature(idNext, allFeatures);
    //console.log(feature.id, "->", idNext);
    if (next) {
      const path = this.findGridPathToSource(next);
      if (path) {
        return [feature, ...path];
      }
    }
    else if (feature.properties.type == 'power_grid_pdu' && (feature.properties as GridPDUProperties).power_source) {
      return [feature];
    }
    console.log("WARNING: No path to source");
  }

  updateFeature(feature: GridFeature): string[] {
    switch (feature.properties.type) {
      case 'power_grid_pdu': {
        break;
      }
      case 'power_grid_cable': {
        feature.properties._pathToSource = undefined;
        break;
      }
    }
    return [feature.id]
  }

  markChanged(feature: GridFeature) {
    this.featuresChanged.set(feature.id, feature);
  }

  updateCableGeometry(cable: GridCableFeature) {
    cable.properties._length = undefined;
    this.markChanged(cable);
  }

  movePDU(pdu: GridPDUFeature, latlng: L.LatLng): GridCableFeature[] {
    pdu.geometry.coordinates = L.GeoJSON.latLngToCoords(latlng)
    this.markChanged(pdu);

    const changed = [];

    if (pdu.properties.cable_in) {
      const id = pdu.properties.cable_in;
      const cable = this.getCable(id);
      if (cable) {
        const coords = cable.geometry.coordinates;
        coords[coords.length-1] = pdu.geometry.coordinates;
        this.updateCableGeometry(cable);
        changed.push(cable);
      }
    }

    for (const id of pdu.properties.cables_out || []) {
      const cable = this.getCable(id);
      if (cable) {
        const coords = cable.geometry.coordinates;
        coords[0] = pdu.geometry.coordinates;
        this.updateCableGeometry(cable)
        changed.push(cable);
      }
    }

    return changed;
  }

  changeCablePath(cable: GridCableFeature, latlngs: L.LatLng[]) {
    cable.geometry.coordinates = L.GeoJSON.latLngsToCoords(latlngs);
    this.updateCableGeometry(cable);
  }

  invalidatePathToSourceDownstream(feature: GridFeature) {
    this.forEachGridFeatureDownstream(feature, (f: GridFeature) => {
      f.properties._pathToSource = undefined;
    })
  }

  deleteFeature(feature: GridFeature) {
    this.invalidatePathToSourceDownstream(feature);

    switch (feature.properties.type) {
      case 'power_grid_pdu': {
        const pdu = feature as GridPDUFeature;
        const cable_in = this.getCable(pdu.properties.cable_in);
        if (cable_in) {
          cable_in.properties.pdu_to = undefined;
          this.markChanged(cable_in);
        }
        for (const id of feature.properties.cables_out || []) {
          const cable = this.getCable(id);
          if (cable) {
            cable.properties.pdu_from = undefined;
            this.markChanged(cable);
          }
        }

        feature.properties.cable_in = undefined;
        feature.properties.cables_out = undefined;
        break;
      }

      case 'power_grid_cable': {
        const cable = feature as GridCableFeature;

        const pdu_from = this.getPDU(cable.properties.pdu_from);
        if (pdu_from)
          this.disconnectCableFromPDU(cable, pdu_from);

        const pdu_to = this.getPDU(cable.properties.pdu_from);
        if (pdu_to)
          this.disconnectCableFromPDU(cable, pdu_to);

        break;
      }
    };

    this.features.delete(feature.id);
    this.featuresChanged.set(feature.id, null);
  }

  disconnectCableFromPDU(cable: GridCableFeature, pdu: GridPDUFeature) {
    this.invalidatePathToSourceDownstream(cable);
    if (cable.properties.pdu_from == pdu.id) {
      console.log(`disconnect cable ${cable.id} from upstream PDU ${pdu.id}`);
      cable.properties.pdu_from = undefined;
      pdu.properties.cables_out = pdu.properties.cables_out?.filter((id: string) => (id != cable.id));
    } else if (cable.properties.pdu_to == pdu.id) {
      console.log(`disconnect cable ${cable.id} from downstream PDU ${pdu.id}`);
      cable.properties.pdu_to = undefined;
      pdu.properties.cable_in = undefined;
    }
    this.markChanged(cable);
    this.markChanged(pdu);
  }

  connectCableToPDU(cable: GridCableFeature, pdu: GridPDUFeature) {
    const pduP = pdu.properties, cableP = cable.properties;
    let ok = false;
    if (
      (cableP.pdu_from && (cableP.pdu_from == pdu.id)) ||
      (cableP.pdu_to && (cableP.pdu_to == pdu.id))
    ) {
      console.log(`Cable ${cable.id} is already connected to PDU ${pdu.id}, do nothing`);
      return true;
    }

    if (cableP.pdu_from) {
      if (!cableP.pdu_to) {
        if (!pduP.cable_in) {
          console.log(`connect cable ${cable.id} to PDU ${pdu.id} input`);
          cableP.pdu_to = pdu.id;
          pduP.cable_in = cable.id;
          ok = true;
        } else {
          console.log(`ERROR: PDU ${pdu.id} is already powered from ${pduP.cable_in}`);
        }
      } else {
        console.log(`ERROR: cable ${cable.id} already connects from ${cableP.pdu_from} to ${cableP.pdu_to}`);
      }
    }
    if (cableP.pdu_to) {
      if (!cableP.pdu_from) {
        console.log(`connect cable ${cable.id} to PDU ${pdu.id} output`);
        cableP.pdu_from = pdu.id;
        pduP.cables_out = [...pduP.cables_out || [], cable.id];
        ok = true;
      }
    }

    if (ok) {
      this.markChanged(cable);
      this.markChanged(pdu);
      return true;
    } else {
      console.log(`ERROR: unable to connect cable ${cable.id} with PDU ${pdu.id} in any direction`);
    }
  }
}
