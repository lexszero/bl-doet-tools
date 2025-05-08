import type {Polygon} from 'geojson';
import { LayerController, type LayerControllerOptions } from '$lib/layers/LayerController.svelte';
import type {InfoItem} from '$lib/utils/types';

import { L, coordsToLatLngs, ringArea } from '$lib/utils/geo';
import 'leaflet-labeled-circle';

import type {PowerAreaCachedProperties, PowerAreaFeature, PowerAreaProperties, PowerAreasDisplayOptions} from './types';
import type PowerAreasData from './data';
import DisplayOptions from './DisplayOptions.svelte';

import {IconArea, IconPeople, IconPower} from '$lib/Icons';
import {featureCachedProps} from '../LayerData.svelte';

export class PowerAreasController extends LayerController<
  Polygon,
  PowerAreaProperties,
  PowerAreasDisplayOptions
> {
  DisplayOptionsComponent = DisplayOptions;

  declare data: PowerAreasData;

  constructor (mapRoot: L.Map, data: PowerAreasData, options: LayerControllerOptions<PowerAreasDisplayOptions>) {
    super(mapRoot, data, {
      ...options,
      name: 'PowerAreas',
      zIndex: 405,
      priorityHighlight: 10,
      prioritySelect: 30,
      defaultDisplayOptions: {
        visible: true,
        opacity: 0.3,
        showTotalPower: false,
        divTotalPower: 1,
      },
    });
    mapRoot.createPane('layer-PowerAreasTotals').style.zIndex = "450";
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

  featureProperties = (f: PowerAreaFeature) => {
    const exclude = ['name', 'type', '_cache'];
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
    const c = featureCachedProps(f) as PowerAreaCachedProperties;
    if (c.population)
      result.push({
        icon: IconPeople,
        label: "Population",
        value: `${(c.population).toFixed(0)}`,
      });

    if (c.powerNeed) {
      const powerNeedAdjusted = (this.displayOptions.divTotalPower != 1)
        ? `| ${(c.powerNeed / this.displayOptions.divTotalPower / 1000).toFixed(0)} kW (div ${this.displayOptions.divTotalPower})`
        : '';
      result.push({
        icon: IconPower,
        label: "Power need",
        value: `${(c.powerNeed/1000).toFixed(0)} kW ${powerNeedAdjusted}`,
      });
    }

    if (c.powerNeed && c.population)
      result.push({
        label: "W/person",
        value: `${(c.powerNeed/c.population).toFixed(0)} W`,
      });

    if (c.population)
      result.push({
        label: "m²/person",
        value: `${(totalArea/c.population).toFixed(0)} m²`,
      });
    return result;
  }

  mapTotalsLayer: L.FeatureGroup | undefined;

  addTotalsMarkers() {
    if (!this.data.features.size || !this.data.statsReady || this.mapTotalsLayer)
      return;

    const markers = [];
    for (const area of this.data.features.values()) {
      const c = featureCachedProps(area);
      const center = L.PolyUtil.centroid(this.data.getAreaPoly(area).getLatLngs());
      if (!center)
        continue;

      const marker = L.textCircle(
        `${(c.powerNeed/this.displayOptions.divTotalPower/1000).toFixed(0)}`,
        center,
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
    //console.debug(`${this.data.id} features: ${this.data.features.size}, statsReady: ${this.data.statsReady}, show: ${this.displayOptions.showTotalPower}, layer: ${!!this.mapTotalsLayer}`);
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
