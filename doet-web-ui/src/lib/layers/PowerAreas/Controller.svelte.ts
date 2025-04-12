import { getContext } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import type {Polygon} from 'geojson';
import type {PowerAreaFeature, PowerAreaProperties} from '$lib/api';
import type {PowerGridData} from '$lib/layers/PowerGrid/data.svelte';
import { LayerController, type BasicLayerDisplayOptions } from '$lib/layers/LayerController.svelte';

export const defaultPowerAreasDisplayOptions: BasicLayerDisplayOptions = {
  visible: true,
  opacity: 0.3,
};

export class PowerAreasController extends LayerController<
  Polygon,
  PowerAreaProperties
> {
  layerName = 'PowerAreas';
  layerZIndex = 1;

  data: PowerGridData;

  constructor (mapRoot: L.Map) {
    super('PowerAreas', mapRoot);
    this.data = getContext('PowerGridData');
  }

  async load(timeStart?: Date, timeEnd?: Date) {
    this.features = new SvelteMap<string, PowerAreaFeature>(
      (await this.data.api.getPowerAreasGeoJSON(timeStart, timeEnd))?.features.map(
        (f: PowerAreaFeature) => ([f.id, f])
      )
    );
  }

  style = () => ({
    weight: 1,
    color: "#37872D",
    opacity: this.displayOptions.opacity,
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

export default PowerAreasController;
