import type {Polygon} from 'geojson';
import * as L from "leaflet";


import type {PlacementFeature, PlacementEntityProperties, GridPDUFeature} from '$lib/api';
import colormap from '$lib/colormap';

import { InteractiveLayer, type InfoItem } from './InteractiveLayer.svelte';
import { PowerGridLayer } from './PowerGridLayer.svelte';
import { IconPlacementEntity, IconPDU, IconRuler, IconPower } from './Icons.svelte';

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
    let color = '#000';
    if (feature.properties.powerNeed) {
      const [n, pdu] = params.findNearestPDUs(feature);
      color = colormap('plasma', n, 0, 5, true);
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
    const data = await this._grid._api.getPlacementEntitiesGeoJSON(timeStart, timeEnd);
    for (const feature of data.features) {
      const [n, pdu] = this.findNearestPDUs(feature);
      if (pdu) {
        feature.properties._nearestPduId = pdu.id;
      }
    }
    this.geojson = data;
  }

  mode: 'power_need' | 'grid_coverage' = $state('power_need');
  powerNeedThresholds: [number, number] = $state([2000, 10000]);
  pduSearchRadius: number = $state(100);

  style = (f: PlacementFeature) => styleFuncs[this.mode](this, f);
  featureIcon = (f: PlacementFeature) => IconPlacementEntity;

  featureLabel = (f: PlacementFeature) => `${f.properties.name} (${f.id})`;
  featureProperties = (f: PlacementFeature) => {
    const exclude = ['name', 'type', '_nearestPduId', 'powerNeed'];
    const props = f.properties;
    const result = (Object.entries(props)
      .filter(([k, v]) => (!exclude.includes(k)))
      .map(([k, v]) => ({label: k, value: v} as InfoItem))
      )

    result.push({
      label: 'Power need',
      value: props.powerNeed,
      icon: IconPower
    });

    const pduId = props._nearestPduId;
    const pdu = pduId ? this._grid.features.get(pduId) : this.findNearestPDUs(f)[1];
    if (pdu) {
      result.push({
        label: "Nearest PDU",
        value: pdu.properties.name,
        icon: IconPDU,
        chips: [{id: pdu.id, label: pdu.properties.name}]
      });
    }

    return result;
  };

  findNearestPDUs(feature: PlacementFeature): [number, GridPDUFeature | null] {
    let n = 0;
    let nearestDistance = 9999999;
    let nearestPDU = null;
    const itemCenter = L.PolyUtil.centroid(feature.geometry.coordinates[0])
    for (const item of this._grid.features.values()) {
      if (item.properties.type != 'power_grid_pdu') {
        continue;
      }
      const pdu = item as GridPDUFeature;
      const distance = this.mapRoot?.distance(itemCenter, pdu.geometry.coordinates) || Infinity;
      if (distance < this.pduSearchRadius) {
        n++;
      }
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestPDU = pdu;
      }
    }
    return [n, nearestPDU];
    /*
    if (nearestPDU) {
      feature.properties._nearestPduDistance = Math.round(nearestDistance);
      feature.properties._nearestPduId = nearestPDU;
    }
    return n;
    */
  }

};
