import { getUnixTime } from "date-fns";
import type {
  Point,
  LineString,
  Polygon
} from "geojson";

import type { Feature, FeatureCollection } from '$lib/utils/geojson';
import type { Named } from '$lib/utils/types';

const API_BASE_URL = 'https://bl.skookum.cc/api';
//const API_BASE_URL = 'http://localhost:8000';

export interface ProjectInfo {
  timestamps: [number];
};

export interface ItemizedLogEntry {
  item_id?: string;
  level: number;
  message: string;
};

export interface PowerAreaProperties extends Named {
  description?: string;
  population?: number;
  total_power?: number;
  area?: number;
}

export type PowerAreaFeature = Feature<Polygon, PowerAreaProperties>;
export type PowerAreaFeatureCollection = FeatureCollection<Polygon, PowerAreaProperties>;

export interface PlacementEntityProperties extends Named {
  description?: string;
  contactInfo?: string;
  nrOfPeople?: number;
  nrOfVechiles?: number;
  amplifiedSound?: number;
  powerNeed?: number;

  _nearPDUs?: [GridPDUFeature, number][];
};

export type PlacementFeature = Feature<Polygon, PlacementEntityProperties>;
export type PlacementFeatureCollection = FeatureCollection<Polygon, PlacementEntityProperties>;

interface GridFeatureCommonProperties extends Named {
  description?: string;
  power_size: string;
  power_native?: boolean;

  _pathToSource?: string[];
  _drc?: ItemizedLogEntry[];
}

export interface GridPDUProperties extends GridFeatureCommonProperties {
  type: "power_grid_pdu"
  power_source?: boolean
  cable_in?: string;
  cables_out?: string[];

  _consumers: string[];
}

export type GridPDUFeature = Feature<Point, GridPDUProperties>;

export interface GridCableProperties extends GridFeatureCommonProperties {
  type: "power_grid_cable"
  pdu_from?: string;
  pdu_to?: string;
  length_m?: number;

  _length?: number;
}

export type GridCableFeature = Feature<LineString, GridCableProperties>;

export type GridFeatureProperties = GridPDUProperties | GridCableProperties;
export type GridFeature = Feature<Point | LineString, GridFeatureProperties>;

export interface PowerGridData {
  timestamp: string;
  log: ItemizedLogEntry[];
  features: FeatureCollection<Point | LineString, GridPDUProperties | GridCableProperties>;
}

export class API {
  baseUrl: string;
  authToken?: string;

  constructor(project: string, authToken?: string) {
    this.baseUrl = `${API_BASE_URL}/${project}/`;
    this.authToken = authToken;
  };

  setAuthToken(authToken: string) {
    this.authToken = authToken;
  };

  async fetch(url: RequestInfo, options?: RequestInit) {
    const headers = options?.headers || {};
    if (this.authToken) {
      headers['Authorization'] = 'Bearer ' + this.authToken;
    }
    return fetch(url, {
      ...options,
      headers: headers
    })
  };

  async fetchJSON(path: string, params: object = {}): Promise<object> {
    let url = this.baseUrl+path;
    const p = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => p.append(k, v))
    if (p.size) {
      url += `?${p}`;
    };
    return await this.fetch(url).then(x=>x.json());
  };

  async getCollectionGeoJSON(collection: string, timeStart?: Date, timeEnd?: Date) {
    return this.fetchJSON(
      `data/${collection}/items.geojson`,
      {
        time_start: timeStart ? getUnixTime(timeStart) : 0,
        time_end: getUnixTime(timeEnd ? timeEnd : Date())
      }
    );
  }

  async getPowerAreasGeoJSON(timeStart?: Date, timeEnd?: Date) {
    return {features: await this.getCollectionGeoJSON('power_areas', timeStart, timeEnd)} as PowerAreaFeatureCollection;
  };

  async getPowerGridGeoJSON(timeStart?: Date, timeEnd?: Date) {
    return await this.getCollectionGeoJSON('power_grid', timeStart, timeEnd);
  };

  async getPowerGridProcessed(timeEnd?: Date): Promise<PowerGridData> {
    return await this.fetchJSON('power_map/grid', {time_end: getUnixTime(timeEnd ? timeEnd : Date())}) as PowerGridData;
  };

  async getPlacementEntitiesGeoJSON(timeStart?: Date, timeEnd?: Date) {
    return {features: await this.getCollectionGeoJSON('placement', timeStart, timeEnd)} as PlacementFeatureCollection;
  }

  async getChangeTimestamps(): Promise<ProjectInfo> {
    return (await this.fetchJSON('data/change_timestamps')) as ProjectInfo;
  }
};
