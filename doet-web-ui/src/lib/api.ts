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

  async getCollectionGeoJSON(collection: string, timestamp?: Date) {
    return this.fetchJSON(
      `data/${collection}/items.geojson`,
      timestamp ? {
        time_end: getUnixTime(timestamp)
      } : {}
    );
  }

  async getPowerAreasGeoJSON(timestamp?: Date) {
    return this.getCollectionGeoJSON('power_areas', timestamp);
  };

  async getPowerGridGeoJSON(timestamp?: Date) {
    return this.getCollectionGeoJSON('power_grid', timestamp);
  };

  async getPlacementEntitiesGeoJSON(timestamp?: Date) {
    return this.getCollectionGeoJSON('placement', timestamp);
  }

  async getChangeTimestamps() {
    return this.fetchJSON('data/change_timestamps')
  }
};
