import {
  API,
  type Feature,
  type GridCableFeature,
  type GridFeature,
  type GridFeatureProperties,
  type GridPDUFeature,
  type GridPDUProperties,
  type PowerGridData,
} from "$lib/api";
import colormap from '$lib/colormap';
import * as geojson from "geojson";
import L from 'leaflet';

import {
  featureChip, 
  InteractiveLayer,
  type InfoItem,
} from './InteractiveLayer.svelte';

import {
  IconFeatureDefault,
  IconPDU,
  IconCable,
  IconRuler,
  IconPower,
  IconResistance,
  IconPlug
} from "./Icons.svelte";
import alarmClockPlus from "@lucide/svelte/icons/alarm-clock-plus";

type GridMapFeatureLayer = L.FeatureGroup<GridFeatureProperties> & {
  feature: Feature<geojson.Point | geojson.LineString, GridFeatureProperties>;
}

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

const gridItemSizes = ['250', '125', '63', '32', '16', '1f'];
const gridItemSizeData = (size: string) => ({
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

const styleGridPath = {
  weight: 5,
  color: '#0151FF',
  fillColor: '#0151FF',
  fillOpacity: 1,
};

const Vref_LL = 400;
const Vref_LN = Vref_LL / Math.sqrt(3);

interface LossCalculationParams {
  loadAmps?: number;
  loadPercentage?: number;
};

interface LossCalculationResult {
  Phases: 3 | 1;
  L: number;
  R: number;
  I: number;
  Vdrop: number;
  VdropPercent: number;
  Ploss: number;
}

export class PowerGridLayer extends InteractiveLayer<
  geojson.Point | geojson.LineString,
  GridFeatureProperties
> {
  _api: API;
  _data?: PowerGridData = $state();

  constructor (api: API) {
    super();
    this._api = api;
    $effect(() => {
      this.updateStyle();
    })
  }

  displayMode: string = $state('processed');
  coloringMode: 'size' | 'loss' = $state('size');
  coloringLossAtLoadLevel: number = $state(50);
  showCoverage: boolean = $state(false);

  allFeatures() {
    return this.features;
  }
  selectFeature(id: string) {
    super.selectFeature(id);
    const layer = this.mapLayers?.get(id);
    this.resetHighlightedFeature(layer)
    this.resetHighlightedPath();
    if (layer) {
      this.highlightGridPathUp(layer);
    }
    //this.layerSelected = undefined;
  }

  async load(timeStart?: Date, timeEnd?: Date) {
    this._data = await this._api.getPowerGridProcessed(timeEnd);
    const features = new Map<string, GridFeature>(this._data.features.features.map((it: GridFeature) => ([it.id, it])));
    for (const f of features.values()) {
      if (f.properties.type == 'power_grid_cable') {
        const props = f.properties;
        if (props.pdu_from) {
          const p = features.get(props.pdu_from)?.properties as GridPDUProperties;
          if (p.cables_out?.indexOf(f.id)) {
            continue;
          }
          if (!p.cables_out) {
            p.cables_out = []
          }
          p.cables_out.push(f.id);
        }
      }
    }
    if (this._data?.log) {
      this._data.log.sort((a, b) => (b.level - a.level));
      for (const entry of (this._data?.log || [])) {
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
    console.log("Loaded data");
    this.geojson = this._data.features;
  }

  style = (feature: GridFeature) => {
    switch (this.coloringMode) {
      case 'size': {
        if (feature.properties.type == 'power_grid_cable') {
          return gridItemSizeData(feature.properties.power_size)?.style;
        }
        break;
      }

      case 'loss': {
        const r = this.calculatePathLoss(
          this.findGridPathToSourceFeatures(feature),
          { loadPercentage: this.coloringLossAtLoadLevel })
        const color = colormap('plasma', r.VdropPercent, 0, 10, false);
        return {...gridItemSizeData(feature.properties.power_size)?.style, color, fillColor: color}
      }
    }
  };

  featureIcon = (feature: GridFeature) => ({
    power_grid_pdu: IconPDU,
    power_grid_cable: IconCable
  }[feature.properties.type] || IconFeatureDefault);

  featureStatus(f: GridFeature) {
    const props = f.properties;
    const maxLevel = (props._drc) ? Math.max(...props._drc.map((r) => (r.level))) : undefined;
    if (maxLevel) {
      return logLevelToColor(maxLevel)
    }
    return (props.type == 'power_grid_pdu') ?
      (props.cable_in ? 'success' : 'warning')
      : ((props.pdu_from && props.pdu_to) ? 'success' : 'warning');
  };

  featureColorForStatus= (f: GridFeature) => `${this.featureStatus(f)}`;
  
  featureProperties = (f: GridFeature) => {
    const exclude = ['name', 'type', 'power_size', 'length_m', 'pdu_from', 'pdu_to', 'cable_in', 'cables_out', '_drc'];
    const result: InfoItem[] = [];
    result.push({
      label: 'Size',
      value: f.properties.power_size,
      icon: IconPlug
    });

    if (f.properties.type == 'power_grid_cable') {
      const props = f.properties;
      if (props.length_m) {
        result.push({
          label: 'Length',
          value: `${this.cableLength(f).toFixed(1)} m`,
          icon: IconRuler
        });
      }
      if (props.pdu_from) {
        const p = this.features.get(props.pdu_from);
        if (p)
          result.push({
            label: 'From',
            icon: IconPDU,
            chips: [{id: p.id, label: p.properties.name}]
          });
      }
      if (props.pdu_to) {
        const p = this.features.get(props.pdu_to);
        result.push({
          label: 'To',
          icon: IconPDU,
          chips: [featureChip(p)]
        });
      }
    }
    else if (f.properties.type == 'power_grid_pdu') {
      const props = f.properties;
      if (props.cable_in) {
        const cableIn = this.features.get(props.cable_in) as GridCableFeature;
        result.push({
          label: 'Feed line',
          icon: IconCable,
          chips: [featureChip(cableIn)]
        });
        const pduFrom = this.features.get(cableIn?.properties.pdu_from) as GridPDUFeature;
        result.push({
          label: 'From PDU',
          icon: IconPDU,
          chips: [featureChip(pduFrom)]
        });
      }
      if (props.cables_out) {
        const pdus = props.cables_out.map(
          (cableId: string) => {
            const c = this.features.get(cableId) as GridCableFeature;
            return this.features.get(c?.properties.pdu_to) as GridPDUFeature;
          });
        //console.log(pdus);
        result.push({
          label: 'To PDUs',
          icon: IconPDU,
          chips: pdus.map((f: GridPDUFeature) => ({id: f.id, label: f.properties.name}))
        })
      }
    }
    return [...result, ...(Object.entries(f.properties)
      .filter(([k]) => (!exclude.includes(k)))
      .map(([k, v]) => ({label: k, value: v} as InfoItem))
      )];
  };

  pointToLayer(feature: GridFeature, latlng: L.LatLng) {
    const style = gridItemSizeData(feature.properties.power_size)?.style;
    return L.circleMarker(latlng, {
      radius: style.weight,
      fillColor: style.color,
      color: style.color,
      weight: 1,
      opacity: 1,
      fillOpacity: 0.8
    });
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

  findGridPathToSourceFeatures(feature: GridFeature): Array<GridFeature> {
    const idNext = this.getGridPreviousId(feature);
    const next = idNext ? this.features?.get(idNext) : undefined;
    //console.log(layer.feature.id, "->", idNext);
    if (next)
      return [feature, ...this.findGridPathToSourceFeatures(next)];
    else 
      return [feature];
  }

  findGridPathToSourceLayers(layer: GridMapFeatureLayer): Array<GridMapFeatureLayer> {
    return this.findGridPathToSourceFeatures(layer.feature).map((f) => this.mapLayers?.get(f.id))
  }


  highlightedGridPath?: Array<GridMapFeatureLayer> = $state();

  isLayerOnHighlightedGridPath(layer: GridMapFeatureLayer) {
    if (!this.highlightedGridPath)
      return false;
    for (const l of this.highlightedGridPath) {
      if (l.feature.id == layer.feature.id) {
        return true;
      }
    }
    return false;
  }

  highlightGridPathUp(layer: GridMapFeatureLayer) {
    const path = this.findGridPathToSourceLayers(layer);
    for (const l of path) {
      if (!(
        (this.layerSelected && this.layerSelected.feature.id == l.feature.id) ||
        (this.layerHighlighted && this.layerHighlighted.feature.id == l.feature.id)
      )) {
        l.setStyle(styleGridPath);
        l.bringToFront();
      }
    }
    this.highlightedGridPath = path;
  }

  resetHighlightedPath() {
    if (!this.highlightedGridPath || !this.mapBaseLayer)
      return;
    for (const l of this.highlightedGridPath) {
      this.mapBaseLayer.resetStyle(l);
    }
    this.highlightedGridPath = undefined;
  }

  cableLength(feature: readonly GridCableFeature): number {
    let length = 0;
    for (let i = 0; i < feature.geometry.coordinates.length - 1; i++) {
      const p1 = feature.geometry.coordinates[i];
      const p2 = feature.geometry.coordinates[i+1];
      length += this.mapRoot?.distance(new L.LatLng(p1[1], p1[0]), new L.LatLng(p2[1], p2[0]));
    }
    return length;
  }

  calculateCableLoss(cable: GridCableFeature, params: LossCalculationParams): LossCalculationResult {
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

  calculatePathLoss(path: Iterable<GridFeature>, params: LossCalculationParams): LossCalculationResult {
    let Length = 0;
    let Resistance = 0;
    let Imax = Infinity;
    let Phases = 3;
    let pathVdrop = 0;
    let pathPloss = 0;

    for (const feature of path) {
      if (feature.properties.type == 'power_grid_cable') {
        const cable = feature as GridCableFeature;
        const sizeData = gridItemSizeData(cable.properties.power_size);
        const { phases, L, R, Vdrop, Ploss } = this.calculateCableLoss(cable, params)
        Phases = phases < Phases ? phases : Phases;
        Length += L;
        Resistance += R;

        const cableImax = sizeData.max_amps;
        if (cableImax < Imax)
          Imax = cableImax;

        pathVdrop += Vdrop;
        pathPloss += Ploss;
      }
    }

    return {
      Phases,
      L: Length,
      R: Resistance,
      I: Imax,
      Vdrop: pathVdrop / Math.sqrt(3),
      VdropPercent: pathVdrop / Vref_LL / Math.sqrt(3) * 100.0,
      Ploss: pathPloss
    };

  }

  getHighlightedPathInfo(): Array<InfoItem> {
    const loadLevels = [100, 75, 50];
    const result: Array<InfoItem> = [];

    const path = this.highlightedGridPath?.map((l) => this.features.get(l.feature.id)) || [];
    const pathResult = this.calculatePathLoss(path,
      { loadAmps: Math.min(...path.map((f) => gridItemSizeData(f.properties.power_size).max_amps)) }
    );

    const allResults = [
      ...loadLevels.map((loadPercentage) => [
        `${loadPercentage}%`,
        this.calculatePathLoss(path, { loadPercentage })
      ]),
      [ 'path', pathResult ]
    ] as Array<[string, LossCalculationResult]>;

    result.push({
      label: "Path length",
      value: `${pathResult.L.toFixed(1)} m`,
      icon: IconRuler
    },
    {
      label: "Resistance",
      value: `${pathResult.R.toFixed(2)} Ω`,
      icon: IconResistance
    },
    {
      label: "Pmax",
      value: `${(pathResult.I*Vref_LN*3/1000).toFixed(1)} kW`,
      icon: IconPower
    },
    {
      label: "Imax",
      value: `${(pathResult.I).toFixed(1)} A`,
      icon: IconPower
    }

    );

    for (const [label, r] of allResults) {
      result.push(
        {
          label: `Loss @ ${label}`,
          value: `${r.Vdrop.toFixed(1)} V (${r.VdropPercent.toFixed(0)}%), ${(r.Ploss/1000.0).toFixed(1)} kW`,
          classes: (
            (r.VdropPercent < 5) ? ""
            : (r.VdropPercent < 10) ? "text-warning-500"
            : "text-error-500"
          )
        },
      );
    }

    return result;
  }

  resetHighlightedFeature(layer?: Layer) {
    if (!layer) {
      layer = this.layerHighlighted;
    }
    if (this.isLayerOnHighlightedGridPath(layer)) {
      console.log(`Feature ${layer.feature.id}: highlighted -> selected`)
      layer.setStyle((layer.feature.id == this.layerSelected.feature.id) ?
        this.styleSelected : styleGridPath);
      this.layerHighlighted = undefined;
    } else {
      super.resetHighlightedFeature(layer);
    }
  }

  getStatistics(): InfoItem[] {
    const result: InfoItem[] = [];
    const totalCableLength = new Map(gridItemSizes.map((size) => [size, 0]));
    let totalAllCableLength = 0;
    for (const f of this.features.values()) {
      if (f.properties.type == 'power_grid_cable') {
        const size = f.properties.power_size;
        const length = this.cableLength(f);
        totalCableLength.set(size, (totalCableLength.get(size) || 0) + length);
        totalAllCableLength += length;
      }
    }

      result.push({
        label: `Total cable length`,
        value: `${totalAllCableLength.toFixed(0)} m`,
        icon: IconRuler
      });

    for (const [size, length] of totalCableLength.entries()) {
      if (length) {
        result.push({
          label: `${size}A length`,
          value: `${length.toFixed(0)} m`,
          icon: IconRuler
        });
      }
    }
    return result;
  }
}
