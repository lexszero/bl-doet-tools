import type {Layer} from '../LayerInterface';

import PowerAreasData from './data';
import PowerAreasController from './Controller.svelte';

import {IconArea} from '$lib/Icons';

const PowerAreasLayer: Layer<PowerAreasData, PowerAreasController> = {
  id: "power_areas",
  name: "Power areas",
  icon: IconArea,
  order: 20,
  Data: PowerAreasData,
  Controller: PowerAreasController
}

export default PowerAreasLayer;
