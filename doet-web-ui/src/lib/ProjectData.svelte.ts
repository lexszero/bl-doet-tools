import {getContext} from 'svelte';

import { parseJSON as parseTimestamp } from 'date-fns';
import type {Feature} from './utils/geojson';
import type {Geometry} from 'geojson';

import type {ProjectAPI} from './api_project';

import {LayerTemplates, LayerTemplatesOrdered, type AnyLayerController, type LayerID, type LayersData} from './layers/Layers';
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
  public changeTimestamps: Date[] | undefined;

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
    this.changeTimestamps = data.change_timestamps.map((t) => parseTimestamp(t));

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

    for (const l of Object.values(this.layers)) {
      l.updateCache();
      this.triggerDependents(l.id);
    }

    if (this._signalReady) {
      this._signalReady();
      this._signalReady = undefined;
    }
  }

  allLayers = $derived(Object.values(this.layers).toSorted((a, b) => (a.layer.order - b.layer.order)));
  allControllers = $derived(this.allLayers.reduce((result, l) => (l.ctl ? [...result, l.ctl] : result), [] as AnyLayerController[]));

  initController<DO extends BasicLayerDisplayOptions>(id: LayerID, mapRoot: L.Map, options: LayerControllerOptions<DO>) {
    const layer = LayerTemplatesOrdered.find((l) => l.id == id)
    if (!layer) {
      throw new Error(`Unsupported layer ${id}`);
    }
    const data = this.layers[id];
    if (!data) {
      throw new Error(`No data for layer ${id}`);
    }
    data.ctl = new layer.Controller(mapRoot, data, options);
    this.triggerDependents(id)
    return data.ctl;
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
