import type {Layer} from '../LayerInterface';

import {IconFeatureDefault} from '$lib/Icons';
import {MapLayerControls} from '../LayerController.svelte';
import SimpleLayerController, {SimpleLayerData, type SimpleFeature} from './Controller.svelte';

const styleByType: Record<string, L.PathOptions> = {
  'fireroad': {
    weight: 1,
    color: '#6E3800',
    fillOpacity: 0.3,
  },
  'minorroad': {
    weight: 0.7,
    color: '#6e4b00',
    fillOpacity: 0.3,
  }
};

export const RoadsLayer: Layer<SimpleLayerData, SimpleLayerController> = {
  id: "roads",
  name: "Roads",
  icon: IconFeatureDefault,
  order: 5,
  Data: SimpleLayerData,
  Controller: SimpleLayerController,

  ctlOptions: {
    zIndex: 400,
    priorityHighlight: -1,
    prioritySelect: -1,
    controls: MapLayerControls.Full,
    defaultDisplayOptions: {
      visible: true,
      opacity: 0.3,
      types: ['minorroad', 'fireroad']
    },
    style: (f: SimpleFeature) => (
      f ? styleByType[f.properties.type || 'unknown'] : {
        weight: 1,
        color: '#fff',
        fillColor: '#fff',
        fillOpacity: 0.5
      }
    )
  }
}
