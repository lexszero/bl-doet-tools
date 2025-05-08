import { getUnixTime } from "date-fns";
import type {
  Geometry,
  Position
} from "geojson";

import { API } from '$lib/api';
import type {Feature} from "./utils/geojson";

import type {BasicLayerDisplayOptions, LayerControllerOptions} from "./layers/LayerController.svelte";
import type {Props} from "./layers/LayerData.svelte";

import type {GridFeature, PowerGridDisplayOptions} from "./layers/PowerGrid/types";
import type {PowerAreaFeature, PowerAreasDisplayOptions} from "./layers/PowerAreas/types";
import type {PlacementDisplayOptions, PlacementFeature} from "./layers/Placement/types";

export interface ProjectInfo {
  name: string;
  views: string[];
  timestamps: number[];
};

export interface FeaturesDataElement<
  F extends Feature<Geometry, Props>,
  DO extends BasicLayerDisplayOptions,
  > {
  timestamp: string;
  features: F[];
  options?: Partial<LayerControllerOptions<DO>>;
}

export interface MapOptions {
  center: Position,
  zoom: number;
  minZoom: number;
  maxZoom: number;
}

export interface MapViewData {
  options?: MapOptions;
  layers: Record<string, FeaturesDataElement<Feature<Geometry, Props>, BasicLayerDisplayOptions>> & {
    power_areas?: FeaturesDataElement<PowerAreaFeature, PowerAreasDisplayOptions>,
    power_grid?: FeaturesDataElement<GridFeature, PowerGridDisplayOptions>,
    placement?: FeaturesDataElement<PlacementFeature, PlacementDisplayOptions>,
  }
}

export interface ProjectView {
  name: string;
  map_data: MapViewData;
  change_timestamps: string[];
}

export class ProjectAPI extends API {
  project: string;

  constructor (project: string) {
    super();
    this.project = project;
  }

  async fetchJSON(path: string, params: object = {}): Promise<object> {
    let url = this.baseUrl+'/'+path;
    const p = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => p.append(k, v))
    if (p.size) {
      url += `?${p}`;
    };
    return await this.fetch(url)
  };

  async getDataView(view: string, timeStart?: Date, timeEnd?: Date) {
    return await this.fetchJSON(
      `${this.project}/v/${view}`,
      {
        time_start: timeStart ? getUnixTime(timeStart) : 0,
        time_end: getUnixTime(timeEnd ? timeEnd : Date())
      }
    ) as ProjectView;
  }

  async getDataViewElement<T>(element: string, timeStart?: Date, timeEnd?: Date) {
    return await this.fetchJSON(
      `${this.project}/v/default/${element}`,
      {
        time_start: timeStart ? getUnixTime(timeStart) : 0,
        time_end: getUnixTime(timeEnd ? timeEnd : Date())
      }
    ) as T;
  }

  async getProjectInfo(): Promise<ProjectInfo> {
    return (await this.fetchJSON(`${this.project}/info`)) as ProjectInfo;
  }

};
