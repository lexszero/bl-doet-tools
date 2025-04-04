import { getUnixTime } from "date-fns";

const API_BASE_URL = 'https://bl.skookum.cc/api';
//const API_BASE_URL = 'http://localhost:8000';

export class API {
  baseUrl: string;

  constructor(project: string) {
    this.baseUrl = `${API_BASE_URL}/${project}/`;
  };

  async fetchJSON(path: string, params: object = {}): Promise<object> {
    let url = this.baseUrl+path;
    const p = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => p.append(k, v))
    if (p.size) {
      url += `?${p}`;
    };
    return await fetch(url).then(x=>x.json());
  };

  async getCollectionGeoJSON(collection: string, timeStart?: Date, timeEnd?: Date) {
    console.log(timeStart, timeEnd)
    return this.fetchJSON(
      `data/${collection}/items.geojson`,
      {
        time_start: timeStart ? getUnixTime(timeStart) : 0,
        time_end: getUnixTime(timeEnd ? timeEnd : Date())
      }
    );
  }

  async getPowerAreasGeoJSON(timeStart?: Date, timeEnd?: Date) {
    return this.getCollectionGeoJSON('power_areas', timeStart, timeEnd);
  };

  async getPowerGridGeoJSON(timeStart?: Date, timeEnd?: Date) {
    return this.getCollectionGeoJSON('power_grid', timeStart, timeEnd);
  };

  async getPlacementEntitiesGeoJSON(timeStart?: Date, timeEnd?: Date) {
    return this.getCollectionGeoJSON('placement', timeStart, timeEnd);
  }

  async getChangeTimestamps() {
    return this.fetchJSON('data/change_timestamps')
  }
};
