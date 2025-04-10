import { SvelteMap } from 'svelte/reactivity';
import geojson from 'geojson';
import L from "leaflet";

import type {PlacementFeature, PlacementEntityProperties, GridCableFeature, GridPDUFeature} from '$lib/api';
import colormap from '$lib/colormap';
import { distance } from '$lib/utils';

import { featureChip, InteractiveLayer, type InfoItem } from './InteractiveLayer.svelte';
import { PowerGridLayer } from './PowerGridLayer.svelte';
import { IconPlacementEntity, IconPDU, IconRuler, IconPower } from './Icons.svelte';
import {
  BadgeInfo as IconDescription,
  Contact as IconContact,
  Volume2 as IconSound,
  PersonStanding as IconPeople,
  Bus as IconVehicle
} from '@lucide/svelte';

const defaultStyle = {
  weight: 0.5,
  opacity: 0.5,
  fillOpacity: 0.6
};

export class PlacementLayer extends InteractiveLayer<
  geojson.Polygon,
  PlacementEntityProperties
> {
  _grid: PowerGridLayer;

  constructor (grid: PowerGridLayer) {
    super();
    this._grid = grid;
    $effect(() => {
    })
    $effect(() => {
      this.mapBaseLayer?.setZIndex(-1000);
      this.updateStyle();
    })
  }

  async load(timeStart?: Date, timeEnd?: Date) {
    const data = await this._grid.data.api.getPlacementEntitiesGeoJSON(timeStart, timeEnd);
    for (const feature of data.features) {
      feature.properties._nearPDUs = this.findNearPDUs(feature);
    }
    this.features = new SvelteMap<string, PlacementFeature>(data.features.map(
      (f: PlacementFeature) => ([f.id, f])
    ));
  }

  mode: 'power_need' | 'grid_n_pdus' | 'grid_distance' | 'grid_loss' = $state('power_need');
  powerNeedThresholds: [number, number] = $state([2000, 10000]);
  pduSearchRadius: number = $state(50);

  style = (f: PlacementFeature): L.PathOptions => {
    let color = '#303030';
    const power = f.properties.powerNeed;
    if (power) {
      switch (this.mode) {
        case 'power_need': {
          const [lowPower, highPower] = this.powerNeedThresholds;
          color = (
            (power < lowPower)
            ? colormap('winter', power, 0, lowPower*1.25, true)
            : colormap('plasma', power, 0, highPower)
          );
          break;
        }

        case 'grid_n_pdus': {
          color = colormap('plasma', this.getNearPDUs(f).length, 0, 5, true);
          break;
        }

        case 'grid_distance': {
          const near = this.getNearPDUs(f);
          if (near.length) {
            const [pdu, d] = near[0];
            color = colormap('plasma', d, 5, this.pduSearchRadius, false);
          } else {
            color = '#ff0000';
          }
          break;
        }

        case 'grid_loss': {
          const near = this.getNearPDUs(f);
          if (near.length) {
            const [pdu, d] = near[0];
            const path = [
              ...this._grid.data.getGridPathToSource(pdu) || [],
              { properties: {
                power_size: '1f',
                length_m: d
              }} as GridCableFeature
            ];
            const loss = this._grid.data.calculatePathLoss(path);
            color = colormap('plasma', loss.R, 0, 1.0);
          } else {
            color = '#ff0000'
          }
        }
      }
    }
    return {...defaultStyle, color, fillColor: color}
  };
  highlightBringsToFront = false;

  featureIcon = () => IconPlacementEntity;
  featureLabel = (f: PlacementFeature) => `${f.properties.name} (${f.id})`;
  featureProperties = (f: PlacementFeature) => {
    const props = f.properties;
    const result = [];

    if (props.description) {
      result.push({
        label: 'Description',
        value: props.description,
        icon: IconDescription
      });
    }

    if (props.contactInfo) {
      result.push({
        label: 'Contact',
        value: props.contactInfo,
        icon: IconContact
      });
    }

    if (props.nrOfPeople) {
      result.push({
        label: '# people',
        value: props.nrOfPeople,
        icon: IconPeople
      });
    }

    if (props.nrOfVechiles) {
      result.push({
        label: '# vehicles',
        value: props.nrOfVechiles,
        icon: IconVehicle
      });
    }

    if ((props.amplifiedSound || 0)> 0) {
      result.push({
        label: 'Sound',
        value: props.amplifiedSound,
        icon: IconSound
      });
    }

    result.push({
      label: 'Power need',
      value: props.powerNeed,
      icon: IconPower
    });


    const near = this.getNearPDUs(f);
    //console.log(nearestPDU, nearestDistance);
    if (near?.length) {
      const [nearestPDU, nearestDistance] = near[0];
      result.push({
        label: "Nearest PDU",
        value: `${nearestDistance.toFixed(0)} m`,
        icon: IconPDU,
        chips: [featureChip(nearestPDU)]
      });
    }

    const exclude = ['type', 'name', 'description', 'contactInfo', 'nrOfPeople', 'nrOfVechiles', 'powerNeed', 'amplifiedSound', '_nearPDUs'];
    return [...result, ...(Object.entries(props)
      .filter(([k, v]) => (!exclude.includes(k)))
      .map(([k, v]) => ({label: k, value: v} as InfoItem))
    )]
  };

  getNearPDUs(feature: PlacementFeature): [GridPDUFeature, number][] {
    if (!feature.properties._nearPDUs?.length) {
      feature.properties._nearPDUs = this.findNearPDUs(feature);
    }
    return feature.properties._nearPDUs;
  }

  findNearPDUs(feature: PlacementFeature): [GridPDUFeature, number][] {
    let pdusInRange = [];
    const itemCenter = L.PolyUtil.centroid(L.GeoJSON.coordsToLatLngs(feature.geometry.coordinates[0]));
    for (const item of this._grid.features.values()) {
      if (item.properties.type != 'power_grid_pdu') {
        continue;
      }
      const pdu = item as GridPDUFeature;
      const d = distance(itemCenter, L.GeoJSON.coordsToLatLng(pdu.geometry.coordinates)) || Infinity;
      if (d < this.pduSearchRadius) {
        pdusInRange.push([pdu, d] as [GridPDUFeature, number]);
      }
    }
    pdusInRange.sort(([ap, ad], [bp, bd]) => (bd - bp));
    return pdusInRange;
  }

};
