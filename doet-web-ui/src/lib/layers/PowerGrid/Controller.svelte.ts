import colormap from '$lib/utils/colormap';
import * as geojson from "geojson";
import L from 'leaflet';

import { formatDate } from 'date-fns';
import {
  type GridCableFeature,
  type GridFeature,
  type GridFeatureProperties,
  type GridPDUFeature,
} from "./types";

import { logLevelToColor } from '$lib/utils/misc';
import type { ChipItem, InfoItem } from '$lib/utils/types';
import {
  isSamePoint,
  coordsToLatLng,
  coordsToLatLngs,
} from "$lib/utils/geo";

import {
  IconFeatureDefault,
  IconPDU,
  IconCable,
  IconRuler,
  IconPower,
  IconResistance,
  IconPlug
} from "$lib/Icons";

import IconTimestamp from '@lucide/svelte/icons/file-clock';

import {
  featureChip, 
  LayerController,
  type LayerControllerOptions,
  type MapFeatureLayer,
} from '$lib/layers/LayerController.svelte';

import { type PowerGridDisplayOptions } from './types';
import DisplayOptions from './DisplayOptions.svelte';
import FeatureDetails from './FeatureDetails.svelte';
import { 
  cableLength,
  calculatePathLoss,
  type LossInfoCable,
} from './calculations';
import {
  getGridItemSizeInfo,
  gridItemSizes,
  Vref_LL,
  Vref_LN
} from './constants';
import type PowerGridData from './data.svelte';

type GridMapFeatureLayer = MapFeatureLayer<geojson.Point | geojson.LineString, GridFeatureProperties>;

const styleDefault = {
  opacity: 0.8,
  fillOpacity: 0.6
};

function logLayerEvent(e: L.LeafletEvent) {
  console.log(`event ${e.type} for feature ${e.propagatedFrom.feature.id}`);
}

function isCableStart(cable: GridCableFeature, point: L.LatLng): boolean {
  const p = cable.geometry.coordinates[0];
  return isSamePoint(coordsToLatLng(p), point);
}

function isCableEnd(cable: GridCableFeature, point: L.LatLng): boolean {
  const p = cable.geometry.coordinates[cable.geometry.coordinates.length - 1];
  return isSamePoint(coordsToLatLng(p), point);
}

function isCableStartOrEnd(cable: GridCableFeature, point: L.LatLng): boolean {
  return isCableStart(cable, point) || isCableEnd(cable, point);
}

export class PowerGridController extends LayerController<
  geojson.Point | geojson.LineString,
  GridFeatureProperties,
  PowerGridDisplayOptions
> {
  DisplayOptionsComponent = DisplayOptions;
  FeatureDetailsComponent = FeatureDetails;
  onDataChanged?: (() => undefined);

  editEnabled: boolean = $state(true);
  editInProgress: boolean = $state(false);

  declare data: PowerGridData;

  constructor (mapRoot: L.Map, data: PowerGridData, options: LayerControllerOptions<PowerGridDisplayOptions>) {
    super(mapRoot, data, {
      ...options,
      name: 'PowerGrid',
      zIndex: 420,
      priorityHighlight: 50,
      prioritySelect: 35,
      defaultDisplayOptions: {
        visible: true,
        opacity: 0.8,
        mode: 'size',
        loadPercent: 50,
        showCoverage: false,
        coverageRadius: 50,
        scalePDU: 1.25,
        scaleCable: 1,
      },
    });

    mapRoot.createPane('layer-PowerGridCoverage').style.zIndex = "408";

    this.setupEditControls(this.data.editable);

    $effect(() => {
      for (const l of (this.mapLayers || []) as GridMapFeatureLayer[]) {
        const f = l.feature as GridFeature;
        if (!f)
          continue;
        if (this.editInProgress && f.id == this.layerSelected?.feature.id) {
          switch (f.properties.type) {
            case 'power_grid_pdu': {
              break;
            }

            case 'power_grid_cable': {
              l.pm.enable({
                allowCutting: false,
                allowRotation: false,
                draggable: false,
                removeVertexValidation: (e) => {
                  console.log(e);
                  return true;
                },
                moveVertexValidation: (e) => {
                  console.log(e);
                  const feature = (e.layer as GridMapFeatureLayer).feature;
                  const p = e.marker.getLatLng();
                  if (feature.properties.type == 'power_grid_cable') {
                    if (isCableStartOrEnd(feature as GridCableFeature, p)) {
                      console.log("Move cable start/end point");
                    }
                  }
                  return true;
                }
              });
              break;
            }
          }
        } else {
          l.pm.disable();
        }
      }
    });

    $effect(() => {
      if (this.data.features && this.displayOptions)
        this.updateCoverage();
    });
  }

  setupEditControls(show: boolean) {
    const map = this.mapRoot;
    map.pm.disableGlobalEditMode();
    map.pm.disableGlobalDragMode();
    if (show) {
      map.pm.addControls({
        position: 'topleft',
        drawMarker: false,
        drawCircleMarker: false,
        drawPolyline: false,
        drawPolygon: false,
        drawRectangle: false,
        drawCircle: false,
        drawText: false,
        rotateMode: false,
        cutPolygon: false,
      });
      map.on("pm:globaldragmodetoggled", (e) => {
        console.log(`drag mode: ${e.enabled}`);
        if (e.enabled) {
          for (const l of (this.mapBaseLayer?.pm.getLayers() || []) as GridMapFeatureLayer[]) {
            const f = l.feature as GridFeature;
            if (!f)
              continue;
            if (f.properties.type == 'power_grid_pdu') {
              l.pm.enableLayerDrag();
            }
            else {
              l.pm.disableLayerDrag();
            }
          }
        }
      });
      map.on("pm:globaleditmodetoggled", (e) => {
        console.log(`edit mode: ${e.enabled}`);
        this.editInProgress = e.enabled;
      });
    } else {
      this.editInProgress = false;
      map.pm.disableGlobalDragMode();
      map.pm.disableGlobalEditMode();
      map.pm.removeControls();
    }
  }

  notifyDataChanged() {
    if (this.layerHighlighted) {
      this.highlightFeature(this.layerHighlighted);
    }
    if (this.layerSelected) {
      this.selectFeature(this.layerSelected);
    }
    this.onDataChanged?.();
  }

  mapLayerOptions = () => ({
    ...super.mapLayerOptions(),
    pmIgnore: false
  });

  selectFeature(item: string | GridMapFeatureLayer, fly: boolean = false) {
    const layer = super.selectFeature(item, fly);
    console.debug(`Select grid feature ${layer?.feature.id}, editInProgress=${this.editInProgress}`);
    this.resetHighlightedFeature()
    this.resetHighlightedPath();
    if (layer) {
      this.highlightGridPathUp(layer);
    }
    return layer;
  }

  resetSelectedFeature() {
    super.resetSelectedFeature();
    this.resetHighlightedPath();
  }

  async load(timeEnd?: Date) {
    await this.data.load(timeEnd);
  }

  onEachFeature(feature: GridFeature, layer: GridMapFeatureLayer): void {
    super.onEachFeature(feature, layer);

    layer.on("pm:snap", (e) => {
      const layer = e.layer as GridMapFeatureLayer;
      const layerOther = e.layerInteractedWith as GridMapFeatureLayer;
      const feature = layer.feature as GridFeature;
      const featureOther = layerOther.feature as GridFeature;
      if (!featureOther)
        return;
      console.log(`Snap ${feature.properties.type} ${feature.id} to ${featureOther.properties.type} ${featureOther.id}`);
      if (feature.properties.type == 'power_grid_cable') {
        if (featureOther.properties.type == 'power_grid_pdu') {
          this.data.connectCableToPDU(feature as GridCableFeature, featureOther as GridPDUFeature);
          this.notifyDataChanged();
        } else {
          const cable = feature as GridCableFeature;
          const cableOther = featureOther as GridCableFeature;
          const eps = [
            coordsToLatLng(cable.geometry.coordinates[0]),
            coordsToLatLng(cable.geometry.coordinates[cable.geometry.coordinates.length-1])
          ];
          const pdus = [
            this.data.getPDU(cableOther.properties.pdu_from),
            this.data.getPDU(cableOther.properties.pdu_to)
          ];
          for (const pdu of pdus) {
            if (!pdu)
              continue;
            const p = coordsToLatLng(pdu.geometry.coordinates);
            if (isSamePoint(eps[0], p) || isSamePoint(eps[1], p)) {
              this.data.connectCableToPDU(cable, pdu);
              this.notifyDataChanged();
              break;
            }
          }
        }
      }
    });
    layer.on("pm:unsnap", (e) => {
      const layer = e.layer as GridMapFeatureLayer;
      const layerOther = e.layerInteractedWith as GridMapFeatureLayer;
      const feature = layer.feature as GridFeature;
      const featureOther = layerOther.feature as GridFeature;
      if (!featureOther)
        return;
      console.log(`Unsnap ${feature.properties.type} ${feature.id} to ${featureOther.properties.type} ${featureOther.id}`);
      if ((feature.properties.type == 'power_grid_cable') && (featureOther.properties.type == 'power_grid_pdu')) {
        this.data.disconnectCableFromPDU(feature as GridCableFeature, featureOther as GridPDUFeature);
        this.onDataChanged?.();
      }
    });
    layer.on("pm:remove", () => {
      const feature = layer.feature as GridFeature;
      if (!feature)
        return;
      this.data.deleteFeature(feature);
      this.onDataChanged?.();
    })

    switch (feature.properties.type) {
      case 'power_grid_pdu': {
        layer.on("pm:drag", (e) => {
          const l = e.layer as GridMapFeatureLayer;
          const pdu = l.feature as GridPDUFeature;
          const changedCables = this.data.movePDU(pdu, e.latlng);
          console.log(`Changed cables: ${changedCables.map((c) => c.id)}`);
          for (const cable of changedCables) {
            const l = this.mapLayers?.get(cable.id) as MapFeatureLayer<geojson.LineString, GridCableFeature>;
            if (l) {
              l.setLatLngs(coordsToLatLngs(cable.geometry.coordinates));
              l.redraw();
            }
          }
        });

        layer.on("pm:dragend", () => {
          this.onDataChanged?.();
        });

        break;
      }

      case 'power_grid_cable': {
        layer.on("pm:change", (e) => {
          const layer = e.layer as GridMapFeatureLayer;
          const cable = layer.feature as GridCableFeature;
          this.data.changeCablePath(cable, e.latlngs as L.LatLng[]);
        });
        layer.on("pm:markerdragend", () => {
          this.onDataChanged?.();
        });
        break;
      }
    }
  }

  updateStyle(): void {
    this.data.updateCalculatedInfo({
      method: 'capacity',
      fractionLoad: this.displayOptions.loadPercent/100
    })
    super.updateStyle();
    this.updateCoverage();
  }

  styleBySize = (feature: GridFeature) => {
    const st = getGridItemSizeInfo(feature)?.style;
    return st ? {
      weight: st.weight * this.displayOptions.scaleCable,
      color: st.color
    } : {};
  }

  styleByLoss = (feature: GridFeature) => {
    if (!feature.properties._cache?.loss)
      return { color: '#F00', fillColor: '#F00' }

    const r = calculatePathLoss(this.data.getGridPathToSource(feature), { loadPercentage: this.displayOptions.loadPercent });
    const VdropPercent = r.Vdrop / r.V * 100;
    const color = colormap('plasma', VdropPercent, 0, 10, false);
    return {...this.styleBySize(feature), color, fillColor: color}
  };

  style = (feature?: GridFeature) => {
    if (!feature)
      return {}

    if (this.layerHighlighted?.feature.id == feature.id) {
      return this.styleHighlighted;
    }
    else if (this.layerSelected?.feature.id == feature.id) {
      return this.styleSelected;
    }
    else if (this.isFeatureOnHighlightedGridPath(feature)) {
      return this.styleGridPath;
    }
    switch (this.displayOptions.mode) {
      case 'size':
        return {...styleDefault, opacity: this.displayOptions.opacity, ...this.styleBySize(feature)};

      case 'loss':
        return {...styleDefault, opacity: this.displayOptions.opacity, ...this.styleByLoss(feature)};
    }
  };

  styleGridPath = {color: '#0151FF', weight: 7, opacity: 1, fillOpacity: 1}

  featureIcon = (feature: GridFeature) => ({
    power_grid_pdu: IconPDU,
    power_grid_cable: IconCable
  }[feature.properties.type] || IconFeatureDefault);

  featureStatus(f: GridFeature) {
    const props = f.properties;
    const maxLevel = (props._cache) ? Math.max(...props._cache.log?.map((r) => (r.level))) : undefined;
    if (maxLevel) {
      return logLevelToColor(maxLevel)
    }
    return (props.type == 'power_grid_pdu') ?
      (props.cable_in ? 'success' : 'warning')
      : ((props.pdu_from && props.pdu_to) ? 'success' : 'warning');
  };

  featureColorForStatus = (f: GridFeature) => `${this.featureStatus(f)}`;

  featureProperties = (f: GridFeature) => {
    const exclude = ['name', 'type', 'power_size', 'length_m', 'pdu_from', 'pdu_to', 'cable_in', 'cables_out', '_cache'];
    const result: InfoItem[] = [];
    result.push({
      label: 'Size',
      value: f.properties.power_size,
      icon: IconPlug
    });

    if (f.properties.type == 'power_grid_cable') {
      const props = f.properties;
      result.push({
        label: 'Length',
        value: `${cableLength(f as GridCableFeature).toFixed(1)} m`,
        icon: IconRuler
      });
      if (props.pdu_from) {
        const p = this.data.getPDU(props.pdu_from);
        if (p)
          result.push({
            label: 'From',
            icon: IconPDU,
            chips: [{id: p.id, label: p.properties.name}]
          });
      }
      if (props.pdu_to) {
        const p = this.data.getPDU(props.pdu_to);
        if (p) {
          result.push({
            label: 'To',
            icon: IconPDU,
            chips: [featureChip(p)]
          });
        }
      }
      if (props._cache?.loss) {
        const l = props._cache.loss;
        result.push(
          {
            label: 'I',
            value: `${l.I.toFixed(1)} A`
          },
          {
            label: 'Vin',
            value: `${l.V.toFixed(1)} V`
          },
          {
            label: 'Vdrop',
            value: `${l.Vdrop.toFixed(1)} Vdrop`
          },
        )
      }
    }
    else if (f.properties.type == 'power_grid_pdu') {
      const props = f.properties;
      if (props.cable_in) {
        const cableIn = this.data.getCable(props.cable_in);
        if (cableIn) {
          result.push({
            label: 'Feed line',
            icon: IconCable,
            chips: [featureChip(cableIn)]
          });
          if (cableIn.properties.pdu_from) {
            const pduFrom = this.data.getPDU(cableIn.properties.pdu_from);
            if (pduFrom) {
              result.push({
                label: 'From PDU',
                icon: IconPDU,
                chips: [featureChip(pduFrom)]
              });
            }
          }
        }
      }
      if (props.cables_out) {
        const pdus = props.cables_out.map(
          (cableId: string) => {
            const cable = this.data.getCable(cableId);
            return cable?.properties.pdu_to ? this.data.getPDU(cable.properties.pdu_to) : undefined;
          });
        //console.log(pdus);
        result.push({
          label: 'To PDUs',
          icon: IconPDU,
          chips: pdus.reduce((chips: ChipItem[], f) => (f ? [...chips, featureChip(f)] : chips), [])
        })
      }
      if (props._cache?.loss) {
        const l = props._cache.loss;
        result.push(
          {
            label: 'I in',
            value: `${l.I_in.toFixed(1)} A`
          },
          {
            label: 'I load',
            value: `${l.I_load.toFixed(1)} A`
          },
          {
            label: 'Vin',
            value: `${l.V.toFixed(1)} V`
          },
        );
      }
    }
    return [...result, ...(Object.entries(f.properties)
      .filter(([k]) => (!exclude.includes(k)))
      .map(([k, v]) => ({label: k, value: v} as InfoItem))
      )];
  };

  pointToLayer(feature: GridFeature, latlng: L.LatLng) {
    const style = this.style(feature);
    const m = L.circleMarker(latlng, {
      radius: 5 * this.displayOptions.scaleCable,
      fillColor: style.color,
      color: style.color,
      weight: 1,
      opacity: 1,
      fillOpacity: 0.8,
      pmIgnore: false,
      pane: 'layer-PowerGrid',
      bubblingMouseEvents: false
    });
    m.on('move', () => {
      if (m._powerCoverageCircle) {
        const circle = m._powerCoverageCircle as L.Circle;
        circle.setLatLng(m.getLatLng());
        circle.redraw();
      }
    });
    return m;
  }

  findGridPathToSourceLayers(layer: GridMapFeatureLayer): Array<GridMapFeatureLayer> {
    return this.data.getGridPathToSourceIds(layer.feature)?.map((id) => (this.mapLayers?.get(id) as GridMapFeatureLayer)) || [];
  }

  highlightedGridPath?: Array<GridMapFeatureLayer> = $state();

  isFeatureOnHighlightedGridPath(feature: GridFeature) {
    if (!this.highlightedGridPath)
      return false;
    for (const l of this.highlightedGridPath) {
      if (l.feature.id == feature.id) {
        return true;
      }
    }
    return false;
  }

  isLayerOnHighlightedGridPath(layer: GridMapFeatureLayer) {
    return this.isFeatureOnHighlightedGridPath(layer.feature);
  }

  highlightGridPathUp(layer: GridMapFeatureLayer) {
    const path = this.findGridPathToSourceLayers(layer);

    for (const l of path) {
      if (!(
        (this.layerSelected && this.layerSelected.feature.id == l.feature.id) ||
        (this.layerHighlighted && this.layerHighlighted.feature.id == l.feature.id)
      )) {
        l.setStyle(this.styleGridPath);
        l.bringToFront();
      }
    }
    this.highlightedGridPath = path;
  }

  resetHighlightedPath() {
    if (!this.highlightedGridPath || !this.mapBaseLayer)
      return;
    for (const l of this.highlightedGridPath) {
      this.mapBaseLayer.resetStyle(l);
    }
    this.highlightedGridPath = undefined;
  }

  resetHighlightedFeature() {
    const layer = this.layerHighlighted;
    if (!layer)
      return;
    if (this.isLayerOnHighlightedGridPath(layer)) {
      //console.log(`Feature ${layer.feature.id}: highlighted -> selected`)
      layer.setStyle((layer.feature.id == this.layerSelected?.feature.id) ?
        this.styleSelected : this.styleGridPath);
      this.layerHighlighted = undefined;
    } else {
      super.resetHighlightedFeature();
    }
  }

  getStatistics(): InfoItem[] {
    const result: InfoItem[] = [];
    const totalCableLength = new Map<string, number>(gridItemSizes.map((size) => [size, 0]));
    let totalAllCableLength = 0;
    let maxDistanceToSource: [number, GridFeature?] = [0, undefined];
    let maxResistanceToSource: [number, GridFeature?] = [0, undefined];

    for (const f of this.data.features.values()) {
      if (f.properties.type == 'power_grid_cable') {
        const size = f.properties.power_size;
        const length = cableLength(f as GridCableFeature);
        totalCableLength.set(size, (totalCableLength.get(size) || 0) + length);
        totalAllCableLength += length;
      }
      if (f.properties.type == 'power_grid_pdu') {
        const loss = this.data.getLossToSource(f);
        //console.log(`PDU ${f.id} loss `, loss);
        if (loss) {
          if (loss.L < Infinity && loss.L > maxDistanceToSource[0]) {
            maxDistanceToSource = [loss.L, f];
          }
          if (loss.R < Infinity && loss.R > maxResistanceToSource[0]) {
            maxResistanceToSource = [loss.R, f];
          }
        }
      }
    }

    result.push(
      {
        label: "Last change",
        value: formatDate(this.data.timestamp, 'MMM d yyyy, HH:mm'),
        icon: IconTimestamp
      },
      {
        label: "Max path length to source",
        value: `${maxDistanceToSource[0].toFixed(0)} m`,
        icon: IconRuler,
        chips: [featureChip(maxDistanceToSource[1])]
      },
      {
        label: "Max path resistance to source",
        value: `${maxResistanceToSource[0].toFixed(1)} Ω`,
        icon: IconResistance,
        chips: [featureChip(maxResistanceToSource[1])]
      },
      {
      label: `Total cable length`,
      value: `${totalAllCableLength.toFixed(0)} m`,
      icon: IconRuler
    });

    for (const [size, length] of totalCableLength.entries()) {
      if (length) {
        result.push({
          label: `${size}A length`,
          value: `${length.toFixed(0)} m`,
          icon: IconRuler
        });
      }
    }
    return result;
  }

  mapCoverageLayer: L.FeatureGroup | undefined;

  updateCoverage() {
    if (this.data.features && this.displayOptions.showCoverage && !this.mapCoverageLayer) {
      const circles = [];
      for (const f of this.data.features.values()) {
        if (f.properties.type != 'power_grid_pdu')
          continue;

        const pdu = f as GridPDUFeature;
        const circle = L.circle(coordsToLatLng(pdu.geometry.coordinates), {
          radius: this.displayOptions.coverageRadius,
          weight: 0.5,
          opacity: 0.7,
          color: '#303030',
          fillColor: '#303030',
          fillOpacity: 0.3,
        });

        circles.push(circle);
        const l = this.mapLayers?.get(pdu.id);
        if (l) {
          l._powerCoverageCircle = circle;
        }
      };
      const layer = L.featureGroup(circles, {
        pane: 'layer-PowerGridCoverage',
      });
      this.mapRoot.addLayer(layer);
      console.log(`PowerGrid: Added coverage layer with ${circles.length} circles`);
      this.mapCoverageLayer = layer;
    } else if (this.mapCoverageLayer && (!this.displayOptions.showCoverage || !this.data.features)) {
      for (const l of this.mapLayers?.values() || []) {
        if (l._powerCoverageCircle)
          l._powerCoverageCircle = undefined;
      }
      this.mapRoot.removeLayer(this.mapCoverageLayer);
      this.mapCoverageLayer = undefined;
    }
  }
}

export default PowerGridController;
