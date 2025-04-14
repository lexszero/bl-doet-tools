import { SvelteMap } from 'svelte/reactivity';
import L from 'leaflet';
import { parseJSON as parseTimestamp } from 'date-fns';
import { coordsToLatLng, distance, isSamePoint } from '$lib/utils/geo';

import type {
  API,
  GridFeature,
  GridCableFeature,
  GridPDUFeature,
  GridPDUProperties,
  ItemizedLogEntry
} from '$lib/api';

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

function gridItemSizeLE(a: string, b: string) {
  return gridItemSizes.indexOf(a) >= gridItemSizes.indexOf(b);
}

function applyToGridFeature<T>(f: GridFeature, pduFn?: ((f: GridPDUFeature) => T), cableFn?: ((f: GridCableFeature) => T)): T | undefined {
  switch (f.properties.type) {
    case 'power_grid_pdu':
      return pduFn?.(f as GridPDUFeature);
    case 'power_grid_cable':
      return cableFn?.(f as GridCableFeature);
  }
}

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

export class PowerGridData {
  api: API;
  features: SvelteMap<string, GridFeature> = $state(new SvelteMap<string, GridFeature>);

  featuresLoaded: Map<string, GridFeature> = new Map();
  featuresChanged: Map<string, GridFeature | null>;

  timestamp?: Date;
  log?: ItemizedLogEntry[] = $state();

  lossCalculationParams: LossCalculationParams = { loadPercentage: 50 };

  constructor(api: API) {
    this.api = api;
    this.features = new SvelteMap<string, GridFeature>();
    this.featuresChanged = new SvelteMap<string, GridFeature | null>();
  }

  async load(timeEnd?: Date) {
    const data = await this.api.getPowerGridProcessed(timeEnd);
    this.timestamp = parseTimestamp(data.timestamp);
    console.info(`PowerGridData: last revision at `, this.timestamp);

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
          if (!p.cables_out || p.cables_out.indexOf(f.id) < 0) {
            console.log(`Add ${f.id} to cables_out ${p.cables_out}`);
            if (!p.cables_out) {
              p.cables_out = []
            }
            p.cables_out.push(f.id);
          }
        }
      }
    }
    if (data.log) {
      for (const entry of (data.log || [])) {
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
      this.log = data.log.toSorted((a, b) => (b.level - a.level));
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

  getFeature(id?: string) {
    const result = (id) ? this.features.get(id) : undefined;
    if (!result) {
      console.error("Can't find feature ", id);
    }
    return result;
  }

  getCable(id?: string) {
    return this.getFeature(id) as GridCableFeature | undefined;
  }

  getPDU(id?: string) {
    return this.getFeature(id) as GridPDUFeature | undefined;
  }

  updateCalculatedInfo(
    params: LossCalculationParams) {
    this.lossCalculationParams = params;
    for (const f of this.features.values()) {
      if (f.properties.type == 'power_grid_pdu') {
        this.calculatePathLoss(this.getGridPathToSource(f), params)
      }
    }
  }

  getLossToSource(
    feature: GridFeature,
    params: LossCalculationParams = this.lossCalculationParams
  ) {
    return this.calculatePathLoss(
      this.getGridPathToSource(feature),
      params
    );
  }

  cableLength(feature: GridCableFeature): number {
    if (feature.properties._length) {
      return feature.properties._length;
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
    path: Array<GridFeature> | undefined,
    params: LossCalculationParams = this.lossCalculationParams
  ): LossCalculationResult {
    let Length = 0;
    let Resistance = 0;
    let Imax = Infinity;
    let pathPhases: 3 | 1 = 3;
    let pathVdrop = 0;
    let pathPloss = 0;

    if (!path || path.length < 1) {
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
  ): GridFeature[] | undefined {
    if (feature.properties._pathToSource) {
      return feature.properties._pathToSource.map((id) => this.getFeature(id));
    } else {
      const path = this.findGridPathToSource(feature);
      feature.properties._pathToSource = path?.map((f) => f.id);
      return path;
    }
    //return this.findGridPathToSource(feature);
  }

  getGridPathToSourceIds(
    feature: GridFeature,
  ): string[] | undefined {
    if (!feature.properties._pathToSource) {
      const path = this.findGridPathToSource(feature);
      feature.properties._pathToSource = path?.map((f) => f.id);
    }
    return feature.properties._pathToSource;
    //return this.findGridPathToSource(feature)?.map((f) => f.id);
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
  ): Array<GridFeature> | undefined {
    if (feature.properties.type == 'power_grid_pdu' && (feature.properties as GridPDUProperties).power_source) {
      return [feature];
    }
    const idNext = this.getGridPreviousId(feature);
    if (!idNext) {
      console.warn(`No path to source from ${feature.properties.type} ${feature.id}`);
      return undefined;
    }
    const next = this.getFeature(idNext);
    //console.log(feature.id, "->", idNext);
    if (next) {
      const path = this.findGridPathToSource(next);
      if (path) {
        return [feature, ...path];
      }
    }
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

  connectFromTo(first?: GridFeature, second?: GridFeature) {
    switch (second?.properties.type) {
      case 'power_grid_pdu': {
        const pdu = second as GridPDUFeature;
        const cable = first as GridCableFeature | undefined;
        if (cable) {
          if (pdu.properties.power_source) {
            console.log(`PDU ${pdu.id} is already power_source, can't also energize it from elsewhere`);
            return false;
          }
          if (cable.properties.power_size != pdu.properties.power_size) {
            console.log(`PDU ${pdu.id} can't be powered from cable ${cable.id} of smaller size`);
            return false;
          }
          console.log(`Connect: cable ${cable.id} => PDU ${pdu.id}`)
          pdu.properties.cable_in = cable.id;
          cable.properties.pdu_to = pdu.id;
          this.markChanged(cable);
          this.markChanged(pdu);
        } else {
          if (!pdu.properties.power_source) {
            console.log(`PDU ${pdu.id} is not power_source, and must be powered from cable`);
            return false;
          }
        }

        const pduPoint = coordsToLatLng(pdu.geometry.coordinates);

        for (const f of this.features.values()) {
          const cableNext = f as GridCableFeature;
          if (f.properties.type != 'power_grid_cable' 
            || (cable && cable.id == cableNext.id)
            || cableNext.properties.pdu_from)
            continue;

          const eps = [
            coordsToLatLng(cableNext.geometry.coordinates[0]),
            coordsToLatLng(cableNext.geometry.coordinates[cableNext.geometry.coordinates.length-1])
          ];
          if (isSamePoint(eps[0], pduPoint) || isSamePoint(eps[1], pduPoint)) {
            this.connectFromTo(pdu, cableNext)
            return true;
          }
        }
        break;
      }

      case 'power_grid_cable': {
        const cable = second as GridCableFeature;
        if (cable.properties.pdu_from) {
          console.log(`Cable ${cable.id} is already powered from PDU ${cable.properties.pdu_from}`);
          return false;
        }

        const pdu = first as GridPDUFeature | undefined;
        if (!pdu) {
          console.log(`Cable ${cable.id} must be powered from a PDU`);
          return false;
        }

        console.log(`Connect: PDU ${pdu.id} => cable ${cable.id}`)
        cable.properties.pdu_from = pdu.id;
        pdu.properties.cables_out = [...pdu.properties.cables_out || [], cable.id];
        this.markChanged(cable);
        this.markChanged(pdu);

        const eps = [
          coordsToLatLng(cable.geometry.coordinates[0]),
          coordsToLatLng(cable.geometry.coordinates[cable.geometry.coordinates.length-1])
        ];
        const cableEndPoint = isSamePoint(eps[0], coordsToLatLng(pdu.geometry.coordinates)) ? eps[1] : eps[0];

        for (const f of this.features.values()) {
          const pduNext = f as GridPDUFeature;
          if (f.properties.type != 'power_grid_pdu'
            || pdu.id == pduNext.id 
            || pduNext.properties.power_source
            || pduNext.properties.cable_in)
            continue;

          if (isSamePoint(cableEndPoint, coordsToLatLng(pduNext.geometry.coordinates))) {
            this.connectFromTo(cable, pduNext)
            return true;
          }
        }
        break;
      }
    }
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
      if (!cableP.pdu_to && gridItemSizeLE(cableP.power_size, pduP.power_size) ) {
        if (!pduP.cable_in) {
          console.log(`connect cable ${cable.id} to PDU ${pdu.id} input`);
          ok = this.connectFromTo(cable, pdu);
        } else {
          console.log(`ERROR: PDU ${pdu.id} is already powered from ${pduP.cable_in}`);
        }
      } else {
        console.log(`ERROR: cable ${cable.id} already connects from ${cableP.pdu_from} to ${cableP.pdu_to}`);
      }
    } else {
      const path = this.getGridPathToSource(pdu);
      console.log(path);
      if (!cableP.pdu_from && path) {
        console.log(`connect cable ${cable.id} to PDU ${pdu.id} output`);
        ok = this.connectFromTo(pdu, cable);
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

export default PowerGridData;
