import L from "leaflet";
import {coordsToLatLngs} from "$lib/utils/geo";

import { LayerData, featureCachedProps } from "../LayerData.svelte";
import type {LayerID} from "../Layers";

import type { PowerAreaCachedProperties, PowerAreaFeature, PowerAreaGeometry, PowerAreaProperties } from "./types";
import type PowerAreasController from "./Controller.svelte";

export class PowerAreasData extends LayerData<PowerAreaGeometry, PowerAreaProperties> {
  public dependencies: LayerID[] = ["placement"];
  declare ctl: PowerAreasController;

  getAreaPoly(area: PowerAreaFeature) {
    const c = featureCachedProps(area);
    if (c.poly)
      return c.poly;
    else {
      const poly = new L.Polyline(coordsToLatLngs(area.geometry.coordinates[0]));
      this.updateFeatureCache(area.id, {poly});
      return poly;
    }
  }

  findAreasForPoint(p: L.LatLng): PowerAreaFeature[] {
    const result = [];
    for (const area of this.features.values()) {
      if (this.getAreaPoly(area).contains(p))
        result.push(area);
    }
    return result
  }

  featureCachedProps(feature: PowerAreaFeature) {
    return {
      poly: new L.Polyline(coordsToLatLngs(feature.geometry.coordinates[0])),
      population: 0,
      powerNeed: 0,
      ...super.featureCachedProps(feature)
    }
  }

  statsReady: boolean = false;

  updateCache() {
    for (const f of this.features.values()) {
      this.updateFeatureCache(f.id, this.featureCachedProps(f));
    }
        super.updateCache();
    this.ctl?.updateTotals(true);
  }

  triggerUpdateFrom(id: LayerID): void {
    if (id !== 'placement')
      return;

    const placement = this.project.layers.placement?.features.values();
    if (!placement)
      return;

    console.debug(`${this.id}: Updating totals from placement`);
    for (const item of placement) {
      const p = L.PolyUtil.centroid(coordsToLatLngs(item.geometry.coordinates[0]));
      const areas = this.findAreasForPoint(p);
      //console.debug(`Placement item ${item.id} ${item.properties.name} -> ${areas.map((a) => a.properties.name)}`);
      for (const area of areas) {
        const c = featureCachedProps(area) as PowerAreaCachedProperties;
        this.updateFeatureCache(area.id, {
          powerNeed: c.powerNeed + (item.properties.powerNeed || 0),
          population: c.population + (item.properties.nrOfPeople || 0),
        });
      }
    }
    this.statsReady = true;
  }
}

export default PowerAreasData;
