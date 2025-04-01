<script lang="ts">
  import { browser } from '$app/environment'
  import { Segment, Slider, Switch } from '@skeletonlabs/skeleton-svelte';
  import {Map, TileLayer, GeoJSON, Control, LayerGroup} from 'sveaflet?client';
  import 'leaflet/dist/leaflet.css'
  import L from 'leaflet?client';
  import {LayerGroup as LeafletLayerGroup, PolyUtil} from 'leaflet?client';
  import colormap from '$lib/colormap';

  let {
    data = null,
    layerHighlighted = $bindable(),
    layerSelected = $bindable()
  } = $props();

  let showMapOptionsControl = $state(false);
  let placementDisplayMode = $state('power_need');
  let placementDisplayPowerNeedThresholds = $state([1000, 7400]);
  let placementPDUDistance = $state(50);
  let showGridCoverage = $state(false);

  let map;
  let layerPowerAreas;
  let layerPowerGrid;
  let layerPowerGridCoverage;
  let layerPlacement;

  let layerHighlightedSavedStyle;

  const mapOptions = {
    center: [57.62377, 14.92715],
    zoom: 15,
  };

  const layerBasemapTileUrl = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
  const layerBasemapOptions = {
    minZoom: 0,
    maxZoom: 20,
    maxNativeZoom: 19,
    attribution: "© OpenStreetMap contributors",
  };

function placementNumPDUs(feature) {
let n = 0;
let nearestDistance = 9999999;
let nearestPDU = null;
  for (const item of layerPowerGrid.getLayers()) {
    if (item.feature.properties.type != 'power_grid_pdu') {
      continue;
    }
    const distance = map.distance(PolyUtil.centroid(feature.geometry.coordinates[0]), item.feature.geometry.coordinates);
    if (distance < placementPDUDistance) {
      n++;
    }
    if (distance < nearestDistance) {
nearestDistance = distance;
nearestPDU = item.feature.id;
    }
}
if (nearestPDU) {
    feature.properties.nearest_pdu_distance = Math.round(nearestDistance);
    feature.properties.nearest_pdu_id = nearestPDU;
  }
  return n;
}

  const placementStyleDefault = {
    weight: 0.5,
    opacity: 0.5,
    fillOpacity: 0.6
  };

  const placementStyleFuncs = {
    power_need: (feature) => {
      let power = feature.properties.powerNeed;
      let color = (!power) ?
      '#000' :
      (power < placementDisplayPowerNeedThresholds[0]) ?
        colormap('winter', power, 0, placementDisplayPowerNeedThresholds[0]*1.25, true) :
        colormap('plasma', power, 0, placementDisplayPowerNeedThresholds[1]);
      return {...placementStyleDefault, color, fillColor: color};
    },
    grid_coverage: (feature) => {
      let nr_pdus = 0;
      let color = '#000';
      if (feature.properties.powerNeed) {
        nr_pdus = placementNumPDUs(feature);
        color = colormap('plasma', nr_pdus, 0, 5, true);
      }
      return {...placementStyleDefault, color, fillColor: color}
    },
  }

  function placementDisplayModeChanged(e) {
    const mode = e.value;
    placementDisplayMode = mode;
    if (mode != 'off') {
      layerPlacement.setStyle(placementStyleFuncs[mode]);
    }
  }

  function placementDisplayParamsChanged(e) {
    layerPlacement.setStyle(placementStyleFuncs[placementDisplayMode]);
  }

const powerGridFeatureStyle = {
  '250': {
    weight: 6,
    color: '#B50E85',
  },
  '125': {
    weight: 5,
    color: '#C4162A',
  },
  '63': {
    weight: 4,
    color: '#F2495C',
  },
  '32': {
    weight: 3,
    color: '#FF9830',
  },
  '16': {
    weight: 2,
    color: '#FADE2A'
  },
  '1f': {
    weight: 1,
    color: '#5794F2'
  },
  'unknown': {
    weight: 5,
    color: '#FF0000'
  },
};

  function selectFeature(e) {
    layerSelected = e.target;
  }
  
  function highlightFeature(e) {
    const layer = e.target;
    layerHighlightedSavedStyle = layer.options.style;
    console.log("before save: ", layerHighlightedSavedStyle);
    layer.setStyle({
      weight: 5,
      color: '#FFFD00',
      fillColor: '#FFFD00',
      fillOpacity: 1
    });
    layer.bringToFront();
    layerHighlighted = layer;
  }

  function resetHighlightedFeature(layer, e) {
    layer.resetStyle(e.target);
    console.log("after restore: ", layer.options.style);
    layerHighlighted = null;
  }

  function onEachPowerArea(feature, layer) {
    layer.on({
      click: selectFeature,
      /*
      mouseover: highlightFeature,
      mouseout: (e) => resetHighlightedFeature(layerPowerAreas, e)
      */
    })
  }

  function onEachPowerGridItem(feature, layer) {
    layer.on({
      click: selectFeature,
      mouseover: highlightFeature,
      mouseout: (e) => resetHighlightedFeature(layerPowerGrid, e)
    })
  }

  function onEachPlacementItem(feature, layer) {
    layer.on({
      click: selectFeature,
      mouseover: highlightFeature,
      mouseout: (e) => resetHighlightedFeature(layerPlacement, e)
    })
}

function getFeatureProperties(feature) {
  let exclude = ['name', 'type'];
  return Object.entries(feature.properties).filter(([k, v]) => (!exclude.includes(k)));
}

function getFeatureTitle(feature) {
  if (feature.properties.type) {
    if (feature.properties.type == 'power_grid_cable') {
      return `⚡Cable: ${feature.properties.name}`;
    } else if (feature.properties.type = 'power_grid_pdu') {
      return `⚡PDU: ${feature.properties.name}`;
    }
  } else {
    return `${feature.properties.name}`
  }
}

</script>

{#snippet propertyTable(items)}
  <table class="table">
    <tbody>
      {#each items as [k, v]}
        {#if v}
          <tr><td>{k}</td><td>{v}</td></tr>
        {/if}
      {/each}
    </tbody>
  </table>
{/snippet}

{#if browser}
  <Map options={mapOptions} bind:instance={map}>
    <TileLayer url={layerBasemapTileUrl} options={layerBasemapOptions}/>

      <LayerGroup name='Areas' layerType='overlayer' checked={true}>
        {#await data.powerAreas}
        {:then json}
          <GeoJSON
            json={json}
            bind:instance={layerPowerAreas}
            options={{
              style(feature) {
                return {
                  weight: 1,
                  color: "#37872D",
                  opacity: 0.3,
                  fillOpacity: 0.1
                }
              },
                onEachFeature: onEachPowerArea
            }}
          />
        {/await}
      </LayerGroup>
      <LayerGroup name='Placement' layerType='overlayer' checked={placementDisplayMode != 'off'}>
        {#await data.placementEntities}
        {:then geojsonEntities}
          {#if placementDisplayMode != "off"}
            <GeoJSON
              json={geojsonEntities}
              bind:instance={layerPlacement}
              options={{
                style: placementStyleFuncs[placementDisplayMode],
                onEachFeature: onEachPlacementItem,
              }}
            />
          {/if}
        {/await}
      </LayerGroup>

      <LayerGroup name='Power grid' layerType='overlayer' checked={true}>
        {#await data.powerGrid}
        {:then geojsonGrid}
          <GeoJSON
            json={geojsonGrid}
            bind:instance={layerPowerGrid}
            options={{
              style(feature) {
                if (feature.properties.type == 'power_grid_cable') {
                  return powerGridFeatureStyle[feature.properties.power_size]
                }
              },
              pointToLayer(feature, latlng) {
                let style = powerGridFeatureStyle[feature.properties.power_size];
                return L.circleMarker(latlng, {
                  radius: style.weight,
                  fillColor: style.color,
                  color: style.color,
                  weight: 1,
                  opacity: 1,
                  fillOpacity: 0.8
                });
              },
                onEachFeature: onEachPowerGridItem
            }}
          />
        {/await}
      </LayerGroup>

      <LayerGroup name='Power grid coverage' layerType='overlayer' checked={showGridCoverage} bind:instance={layerPowerGridCoverage}>
      </LayerGroup>

    <Control options={{position: 'bottomleft'}} class="map-overlay-box">
      {#if layerHighlighted}
        {@const feature = layerHighlighted.feature}
        <div class="h4">{getFeatureTitle(feature)}</div>
        <span class="text-xs text-surface-500">id: {feature.id}</span>
        {@render propertyTable(getFeatureProperties(feature))}
      {:else}
        Hover over a feature to see details
      {/if}
    </Control>

    <Control options={{position: 'topright'}} class="map-overlay-box grid"
      onmouseenter={() => (showMapOptionsControl = true)}
      onmouseleave={() => (showMapOptionsControl = false)}
    >
        {#if showMapOptionsControl}
            <div class="flex justify-between items-center gap-4">
              <p>Show grid coverage</p>
              <Switch checked={showGridCoverage} onCheckedChange={(e) => (showGridCoverage = e.checked)} />
            </div>
            <hr class="hr" />
            <div class="flex justify-between items-center gap-4">
              <p>Placement</p>
              <Segment value={placementDisplayMode} onValueChange={placementDisplayModeChanged}>
                <Segment.Item value="off">Off</Segment.Item>
                <Segment.Item value="grid_coverage">Coverage</Segment.Item>
                <Segment.Item value="power_need">Consumption</Segment.Item>
              </Segment>
            </div>
            <!--
            {#if placementDisplayMode == 'power_need'}
              <div class="flex justify-between items-center gap-4">
                <p>Power thresholds</p>
                <Slider value={placementDisplayPowerNeedThresholds} onValueChangeEnd={placementDisplayParamsChanged} min={0} max={20000} step={500}/>
              </div>
            {:else if placementDisplayMode == 'grid_coverage'}
            {/if}
            -->
        {:else}
          <h5>Options</h5>
        {/if}
    </Control>
  </Map>
{/if}

<style>
  :global(.map-overlay-box) {
    border: 2px solid gray;
    padding: 6px 8px;
    font:
      14px/16px Arial,
      Helvetica,
      sans-serif;
    background: rgba(0, 0, 0, 0.8);
    box-shadow: 0 0 15px rgba(0, 0, 0, 0.2);
    border-radius: 5px;
  }
</style>
