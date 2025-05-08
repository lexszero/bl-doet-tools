import L from "leaflet";
import {coordsToLatLng, coordsToLatLngs, distance} from "$lib/utils/geo";
import {Severity, type ItemLogEntry} from "$lib/utils/misc";

import type {LayerID} from "../Layers";
import {LayerData, featureCachedProps} from "../LayerData.svelte";
import {Vref_LN, getPlugTypeInfo} from "../PowerGrid/constants";
import type {GridPDUFeature} from "../PowerGrid/types";

import type {
  PlacementEntityCachedProperties,
  PlacementEntityProperties,
  PlacementFeature,
  PlacementFeatureGeometry
} from "./types";
import PlacementController from "./Controller.svelte";


export function plugLoadPercent(feature: PlacementFeature) {
  const props = feature.properties;
  if (!props.powerPlugType)
    return Infinity;

  const plug = getPlugTypeInfo(props.powerPlugType)
  const plugPmax = Vref_LN * plug.max_amps * plug.phases;
  return (feature.properties.powerNeed || 0) / plugPmax * 100;
}

export class PlacementData extends LayerData<PlacementFeatureGeometry, PlacementEntityProperties> {
  public dependencies: LayerID[] = ["power_grid"];
  declare ctl: PlacementController;

  getNearPDUs(feature: PlacementFeature): [GridPDUFeature, number][] {
    if (!this.project.layers.power_grid)
      return [];
    const c = featureCachedProps(feature) as PlacementEntityCachedProperties;
    if (c.nearPDUs?.length)
      return c.nearPDUs;
    else {
      //console.debug(`${this.id}: update nearPDUs for ${feature.id}`);
      const pdus = this.findNearPDUs(feature);
      this.updateFeatureCache(feature.id, {nearPDUs: pdus});
      return pdus;
    }
  }

  findNearPDUs(feature: PlacementFeature): [GridPDUFeature, number][] {
    const grid = this.project.layers.power_grid;
    //console.debug(`${this.id}: findNearPDUs in ${grid?.features.size} features`);
    if (!grid || !this.ctl)
      return [];
    const pdusInRange = [];
    const itemCenter = L.PolyUtil.centroid(coordsToLatLngs(feature.geometry.coordinates[0]));
    for (const item of grid.features.values()) {
      if (item.properties.type != 'power_grid_pdu') {
        continue;
      }
      const pdu = item as GridPDUFeature;
      const d = distance(itemCenter, coordsToLatLng(pdu.geometry.coordinates)) || Infinity;
      if (d < this.ctl.displayOptions.pduSearchRadius) {
        pdusInRange.push([pdu, d] as [GridPDUFeature, number]);
      }
    }
    pdusInRange.sort(([, ad], [, bd]) => (ad - bd));
    return pdusInRange;
  }

  featureCachedProps(feature: PlacementFeature) {
    return {
      nearPDUs: this.findNearPDUs(feature),
      ...super.featureCachedProps(feature)
    }
  }

  triggerUpdateFrom(id: LayerID): void {
    if (id !== "power_grid")
      return;
    console.debug(`${this.id}: Updating from power_grid`);
    this.invalidateCache();
    this.updateCache();
  }

  validateFeature(feature: PlacementFeature, strict: boolean = false) {
    const result: ItemLogEntry[] = [];
    const props = feature.properties;
    const pwr = feature.properties.powerNeed

    if (!pwr)
      return result;

    if (strict) {
      if (props.powerPlugType) {
        const loadPercent = plugLoadPercent(feature);
        if (loadPercent > 100) {
          result.push({
            level: loadPercent > 300 ? Severity.Error : Severity.Warning,
            message: `Power need ${pwr} is ${loadPercent}% load permitted for ${props.powerPlugType}`
          });
        }
      } else {
        result.push({
          level: Severity.Error,
          message: "Missing power plug type"
        });
      }

      if (!props.techContactInfo) {
        result.push({
          level: Severity.Error,
          message: "Missing tech contact info"
        });
      }
    }

    if (this.project.layers.power_grid && this.ctl) {
      const near = this.getNearPDUs(feature);
      if (!near.length) {
        result.push({
          level: Severity.Error,
          message: `No PDUs within ${this.ctl?.displayOptions.pduSearchRadius}m radius`
        })
      }
    }
    return result;
  }
}

export default PlacementData;
