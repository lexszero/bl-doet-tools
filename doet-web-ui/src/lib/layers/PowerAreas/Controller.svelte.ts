import { getContext } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import type {Polygon} from 'geojson';
import type {PowerAreaFeature, PowerAreaProperties, PowerAreasDisplayOptions} from './types';
import type {PowerGridData} from '$lib/layers/PowerGrid/data.svelte';
import { LayerController, type LayerControllerOptions } from '$lib/layers/LayerController.svelte';
import type {FeaturesDataElement} from '$lib/api_project';

export class PowerAreasController extends LayerController<
  Polygon,
  PowerAreaProperties
> {
  layerName = 'PowerAreas';
  layerZIndex = 1;

  data: PowerGridData;

  constructor (mapRoot: L.Map, options: LayerControllerOptions<PowerAreasDisplayOptions>) {
    super(mapRoot, {
      name: 'PowerAreas',
      zIndex: 405,
      defaultDisplayOptions: {
        visible: true,
        opacity: 0.3,
      },
      ...options
    });
    this.data = getContext('PowerGridData');
  }

  async load(timeStart?: Date, timeEnd?: Date) {
    const data = await this.data.api.getDataViewElement<FeaturesDataElement<PowerAreaFeature>>('power_areas', timeStart, timeEnd);
    this.features = new SvelteMap<string, PowerAreaFeature>(
      data.features.map(
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
  styleHighlighted = {
    weight: 5,
    color: '#FFFD00',
    fillColor: '#FFFD00',
    opacity: 0.3,
    fillOpacity: 0.5,
  };
  styleSelected = {
    weight: 5,
    color: '#FFFD00',
    fillColor: '#FFFD00',
    opacity: 0.3,
    fillOpacity: 0.3,
  };

  highlightBringsToFront = false;
}

export default PowerAreasController;
