import { getUnixTime } from "date-fns";
import type {
  Geometry,
  Position
} from "geojson";

import { API } from '$lib/api';
import type {Feature} from "./utils/geojson";
import type {GridFeature} from "./layers/PowerGrid/types";
import type {PowerAreaFeature} from "./layers/PowerAreas/types";
import type {PlacementFeature} from "./layers/Placement/types";
import type {BasicLayerDisplayOptions} from "./layers/LayerController.svelte";

export interface ProjectInfo {
  timestamps: [number];
};

export interface FeaturesDataElement<F extends Feature<Geometry, object>> {
  timestamp: string;
  features: F[];
  editable: boolean;
  displayOptions?: BasicLayerDisplayOptions;
}

interface MapOptions {
  center: Position,
  zoom: number;
  zoomMin: number;
  zoomMax: number;
}

interface MapViewData {
  mapOptions?: MapOptions;
  layers: Record<string, FeaturesDataElement<Feature<Geometry, object>>> & {
    power_areas?: FeaturesDataElement<PowerAreaFeature>,
    power_grid?: FeaturesDataElement<GridFeature>,
    placement?: FeaturesDataElement<PlacementFeature>,
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

  async getChangeTimestamps(): Promise<ProjectInfo> {
    return (await this.fetchJSON(`${this.project}/data/change_timestamps`)) as ProjectInfo;
  }

};
