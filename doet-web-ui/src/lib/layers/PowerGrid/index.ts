import type {Layer} from '../LayerInterface';

import PowerGridData from './data.svelte';
import PowerGridController from './Controller.svelte';

import {IconPower} from '$lib/Icons';

const PowerGridLayer: Layer<PowerGridData, PowerGridController> = {
  id: "power_grid",
  name: "Power grid",
  icon: IconPower,
  order: 20,

  Data: PowerGridData,
  Controller: PowerGridController,
}

export default PowerGridLayer;
