import { getContext } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import geojson from 'geojson';
import L from "leaflet";

import type {PlacementFeature, PlacementEntityProperties, GridCableFeature, GridPDUFeature} from '$lib/api';
import colormap from '$lib/utils/colormap';
import { distance, coordsToLatLng, coordsToLatLngs } from '$lib/utils/geo';

import { featureChip, LayerController, type InfoItem } from '$lib/layers/LayerController.svelte';
import { IconPlacementEntity, IconPDU, IconPower, IconSound } from '$lib/Icons';
import {
  BadgeInfo as IconDescription,
  Contact as IconContact,
  PersonStanding as IconPeople,
  Bus as IconVehicle
} from '@lucide/svelte';

import { PowerGridData } from '$lib/layers/PowerGrid/data.svelte';
import { type PlacementDisplayOptions } from './types';

const defaultStyle = {
  weight: 0.5,
  opacity: 0.5,
  fillOpacity: 0.6
};

export class PlacementController extends LayerController<
  geojson.Polygon,
  PlacementEntityProperties
> {
  layerName = 'Placement';
  layerZIndex = 2;

  data: PowerGridData;

  constructor (mapRoot: L.Map) {
    super(mapRoot);
    this.data = getContext('PowerGridData');
    $effect(() => {
      this.updateStyle();
    })
  }

  async load(timeStart?: Date, timeEnd?: Date) {
    const data = await this.data.api.getPlacementEntitiesGeoJSON(timeStart, timeEnd);
    for (const feature of data.features) {
      feature.properties._nearPDUs = this.findNearPDUs(feature);
    }
    this.features = new SvelteMap<string, PlacementFeature>(data.features.map(
      (f: PlacementFeature) => ([f.id, f])
    ));
  }

  displayOptions: PlacementDisplayOptions = $state({
    visible: true,
    opacity: 0.5,
    mode: 'power_need',
    powerNeedThresholds: [2000, 10000],
    pduSearchRadius: 50
  });

  style = (f: PlacementFeature): L.PathOptions => {
    let color = '#303030';
    const power = f.properties.powerNeed;
    if (power) {
      switch (this.displayOptions.mode) {
        case 'power_need': {
          const [lowPower, highPower] = this.displayOptions.powerNeedThresholds;
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
            const [, d] = near[0];
            color = colormap('plasma', d, 5, this.displayOptions.pduSearchRadius, false);
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
              ...this.data.getGridPathToSource(pdu) || [],
              { properties: {
                power_size: '1f',
                length_m: d
              }} as GridCableFeature
            ];
            const loss = this.data.calculatePathLoss(path);
            color = colormap('plasma', loss.R, 0, 1.0);
          } else {
            color = '#ff0000'
          }
          break;
        }

        case 'sound': {
          if (f.properties.amplifiedSound) {
            color = colormap('plasma', f.properties.amplifiedSound, 0, 5000);
          }
          break;
        }
      }
    }
    return {...defaultStyle,
      opacity: this.displayOptions.opacity,
      color,
      fillColor: color
    }
  };
  highlightBringsToFront = false;

  featureIcon = () => IconPlacementEntity;
  featureLabel = (f: PlacementFeature) => `${f.properties.name} (${f.id})`;
  featureProperties = (f: PlacementFeature) => {
    const props = f.properties;
    const result: InfoItem[] = [];

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
      .filter(([k]) => (!exclude.includes(k)))
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
    const pdusInRange = [];
    const itemCenter = L.PolyUtil.centroid(coordsToLatLngs(feature.geometry.coordinates[0]));
    for (const item of this.data.features.values()) {
      if (item.properties.type != 'power_grid_pdu') {
        continue;
      }
      const pdu = item as GridPDUFeature;
      const d = distance(itemCenter, coordsToLatLng(pdu.geometry.coordinates)) || Infinity;
      if (d < this.displayOptions.pduSearchRadius) {
        pdusInRange.push([pdu, d] as [GridPDUFeature, number]);
      }
    }
    pdusInRange.sort(([, ad], [, bd]) => (ad - bd));
    return pdusInRange;
  }

};

export default PlacementController;
