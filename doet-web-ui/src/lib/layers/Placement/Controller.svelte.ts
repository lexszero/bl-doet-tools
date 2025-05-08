import geojson from 'geojson';
import L from "leaflet";

import colormap from '$lib/utils/colormap';
import { type InfoItem } from '$lib/utils/types';

import { LayerController, MapLayerControls, type LayerControllerOptions } from '$lib/layers/LayerController.svelte';

import { IconContact, IconDescription, IconPower, IconSound, IconPeople, IconPlacementEntity } from '$lib/Icons';
import IconVehicle from '@lucide/svelte/icons/bus';

import type PlacementData from './data';
import type { PlacementFeature, PlacementEntityProperties, PlacementDisplayOptions } from './types';
import DisplayOptions from './DisplayOptions.svelte';
import FeatureDetails from './FeatureDetails.svelte';

import { calculatePathLoss } from '../PowerGrid/calculations';
import type { GridCableFeature } from '../PowerGrid/types';

const defaultStyle = {
  weight: 0.5,
  fillOpacity: 0.6
};

export class PlacementController extends LayerController<
  geojson.Polygon,
  PlacementEntityProperties,
  PlacementDisplayOptions
> {
  DisplayOptionsComponent = DisplayOptions;
  FeatureDetailsComponent = FeatureDetails;

  declare data: PlacementData;
  constructor (mapRoot: L.Map, data: PlacementData, options: LayerControllerOptions<PlacementDisplayOptions>) {
    super(mapRoot, data, {
      ...options,
      zIndex: 410,
      priorityHighlight: 20,
      prioritySelect: 40,
      controls: MapLayerControls.Full,
      defaultDisplayOptions: {
        visible: true,
        opacity: 0.5,
        mode: 'power_need',
        powerNeedThresholds: [2000, 10000],
        pduSearchRadius: 50,
        gridLoadPercent: 50,
        soundMax: 5000
      },
    });

    $effect(() => {
      if (this.features &&
        (
          this.displayOptions.mode === 'grid_n_pdus' ||
          this.displayOptions.mode === 'grid_distance'
        ) &&
        this.displayOptions.pduSearchRadius) {
          this.data.updateCache();
      }
    })
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
          color = colormap('plasma', this.data.getNearPDUs(f).length, 0, 5, true);
          break;
        }

        case 'grid_distance': {
          const near = this.data.getNearPDUs(f);
          if (near?.length) {
            const [, d] = near[0];
            color = colormap('plasma', d, 5, this.displayOptions.pduSearchRadius, false);
          } else {
            color = '#ff0000';
          }
          break;
        }

        case 'grid_loss': {
          const near = this.data.getNearPDUs(f);
          if (near.length) {
            const [pdu, d] = near[0];
            const path = [
              ...this.data.project.layers.power_grid?.getGridPathToSource(pdu) || [],
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
      '_cache',
    ];
    return [...result, ...(Object.entries(props)
      .filter(([k]) => (!exclude.includes(k)))
      .map(([k, v]) => ({label: k, value: v} as InfoItem))
    )]
  };

};

export default PlacementController;
