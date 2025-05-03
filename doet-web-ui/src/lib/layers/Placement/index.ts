import type {Layer} from '../LayerInterface';

import PlacementData from './data';
import PlacementController from './Controller.svelte';

import {IconPlacement} from '$lib/Icons';

const PlacementLayer: Layer<PlacementData, PlacementController> = {
  id: "placement",
  name: "Placement",
  icon: IconPlacement,
  order: 10,

  Data: PlacementData,
  Controller: PlacementController
}

export default PlacementLayer;
