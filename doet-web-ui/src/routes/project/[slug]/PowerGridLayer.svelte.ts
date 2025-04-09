import { SvelteMap } from 'svelte/reactivity';
import colormap from '$lib/colormap';
import * as geojson from "geojson";
import L from 'leaflet';

import {
  API,
  type Feature,
  type GridCableFeature,
  type GridFeature,
  type GridFeatureProperties,
  type GridPDUFeature,
} from "$lib/api";

import {
  isSamePoint
} from "$lib/utils";

import {
  GridData,
  Vref_LN,
  gridItemSizeData,
  gridItemSizes,
} from '$lib/GridData.svelte';

import {
  IconFeatureDefault,
  IconPDU,
  IconCable,
  IconRuler,
  IconPower,
  IconResistance,
  IconPlug
} from "./Icons.svelte";

import {
  featureChip, 
  InteractiveLayer,
  type ChipItem,
  type InfoItem,
  type MapFeatureLayer,
} from './InteractiveLayer.svelte';


type GridMapFeatureLayer = L.FeatureGroup<GridFeatureProperties> & {
  feature: Feature<geojson.Point | geojson.LineString, GridFeatureProperties>;
}

export const logLevelToColor = (level: number) => (
  (level >= 40) ? 'error'
  : (level >= 30) ? 'warning'
    : (level >= 20) ? 'success'
      : 'surface');

const styleDefault = {
  opacity: 0.8,
  fillOpacity: 0.6
};

function logLayerEvent(e) {
  console.log(`event ${e.type} for feature ${e.layer.feature.id}`);
}

function isCableStart(cable: GridCableFeature, point: L.LatLng): boolean {
  const p = cable.geometry.coordinates[0];
  return isSamePoint(L.GeoJSON.coordsToLatLng(p), point);
}

function isCableEnd(cable: GridCableFeature, point: L.LatLng): boolean {
  const p = cable.geometry.coordinates[cable.geometry.coordinates.length - 1];
  return isSamePoint(L.GeoJSON.coordsToLatLng(p), point);
}

function isCableStartOrEnd(cable: GridCableFeature, point: L.LatLng): boolean {
  return isCableStart(cable, point) || isCableEnd(cable, point);
}

export class PowerGridLayer extends InteractiveLayer<
  geojson.Point | geojson.LineString,
  GridFeatureProperties
> {
  data: GridData;
  onDataChanged?: (() => undefined);

  editEnabled: boolean = $state(true);
  editInProgress: boolean = $state(false);

  constructor (api: API) {
    super();
    this.data = new GridData(api);
    $effect(() => {
      if (!this.mapRoot?.pm) {
        return;
      }
      const map = this.mapRoot;
      map.pm.disableGlobalEditMode();
      map.pm.disableGlobalDragMode();
      if (this.editEnabled) {
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
    });

    $effect(() => {
      for (const l of (this.mapBaseLayer?.pm.getLayers() || []) as GridMapFeatureLayer[]) {
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
  }

  _getLayers = () => this.mapBaseLayer?.pm.getLayers();
  features = $derived(this.data?.features || new SvelteMap<string, GridFeature>());

  displayMode: string = $state('processed');
  coloringMode: 'size' | 'loss' = $state('size');
  coloringLossAtLoadLevel: number = $state(50);
  showCoverage: boolean = $state(false);

  mapLayerOptions = () => ({
    ...super.mapLayerOptions(),
    pmIgnore: false
  });

  allFeatures() {
    return this.features;
  }
  selectFeature(id: string, ...rest) {
    super.selectFeature(id, ...rest);
    const layer = this.mapLayers?.get(id);
    this.resetHighlightedFeature(layer)
    this.resetHighlightedPath();
    if (layer) {
      this.highlightGridPathUp(layer);
    }
    //this.layerSelected = undefined;
  }

  async load(timeEnd?: Date) {
    this.data.load(timeEnd);
  }

  onEachFeature(feature: GridFeature, layer: GridMapFeatureLayer): void {
    super.onEachFeature(feature, layer);

    layer.on("pm:snap", (e) => {
      logLayerEvent(e);
      const layer = e.layer as GridMapFeatureLayer;
      const layerOther = e.layerInteractedWith as GridMapFeatureLayer;
      const feature = layer.feature as GridFeature;
      const featureOther = layerOther.feature as GridFeature;
      if (!featureOther)
        return;
      console.log(`Snap ${feature.properties.type} ${feature.id} to ${featureOther.properties.type} ${featureOther.id}`);
      if ((feature.properties.type == 'power_grid_cable') && (featureOther.properties.type == 'power_grid_pdu')) {
        this.data.connectCableToPDU(feature as GridCableFeature, featureOther as GridPDUFeature);
        this.onDataChanged?.();
      }
    });
    layer.on("pm:unsnap", (e) => {
      logLayerEvent(e);
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
    layer.on("pm:remove", (e) => {
      const l = e.layer as GridMapFeatureLayer;
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
            const l = this.mapLayers?.get(cable.id);
            l.setLatLngs(L.GeoJSON.coordsToLatLngs(cable.geometry.coordinates));
            l.redraw();
          }
        });

        layer.on("pm:dragend", (e) => {
          this.onDataChanged?.();
        });

        break;
      }

      case 'power_grid_cable': {
        layer.on("pm:change", (e) => {
          const layer = e.layer as GridMapFeatureLayer;
          const cable = layer.feature as GridCableFeature;
          this.data.changeCablePath(cable, e.latlngs);
        });
        layer.on("pm:markerdragend", (e) => {
          this.onDataChanged?.();
        });
        break;
      }
    }
  }
  styleByLoss = (feature: GridFeature) => {
    const r = this.data?.calculatePathLoss(
      this.data.getGridPathToSource(feature),
      { loadPercentage: this.coloringLossAtLoadLevel })
    const color = r ? colormap('plasma', r.VdropPercent, 0, 10, false) : '#808080';
    return {...gridItemSizeData(feature.properties.power_size)?.style, color, fillColor: color}
  };

  style = (feature: GridFeature) => {
    if (this.layerHighlighted?.feature.id == feature.id) {
      return this.styleHighlighted;
    }
    else if (this.layerSelected?.feature.id == feature.id) {
      return this.styleSelected;
    }
    else if (this.isFeatureOnHighlightedGridPath(feature)) {
      return this.styleGridPath(feature);
    }
    switch (this.coloringMode) {
      case 'size':
        return {...styleDefault, ...gridItemSizeData(feature.properties.power_size)?.style};

      case 'loss':
        return {...styleDefault, ...this.styleByLoss(feature)};
    }
  };

  styleGridPath = (feature: GridFeature) => ({color: '#0151FF', weight: 7, opacity: 1, fillOpacity: 1});

  featureIcon = (feature: GridFeature) => ({
    power_grid_pdu: IconPDU,
    power_grid_cable: IconCable
  }[feature.properties.type] || IconFeatureDefault);

  featureStatus(f: GridFeature) {
    const props = f.properties;
    const maxLevel = (props._drc) ? Math.max(...props._drc.map((r) => (r.level))) : undefined;
    if (maxLevel) {
      return logLevelToColor(maxLevel)
    }
    return (props.type == 'power_grid_pdu') ?
      (props.cable_in ? 'success' : 'warning')
      : ((props.pdu_from && props.pdu_to) ? 'success' : 'warning');
  };

  featureColorForStatus= (f: GridFeature) => `${this.featureStatus(f)}`;
  
  featureProperties = (f: GridFeature) => {
    const exclude = ['name', 'type', 'power_size', 'length_m', 'pdu_from', 'pdu_to', 'cable_in', 'cables_out', '_drc', '_pathToSource'];
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
        value: `${this.data.cableLength(f as GridCableFeature).toFixed(1)} m`,
        icon: IconRuler
      });
      if (props.pdu_from) {
        const p = this.features.get(props.pdu_from);
        if (p)
          result.push({
            label: 'From',
            icon: IconPDU,
            chips: [{id: p.id, label: p.properties.name}]
          });
      }
      if (props.pdu_to) {
        const p = this.features.get(props.pdu_to);
        if (p) {
          result.push({
            label: 'To',
            icon: IconPDU,
            chips: [featureChip(p)]
          });
        }
      }
    }
    else if (f.properties.type == 'power_grid_pdu') {
      const props = f.properties;
      if (props.cable_in) {
        const cableIn = this.features.get(props.cable_in) as GridCableFeature;
        if (cableIn) {
          result.push({
            label: 'Feed line',
            icon: IconCable,
            chips: [featureChip(cableIn)]
          });
          if (cableIn.properties.pdu_from) {
            const pduFrom = this.features.get(cableIn.properties.pdu_from) as GridPDUFeature;
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
            const cable = this.features.get(cableId) as GridCableFeature;
            return cable.properties.pdu_to ? this.features.get(cable.properties.pdu_to) : undefined;
          });
        //console.log(pdus);
        result.push({
          label: 'To PDUs',
          icon: IconPDU,
          chips: pdus.reduce((chips: ChipItem[], f) => (f ? [...chips, featureChip(f)] : chips), [])
        })
      }
    }
    return [...result, ...(Object.entries(f.properties)
      .filter(([k]) => (!exclude.includes(k)))
      .map(([k, v]) => ({label: k, value: v} as InfoItem))
      )];
  };

  pointToLayer(feature: GridFeature, latlng: L.LatLng) {
    const style = this.style(feature);
    return L.circleMarker(latlng, {
      radius: style.weight,
      fillColor: style.color,
      color: style.color,
      weight: 1,
      opacity: 1,
      fillOpacity: 0.8
    });
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
        l.setStyle(this.styleGridPath(l.feature));
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

  getHighlightedPathInfo(): Array<InfoItem> {
    const loadLevels = [100, 75, 50];
    if (!this.data) {
      return []
    }
    const result: Array<InfoItem> = [];

    const path = this.highlightedGridPath?.map((l) => this.features.get(l.feature.id));
    const pathResult = this.data?.calculatePathLoss(path,
      { loadAmps: Math.min(...(path?.map((f) => f ? gridItemSizeData(f.properties.power_size).max_amps : 0) || [])) }
    );

    const allResults = [
      ...loadLevels.map((loadPercentage) => [
        `${loadPercentage}%`,
        this.data?.calculatePathLoss(path, { loadPercentage })
      ]),
      [ 'path', pathResult ]
    ] as Array<[string, LossCalculationResult]>;

    result.push({
      label: "Path length",
      value: `${pathResult.L.toFixed(1)} m`,
      icon: IconRuler
    },
    {
      label: "Resistance",
      value: `${pathResult.R.toFixed(2)} Ω`,
      icon: IconResistance
    },
    {
      label: "Pmax",
      value: `${(pathResult.I*Vref_LN*3/1000).toFixed(1)} kW`,
      icon: IconPower
    },
    {
      label: "Imax",
      value: `${(pathResult.I).toFixed(1)} A`,
      icon: IconPower
    }

    );

    for (const [label, r] of allResults) {
      result.push(
        {
          label: `Loss @ ${label}`,
          value: `${r.Vdrop.toFixed(1)} V (${r.VdropPercent.toFixed(0)}%), ${(r.Ploss/1000.0).toFixed(1)} kW`,
          classes: (
            (r.VdropPercent < 5) ? ""
            : (r.VdropPercent < 10) ? "text-warning-500"
            : "text-error-500"
          )
        },
      );
    }

    return result;
  }

  resetHighlightedFeature(layer?: Layer) {
    if (!layer) {
      layer = this.layerHighlighted;
    }
    if (this.isLayerOnHighlightedGridPath(layer)) {
      //console.log(`Feature ${layer.feature.id}: highlighted -> selected`)
      layer.setStyle((layer.feature.id == this.layerSelected.feature.id) ?
        this.styleSelected : this.styleGridPath(layer.feature));
      this.layerHighlighted = undefined;
    } else {
      super.resetHighlightedFeature(layer);
    }
  }

  getStatistics(): InfoItem[] {
    const result: InfoItem[] = [];
    const totalCableLength = new Map<string, number>(gridItemSizes.map((size) => [size, 0]));
    let totalAllCableLength = 0;
    let maxDistanceToSource: [number, GridFeature?] = [0, undefined];
    let maxResistanceToSource: [number, GridFeature?] = [0, undefined];

    for (const f of this.features.values()) {
      if (f.properties.type == 'power_grid_cable') {
        const size = f.properties.power_size;
        const length = this.data.cableLength(f as GridCableFeature);
        totalCableLength.set(size, (totalCableLength.get(size) || 0) + length);
        totalAllCableLength += length;
      }
      if (f.properties.type == 'power_grid_pdu') {
        const loss = this.data.getLossToSource(f);
        //console.log(`PDU ${f.id} loss `, loss);
        if (loss) {
          if (loss.L > maxDistanceToSource[0]) {
            maxDistanceToSource = [loss.L, f];
          }
          if (loss.R > maxResistanceToSource[0]) {
            maxResistanceToSource = [loss.R, f];
          }
        }
      }
    }

    result.push(
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
}
