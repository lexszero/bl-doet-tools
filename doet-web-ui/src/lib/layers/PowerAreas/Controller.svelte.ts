import { getContext } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import type {Polygon} from 'geojson';
import type {PowerAreaFeature, PowerAreaProperties, PowerAreasDisplayOptions} from './types';
import type {PowerGridData} from '$lib/layers/PowerGrid/data.svelte';
import { LayerController, type LayerControllerOptions } from '$lib/layers/LayerController.svelte';
import type {FeaturesDataElement} from '$lib/api_project';
import type {PlacementFeature} from '../Placement/types';
import type {InfoItem} from '$lib/utils/types';

import { L, coordsToLatLngs, ringArea } from '$lib/utils/geo';
import LabeledMarker from 'leaflet-labeled-circle';

import {IconPeople, IconPower} from '$lib/Icons';
import IconArea from '@lucide/svelte/icons/drafting-compass';
import power from '@lucide/svelte/icons/power';

export class PowerAreasController extends LayerController<
  Polygon,
  PowerAreaProperties,
  PowerAreasDisplayOptions
> {
  layerName = 'PowerAreas';
  layerZIndex = 1;

  data: PowerGridData;
  statsReady: boolean = false;

  constructor (mapRoot: L.Map, options: LayerControllerOptions<PowerAreasDisplayOptions>) {
    super(mapRoot, {
      name: 'PowerAreas',
      zIndex: 405,
      defaultDisplayOptions: {
        visible: true,
        opacity: 0.3,
        showTotalPower: false,
        divTotalPower: 1,
      },
      ...options
    });
    this.data = getContext('PowerGridData');
    mapRoot.createPane('layer-PowerAreasTotals').style.zIndex = "450";
  }

  async load(timeStart?: Date, timeEnd?: Date) {
    const data = await this.data.api.getDataViewElement<FeaturesDataElement<PowerAreaFeature>>('power_areas', timeStart, timeEnd);
    this.features = new SvelteMap<string, PowerAreaFeature>(
      data.features.map(
        (f: PowerAreaFeature) => {
          f.properties._attrs = {
            poly: new L.Polyline(coordsToLatLngs(f.geometry.coordinates[0])),
            population: 0,
            powerNeed: 0
          };
          return [f.id, f];
        }
      )
    );
  }

  updateStyle(): void {
    super.updateStyle();
    this.updateTotals(true);
  }

  style = () => ({
    weight: 1,
    color: "#37872D",
    opacity: this.displayOptions.opacity,
    fillOpacity: 0.1
  });
  styleHighlighted = {
    weight: 5,
    color: '#FFFD00',
    fillColor: '#FFFD00',
    opacity: 0.3,
    fillOpacity: 0.5,
  };
  styleSelected = {
    weight: 5,
    color: '#FFFD00',
    fillColor: '#FFFD00',
    opacity: 0.3,
    fillOpacity: 0.3,
  };

  highlightBringsToFront = false;

  findAreasForPoint(p: L.LatLng): PowerAreaFeature[] {
    const result = [];
    for (const area of this.features.values()) {
      const poly = area.properties._attrs?.poly;
      if (!poly)
        continue;
      if (poly.contains(p))
        result.push(area);
    }
    return result
  }

  updateStats(placement: Iterable<PlacementFeature>) {
    for (const item of placement) {
      const p = L.PolyUtil.centroid(coordsToLatLngs(item.geometry.coordinates[0]));
      const areas = this.findAreasForPoint(p);
      //console.debug(`Placement item ${item.id} ${item.properties.name} -> ${areas.map((a) => a.properties.name)}`);
      for (const area of areas) {
        const attrs = area?.properties._attrs;
        if (!attrs)
          continue;
        attrs.powerNeed += item.properties.powerNeed || 0;
        attrs.population += item.properties.nrOfPeople || 0;
      }
    }
    this.statsReady = true;
    this.updateTotals(true);
  }

  featureProperties = (f: PowerAreaFeature) => {
    const exclude = ['name', 'type', '_attrs'];
    const result = (Object.entries(f.properties)
      .filter(([k]) => (!exclude.includes(k)))
      .map(([k, v]) => ({label: k, value: v} as InfoItem))
      )
    const totalArea = ringArea(coordsToLatLngs(f.geometry.coordinates[0]));
    result.push({
      icon: IconArea,
      label: "Area",
      value: `${totalArea.toFixed(0)} m²`
    });
    const attrs = f.properties._attrs;
    if (attrs) {
      const powerNeedAdjusted = (this.displayOptions.divTotalPower != 1)
        ? `| ${(attrs.powerNeed / this.displayOptions.divTotalPower / 1000).toFixed(0)} kW (div ${this.displayOptions.divTotalPower})`
        : '';
      result.push(
        {
          icon: IconPeople,
          label: "Population",
          value: `${(attrs.population).toFixed(0)}`,
        },
        {
          icon: IconPower,
          label: "Power need",
          value: `${(attrs.powerNeed/1000).toFixed(0)} kW ${powerNeedAdjusted}`,
        },
        {
          label: "W/person",
          value: `${(attrs.powerNeed/attrs.population).toFixed(0)} W`,
        },
        {
          label: "m²/person",
          value: `${(totalArea/attrs.population).toFixed(0)} m²`,
        },
      );
    }
    return result;
  }

  mapTotalsLayer: L.FeatureGroup | undefined;

  addTotalsMarkers() {
    if (!this.data.features.size || !this.statsReady || this.mapTotalsLayer)
      return;

    const markers = [];
    for (const area of this.features.values()) {
      const attrs = area.properties._attrs;
      if (!attrs)
        continue;
      const marker = L.textCircle(
        `${(attrs.powerNeed/this.displayOptions.divTotalPower/1000).toFixed(0)}`,
        L.PolyUtil.centroid(attrs.poly.getLatLngs()),
        {
          radius: 12,
          weight: 1,
          fillColor: '#000',
          fillOpacity: 0.5,
          color: '#fff',
          pane: 'layer-PowerAreasTotals',
          textStyle: {
            color: '#fff',
            fillColor: '#fff',
            fontSize: 12,
            fontFamily: 'sans-serif',
            fontWeight: 100,
          },
        });
      const l = this.mapLayers?.get(area.id);
      if (l) {
        marker._layerArea = l;
        l._totalsMarker = marker;
      }
      marker.on('click', (e) => this.selectFeature(e.target._layerArea));
      marker.on('mouseover', (e) => this.highlightFeature(e.target._layerArea));
      marker.on('mouseout', () => this.resetHighlightedFeature());
      markers.push(marker);
    }

    const layer = L.featureGroup(markers, {
      pane: 'layer-PowerAreasTotals',
    });
    this.mapRoot.addLayer(layer);
    console.log(`PowerAreas: Added totals layer with ${markers.length} markers`);
    this.mapTotalsLayer = layer;
  }

  deleteTotalsMarkers() {
    if (!this.mapTotalsLayer || !this.data.features.size)
      return;

    for (const l of this.mapLayers?.values() || []) {
      if (l._totalsMarker)
        l._totalsMarker = undefined;
    }
    this.mapRoot.removeLayer(this.mapTotalsLayer);
    this.mapTotalsLayer = undefined;
  }

  updateTotals(forceRedraw: boolean = false) {
    console.debug(`features: ${this.data.features.size}, statsReady: ${this.statsReady}, show: ${this.displayOptions.showTotalPower}, layer: ${!!this.mapTotalsLayer}`);
    if (forceRedraw && this.displayOptions.showTotalPower) {
      this.deleteTotalsMarkers();
      this.addTotalsMarkers();
    } else {
      if (this.displayOptions.showTotalPower)
        this.addTotalsMarkers();
      else
        this.deleteTotalsMarkers();
    }
  }
}

export default PowerAreasController;
