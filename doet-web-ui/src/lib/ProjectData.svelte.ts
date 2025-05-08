import {getContext} from 'svelte';

import { parseJSON as parseTimestamp } from 'date-fns';
import type {Feature} from './utils/geojson';
import type {Geometry} from 'geojson';

import type {MapOptions, ProjectAPI} from './api_project';

import {LayerTemplates, LayerTemplatesOrdered, type AnyLayerController, type AnyLayerData, type LayerID, type LayersData} from './layers/Layers';
import type {Props} from './layers/LayerData.svelte';
import type {BasicLayerDisplayOptions, LayerControllerOptions, MapFeatureLayer} from './layers/LayerController.svelte';

function getID(item: string | Feature<Geometry, object> | MapFeatureLayer<Geometry, object>): string | undefined {
  if (typeof item === 'string') {
    return item;
  }
  else if (typeof item === 'object') {
    return item.id || item.feature?.id;
  }
}

export class ProjectData {
  api: ProjectAPI;

  public layers: LayersData = $state({});
  public mapOptions: MapOptions | undefined = $state();

  constructor() {
    this.api = getContext('api')
  }

  _signalReady: (() => void) | undefined;
  ready() {
    if (this._signalReady)
      throw new Error("Already waiting for ProjectData readiness");
    return new Promise<void>((resolve) => {
      this._signalReady = resolve;
    });
  }

  async loadView(view: string = 'default', timeStart?: Date, timeEnd?: Date) {
    const data = await this.api.getDataView(view, timeStart, timeEnd);

    const layers: LayersData = $state({});
    for (const [name, element] of Object.entries(data.map_data.layers) as [LayerID, object][]) {
      const lt = LayerTemplates[name];
      if (!lt) {
        console.error(`Unknown data layer ${name}`);
        continue;
      }
      const layer = new lt.Data(this, lt, name);
      if (!layer)
        throw new Error(`Undefined layer ${name}`);
      layer.setDataFromElement(element);
      layers[name] = layer;
    }
    this.layers = layers;
    this.mapOptions = data.map_data.options;

    for (const l of Object.values(this.layers)) {
      l.updateCache();
      this.triggerDependents(l.id);
    }

    if (this._signalReady) {
      this._signalReady();
      this._signalReady = undefined;
    }
    return data;
  }

  allLayers: Iterable<AnyLayerData> = $derived(Object.values(this.layers).toSorted((a, b) => (a.layer.order - b.layer.order)));
  allControllers: Iterable<AnyLayerController> = $derived(this.allLayers.reduce((result, l) => (l.ctl ? [...result, l.ctl] : result), [] as AnyLayerController[]));

  initController<DO extends BasicLayerDisplayOptions>(id: LayerID, mapRoot: L.Map, options: Partial<LayerControllerOptions<DO>>) {
    const layer = LayerTemplatesOrdered.find((l) => l.id == id)
    if (!layer) {
      throw new Error(`Unsupported layer ${id}`);
    }
    const data = this.layers[id];
    if (!data) {
      throw new Error(`No data for layer ${id}`);
    }
    const initDisplayOptions = data.options?.initDisplayOptions || options.initDisplayOptions;
    const ctl = new layer.Controller(mapRoot, data, {
      ...layer.ctlOptions,
      ...data.options,
      ...options,
      initDisplayOptions
    });
    data.ctl = ctl;
    this.triggerDependents(id)
    return ctl;
  }

  triggerDependents(id: LayerID) {
    for (const layer of this.allLayers) {
      if (layer.dependencies.indexOf(id) >= 0) {
        layer.triggerUpdateFrom(id);
      }
    }
  }

  getControllerFor(item?: string | Feature<Geometry, object> | MapFeatureLayer<Geometry, Props>) {
    if (!item)
      return;
  
    const id = getID(item);
    if (!id)
      return;

    for (const ctl of this.allControllers) {
      if (ctl.data.features.has(id))
        return ctl;
    }
  }

  public warnings = $derived(
    Object.fromEntries(
      Object.entries(this.layers).map(
        ([name, data]) => ([
          name,
          data.warningsSummary
        ])
      )));

}
