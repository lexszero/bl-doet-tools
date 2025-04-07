import {
  API,
  type Feature,
  type GridCableFeature,
  type GridFeature,
  type GridFeatureProperties,
  type GridPDUFeature,
  type PowerGridData,
} from "$lib/api";
import L from 'leaflet';
import * as geojson from "geojson";

import { InteractiveLayer, type InfoItem } from './InteractiveLayer.svelte';
import {
  IconFeatureDefault,
  IconPDU,
  IconCable,
  IconRuler,
  IconPower,
  IconResistance,
  IconPlug
} from "./Icons.svelte";

type GridMapFeatureLayer = L.FeatureGroup<GridFeatureProperties> & {
  feature: Feature<geojson.Point | geojson.LineString, GridFeatureProperties>;
}

interface StyleWeightColor {
  weight: number;
  color: string;
}

interface GridItemSizeData {
  phases: number;
  max_amps: number;
  ohm_per_km: number;
  style: StyleWeightColor;
}

export const logLevelToColor = (level: number) => (
  (level >= 40) ? 'error'
  : (level >= 30) ? 'warning'
    : (level >= 20) ? 'success'
      : 'surface');

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

export class PowerGridLayer extends InteractiveLayer<
  geojson.Point | geojson.LineString,
  GridFeatureProperties
> {
  _api: API;
  _data?: PowerGridData = $state();

  constructor (api: API) {
    super();
    this._api = api;
  }

  displayMode: string = $state('processed');

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
          else {
            console.log(`No props for ${entry.item_id}`);
          }
        }
      }
    }
    console.log("Loaded data");
    this.geojson = this._data.features;
  }

  style = (feature: GridFeature) => {
    if (feature.properties.type == 'power_grid_cable') {
      return gridItemSizeData(feature.properties.power_size)?.style;
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
  }
  featureColorForStatus(f: GridFeature) {
    return `${this.featureStatus(f)}`;
  }
  featureProperties = (f: GridFeature) => {
    const exclude = ['name', 'type', 'power_size', 'length_m', 'pdu_from', 'pdu_to', 'cable_in', 'cables_out', '_drc'];
    const props = f.properties;
    let result = [];
    result.push({
      label: 'Size',
      value: props.power_size,
      icon: IconPlug
    });

    if (props.type == 'power_grid_cable') {
      if (props.length_m) {
        result.push({
          label: 'Length',
          value: `${props.length_m} m`,
          icon: IconRuler
        });
      }
      if (props.pdu_from) {
        result.push({
          label: 'From',
          value: `${this.features.get(props.pdu_from)?.properties.name}`,
          icon: IconPDU,
          selectId: props.pdu_from
        });
      }
      if (props.pdu_to) {
        result.push({
          label: 'To',
          value: `${this.features.get(props.pdu_to)?.properties.name}`,
          icon: IconPDU,
          selectId: props.pdu_from
        });
      }
    }
    else if (props.type == 'power_grid_pdu') {
      if (props.cable_in) {
        const cableIn = this.features.get(props.cable_in) as GridCableFeature;
        const pduFrom = this.features.get(cableIn?.properties.pdu_from) as GridPDUFeature;
        result.push({
          label: 'Feed line',
          value: `${cableIn.properties.name}`,
          icon: IconCable,
          selectId: props.cable_in
        });
        result.push({
          label: 'From',
          value: `${pduFrom.properties.name}`,
          icon: IconPDU,
          selectId: pduFrom.id
        });
      }
    }
    return [...result, ...(Object.entries(props)
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

  findGridPathToSource(layer: GridMapFeatureLayer): Array<GridMapFeatureLayer> {
    const feature = layer.feature as GridFeature;
    const idNext = this.getGridPreviousId(feature);
    if (idNext)
      return [layer, ...this.findGridPathToSource(this.mapLayers?.get(idNext))];
    else 
      return [layer];
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
    const path = this.findGridPathToSource(layer);
    for (const l of path) {
      l.setStyle(styleGridPath);
      l.bringToFront();
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

  getHighlightedPathInfo(): Array<InfoItem> {
    const loadLevels = [100, 75, 50];
    const result: Array<InfoItem> = [];

    let totalLength = 0;
    let totalResistance = 0;
    const totalVdrop = [0, 0, 0]
    const totalPloss = [0, 0, 0]
    let pathPmax = Infinity;

    const Vref = 400;

    const cables = this.highlightedGridPath?.filter((l) => (l.feature.properties.type == 'power_grid_cable'));
    for (const l of cables || []) {
      const sizeData = gridItemSizeData(l.feature.properties.power_size);
      const length = l.feature.properties.length_m || 0;
      const R = length * sizeData.ohm_per_km / 1000.0;
      totalLength += length;
      totalResistance += R;

      const Pmax = (sizeData.phases == 3) ?
        (3 * Vref * sizeData.max_amps) : (Vref * sizeData.max_amps);
      if (Pmax < pathPmax)
        pathPmax = Pmax;

      for (const [i, loadLevel] of loadLevels.entries()) {
        const I = sizeData.max_amps * loadLevel / 100.0;
        const Vdrop = 
          (sizeData.phases == 3) ?
          (R * I * Math.sqrt(3)) :
          (R * I * 2);
        totalVdrop[i] += Vdrop;
        totalPloss[i] += Vdrop * I;
      }
    }

    result.push({
      label: "Length",
      value: `${totalLength.toFixed(1)} m`,
      icon: IconRuler
    },
    {
      label: "Resistance",
      value: `${totalResistance.toFixed(2)} Ω`,
      icon: IconResistance
    },
    {
      label: "Pmax",
      value: `${(pathPmax/1000).toFixed(1)} kW`,
      icon: IconPower
    }
    );

    for (const [i, loadLevel] of loadLevels.entries()) {
      const Vdrop = totalVdrop[i];
      const Ploss = totalPloss[i];
      const VdropPercent = Vdrop / Vref * loadLevel;
      result.push(
        {
          label: `Loss @ ${loadLevel}%`,
          value: `${Vdrop.toFixed(1)} V (${VdropPercent.toFixed(0)}%), ${(Ploss/1000.0).toFixed(1)} kW`,
          classes: (
            (VdropPercent < 5) ? ""
            : (VdropPercent < 10) ? "text-warning-500"
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
      layer.setStyle(styleGridPath);
      this.layerHighlighted = undefined;
    }
    else {
      super.resetHighlightedFeature(layer);
    }
  }
}
