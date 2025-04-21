import { getUnixTime } from "date-fns";
import type {
  Point,
  LineString,
  Polygon
} from "geojson";

import { API } from '$lib/api';
import type {PowerGridData} from "./layers/PowerGrid/types";

export interface ProjectInfo {
  timestamps: [number];
};

export interface FeaturesDataElement<T> {
  timestamp: string;
  features: T[];
  editable: boolean;
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
