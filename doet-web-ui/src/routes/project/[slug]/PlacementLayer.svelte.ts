import type {Polygon} from 'geojson';
import * as L from "leaflet";

import type {PlacementFeature, PlacementEntityProperties} from '$lib/api';
import colormap from '$lib/colormap';

import { InteractiveLayer } from './InteractiveLayer.svelte';
import { PowerGridLayer } from './PowerGridLayer.svelte';

const defaultStyle = {
  weight: 0.5,
  opacity: 0.5,
  fillOpacity: 0.6
};

const styleFuncs = {
  power_need: (params: PlacementLayer, feature: PlacementFeature) => {
    const power = feature.properties.powerNeed;
    const color = (!power) ?
      '#000' :
      (power < params.powerNeedThresholds[0]) ?
      colormap('winter', power, 0, params.powerNeedThresholds[0]*1.25, true) :
      colormap('plasma', power, 0, params.powerNeedThresholds[1]);
    return {...defaultStyle, color, fillColor: color};
  },
  grid_coverage: (params: PlacementLayer, feature: PlacementFeature) => {
    let nr_pdus = 0;
    let color = '#000';
    if (feature.properties.powerNeed) {
      nr_pdus = params.findNearestPDUs(feature);
      color = colormap('plasma', nr_pdus, 0, 5, true);
    }
    return {...defaultStyle, color, fillColor: color}
  },
};

export class PlacementLayer extends InteractiveLayer<
  Polygon,
  PlacementEntityProperties
> {
  _grid: PowerGridLayer;

  constructor (grid: PowerGridLayer) {
    super();
    this._grid = grid;
    $effect(() => {
      this.mapBaseLayer?.setStyle((f: PlacementFeature) => styleFuncs[this.mode](this, f));
    })
  }

  async load(timeStart?: Date, timeEnd?: Date) {
    this.geojson = await this._grid._api.getPlacementEntitiesGeoJSON(timeStart, timeEnd);
  }

  mode: 'power_need' | 'grid_coverage' = $state('power_need');
  powerNeedThresholds: [number, number] = $state([2000, 10000]);
  pduSearchRadius: number = $state(100);

  style = (f: PlacementFeature) => styleFuncs[this.mode](this, f);

  findNearestPDUs(feature: PlacementFeature) {
    let n = 0;
    let nearestDistance = 9999999;
    let nearestPDU = null;
    const itemCenter = L.PolyUtil.centroid(feature.geometry.coordinates[0])
    for (const item of this._grid.features.values()) {
      if (item.properties.type != 'power_grid_pdu') {
        continue;
      }
      const distance = this.mapRoot?.distance(itemCenter, item.geometry.coordinates);
      if (distance < this.pduSearchRadius) {
        n++;
      }
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestPDU = item.id;
      }
    }
    if (nearestPDU) {
      feature.properties.nearest_pdu_distance = Math.round(nearestDistance);
      feature.properties.nearest_pdu_id = nearestPDU;
    }
    return n;
  }

};
