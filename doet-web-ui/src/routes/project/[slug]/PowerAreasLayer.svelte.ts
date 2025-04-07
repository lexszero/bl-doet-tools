import type {Polygon} from 'geojson';
import type {PowerAreaFeature, PowerAreaProperties} from '$lib/api';

import { InteractiveLayer } from './InteractiveLayer.svelte';
import { PowerGridLayer } from './PowerGridLayer.svelte';

export class PowerAreasLayer extends InteractiveLayer<
  Polygon,
  PowerAreaProperties
> {
  _grid: PowerGridLayer;

  constructor (grid: PowerGridLayer) {
    super();
    this._grid = grid;
  }

  async load(timeStart?: Date, timeEnd?: Date) {
    this.geojson = await this._grid._api.getPowerAreasGeoJSON(timeStart, timeEnd);
  }

  mode: 'power_need' | 'grid_coverage' = $state('power_need');
  powerNeedThresholds: [number, number] = $state([2000, 10000]);

  style = () => ({
    weight: 1,
    color: "#37872D",
    opacity: 0.3,
    fillOpacity: 0.1
  });
  styleHighlighted = () => ({
    weight: 5,
    color: '#FFFD00',
    fillColor: '#FFFD00',
    opacity: 0.3,
    fillOpacity: 0.5,
  });
  styleSelected = () => ({
    weight: 5,
    color: '#FFFD00',
    fillColor: '#FFFD00',
    opacity: 0.3,
    fillOpacity: 0.3,
  });

  highlightBringsToFront = false;
}
