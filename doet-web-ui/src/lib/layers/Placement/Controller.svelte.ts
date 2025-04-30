import { getContext } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import geojson from 'geojson';
import L from "leaflet";

import type {PlacementFeature, PlacementEntityProperties} from './types';
import colormap from '$lib/utils/colormap';
import { distance, coordsToLatLng, coordsToLatLngs } from '$lib/utils/geo';

import { LayerController, type LayerControllerOptions } from '$lib/layers/LayerController.svelte';
import { IconContact, IconDescription, IconPlacementEntity, IconPDU, IconPower, IconSound, IconPeople } from '$lib/Icons';
import IconVehicle from '@lucide/svelte/icons/bus';

import { PowerGridData } from '$lib/layers/PowerGrid/data.svelte';
import { type PlacementDisplayOptions } from './types';

import { type InfoItem } from '$lib/utils/types';
import type {FeaturesDataElement} from '$lib/api_project';
import { calculatePathLoss } from '../PowerGrid/calculations';
import { getPlugTypeInfo, Vref_LN } from '../PowerGrid/constants';
import type { GridCableFeature, GridPDUFeature } from '../PowerGrid/types';
import {Severity, type ItemLogEntry} from '$lib/utils/misc';

export function plugLoadPercent(feature: PlacementFeature) {
  const props = feature.properties;
  if (!props.powerPlugType)
    return Infinity;

  const plug = getPlugTypeInfo(props.powerPlugType)
  const plugPmax = Vref_LN * plug.max_amps * plug.phases;
  return (feature.properties.powerNeed || 0) / plugPmax * 100;
}

const defaultStyle = {
  weight: 0.5,
  fillOpacity: 0.6
};

export class PlacementController extends LayerController<
  geojson.Polygon,
  PlacementEntityProperties,
  PlacementDisplayOptions
> {
  layerName = 'Placement';

  data: PowerGridData;

  constructor (mapRoot: L.Map, options: LayerControllerOptions<PlacementDisplayOptions>) {
    super(mapRoot, {
      name: 'Placement',
      zIndex: 410,
      defaultDisplayOptions: {
        visible: true,
        opacity: 0.5,
        mode: 'power_need',
        powerNeedThresholds: [2000, 10000],
        pduSearchRadius: 50,
        gridLoadPercent: 50,
        soundMax: 5000
      },
      ...options
    });

    this.data = getContext('PowerGridData');
    $effect(() => {
      this.updateStyle();
    })

    $effect(() => {
      if (this.features &&
        this.displayOptions.mode == 'grid_n_pdus' &&
        this.displayOptions.pduSearchRadius) {
        for (const f of this.features.values()) {
          f.properties._nearPDUs = undefined;
        }
      }
    })
  }

  async load(timeStart?: Date, timeEnd?: Date) {
    const data = await this.data.api.getDataViewElement<FeaturesDataElement<PlacementFeature>>('placement', timeStart, timeEnd);
    for (const feature of data.features) {
      feature.properties._nearPDUs = this.findNearPDUs(feature);
    }
    this.features = new SvelteMap<string, PlacementFeature>(data.features.map(
      (f: PlacementFeature) => ([f.id, f])
    ));
  }

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
          if (near?.length) {
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
            const loss = calculatePathLoss(path, {loadPercentage: this.displayOptions.gridLoadPercent});
            color = colormap('plasma', loss.R, 0, 1.0);
          } else {
            color = '#ff0000'
          }
          break;
        }

        case 'sound': {
          if (f.properties.amplifiedSound) {
            color = colormap('plasma', f.properties.amplifiedSound || 0, 0, this.displayOptions.soundMax);
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

    const exclude = [
      'type', 'name', 'description', 'contactInfo', 'nrOfPeople', 'nrOfVechiles', 'amplifiedSound', 'color',
      'powerNrPDUs', 'powerDistance',
      'techContactInfo', 'powerPlugType', 'powerExtraInfo', 'powerImage', 'powerAppliances', 'powerNeed',
      '_nearPDUs',
    ];
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

  featureWarnings(feature: PlacementFeature, strict: boolean = false) {
    const result: ItemLogEntry[] = [];
    const props = feature.properties;
    const pwr = feature.properties.powerNeed

    if (!pwr)
      return result;

    if (strict) {
      if (props.powerPlugType) {
        const loadPercent = plugLoadPercent(feature);
        if (loadPercent > 100) {
          result.push({
            level: loadPercent > 300 ? Severity.Error : Severity.Warning,
            message: `Power need ${pwr} is ${loadPercent}% load permitted for ${props.powerPlugType}`
          });
        }
      } else {
        result.push({
          level: Severity.Error,
          message: "Missing power plug type"
        });
      }

      if (!props.techContactInfo) {
        result.push({
          level: Severity.Error,
          message: "Missing tech contact info"
        });
      }
    }

    const near = this.getNearPDUs(feature);
    if (!near.length) {
      result.push({
        level: Severity.Error,
        message: `No PDUs within ${this.displayOptions.pduSearchRadius}m radius`
      })
    }
    return result;
  }
};

export default PlacementController;
