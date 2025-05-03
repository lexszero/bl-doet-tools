import L from 'leaflet';
import { coordsToLatLng, isSamePoint } from '$lib/utils/geo';

import type {
  GridFeature,
  GridCableFeature,
  GridCableCachedProperties,
  GridPDUFeature,
  GridPDUProperties,
  GridPDUCachedProperties,
  GridFeatureCommonCachedProperties,
  GridFeatureGeometry,
  GridFeatureProperties
} from './types';

import { Vref_LL, getGridItemSizeInfo, gridItemSizeLE } from './constants';
import {
  calculateCableLoss,
  calculatePathLoss,
  getCableAmps,
  type LossInfoPDU,
  type LossParamsCable,
  type LossParamsPDU,
} from './calculations';
import {Severity, type ItemLogEntry} from '$lib/utils/misc';
import {LayerData, featureCachedProps} from '../LayerData.svelte';
import PowerGridController from './Controller.svelte';

export class PowerGridData extends LayerData<GridFeatureGeometry, GridFeatureProperties> {
  declare ctl: PowerGridController;
  log?: ItemLogEntry[] = $state();

  lossCalculationParams: LossParamsPDU = {
    method: 'capacity',
    fractionLoad: 0.5
  };

  processFeaturesAfterLoad(features: Map<string, GridFeature>): void {
    for (const f of features.values()) {
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
  }

  updateCache() {
    super.updateCache();
    this.updateCalculatedInfo(this.lossCalculationParams);
  }

  getCable(id?: string) {
    return this.getFeature(id) as GridCableFeature | undefined;
  }

  getPDU(id?: string) {
    return this.getFeature(id) as GridPDUFeature | undefined;
  }

  validateFeature(f: GridFeature) {
    const log: ItemLogEntry[] = [];
    const record = (level: Severity, message: string) => log.push({item_id: f.id, level, message});
    switch (f.properties.type) {
      case 'power_grid_pdu': {
        const props = f.properties;
        if (!props.cable_in && !props.power_source)
          record(Severity.Error, "PDU is not getting power");
        break;
      }

      case 'power_grid_cable': {
        const props = f.properties;
        if (!props.pdu_from)
          record(Severity.Error, "Cable is not connected to source");
        if (!props.pdu_to)
          record(Severity.Error, "Cable is not connected to load");
        break;
      }
    }
    return log;
  }

  updateCalculatedInfo(
    params: LossParamsPDU) {
    this.lossCalculationParams = params;
    for (const f of this.features.values()) {
      if (f.properties.type == 'power_grid_pdu' && f.properties.power_source) {
        const pdu = f as GridPDUFeature;
        this.updateLossFromPDU(pdu, Vref_LL, getGridItemSizeInfo(f).max_amps, this.lossCalculationParams);
      }
    }
  }

  getLossToSource(
    feature: GridFeature,
    params: LossParamsPDU = this.lossCalculationParams
  ) {
    return calculatePathLoss(
      this.getGridPathToSource(feature),
      { loadPercentage: params.fractionLoad * 100 }
    );
  }

  updateLossFromPDU(
    pdu: GridPDUFeature,
    V_in: number,
    I_in: number,
    params: LossParamsPDU
  ) {
    //console.debug(`updateLossFromPDU ${pdu.id} V_in=${V_in} I_in=${I_in} params=${JSON.stringify(params)}`);
    const cables_out = pdu.properties.cables_out?.map((id) => this.getCable(id)) || [];

    interface Calc {
      getCableAmps: ((cable: GridCableFeature) => number);
      getCableParams: ((cable: GridCableFeature) => LossParamsCable);
      getPDUAmps: ((pdu: GridPDUFeature) => number);
      fractionLoad: number;
    };

    let calc: Calc | undefined = undefined;

    switch (params.method) {
      case 'capacity': {
        calc = {
          fractionLoad: 0,
          getCableParams: () => ({loadPercentage: params.fractionLoad*100}),
          getCableAmps: (cable: GridCableFeature) => getCableAmps({loadPercentage: params.fractionLoad*100}, getGridItemSizeInfo(cable).max_amps),
          getPDUAmps: (pdu: GridPDUFeature) => getGridItemSizeInfo(pdu).max_amps
        };
        break;
      };

      case 'flow': {
        const Imax_totalForward = cables_out.map((c) => c ? getGridItemSizeInfo(c).max_amps : 0).reduce((sum, I) => (I ? sum+I : sum), 0);
        const getCableAmps = (cable: GridCableFeature | undefined) => {
          if (!cable)
            return 0;
          const Imax = getGridItemSizeInfo(cable).max_amps;
          const fractionForward = 1 - params.fractionLoad * (1-Imax/250);
          return I_in * fractionForward * (Imax / Imax_totalForward);
        };
        calc = {
          fractionLoad: (cables_out.length) ? 1 : params.fractionLoad,
          getCableAmps: getCableAmps,
          getCableParams: (cable: GridCableFeature) => ({loadAmps: getCableAmps(cable)}),
          getPDUAmps: (pdu: GridPDUFeature) => (pdu.properties.cable_in ? getCableAmps(this.getCable(pdu.properties.cable_in)) : 0)
        };
        break;
      }
    }

    if (!calc)
      throw new Error("Unsupported loss calculation method")

    const lossPDU: LossInfoPDU = {
      V: V_in,
      I_in: I_in,
      I_load: I_in * calc.fractionLoad,
    };
    (featureCachedProps(pdu) as GridPDUCachedProperties).loss = lossPDU;

//    console.debug(`PDU ${pdu.id}: `, lossPDU);

    for (const cable of cables_out) {
      if (!cable)
        continue;

      const lossCable = calculateCableLoss(cable, V_in, calc.getCableAmps(cable));
      (featureCachedProps(cable) as GridCableCachedProperties).loss = lossCable;

 //     console.debug(`Cable ${cable.id}: `, lossCable);

      const pduTo = this.getPDU(cable.properties.pdu_to);
      if (pduTo)
        this.updateLossFromPDU(pduTo, V_in - lossCable.Vdrop, calc.getPDUAmps(pduTo), params)
    }
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
    const c = featureCachedProps(feature) as GridFeatureCommonCachedProperties;
    if (c.pathToSource) {
      return c.pathToSource.map((id) => this.getFeature(id));
    } else {
      const path = this.findGridPathToSource(feature);
      c.pathToSource = path?.map((f) => f.id);
      return path;
    }
    //return this.findGridPathToSource(feature);
  }

  getGridPathToSourceIds(
    feature: GridFeature,
  ): string[] | undefined {
    const c = featureCachedProps(feature) as GridFeatureCommonCachedProperties;
    if (!c.pathToSource) {
      const path = this.findGridPathToSource(feature);
      c.pathToSource = path?.map((f) => f.id);
    }
    return c.pathToSource;
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
        feature.properties._cache = undefined;
        break;
      }
    }
    return [feature.id]
  }

  markChanged(feature: GridFeature) {
    this.featuresChanged.set(feature.id, feature);
  }

  updateCableGeometry(cable: GridCableFeature) {
    cable.properties._cache = undefined;
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
      f.properties._cache = undefined;
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
