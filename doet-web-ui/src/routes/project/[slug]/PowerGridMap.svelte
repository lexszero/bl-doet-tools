<script lang="ts">
import { browser } from '$app/environment'
  import type { Snippet } from 'svelte';
  import {Map, TileLayer, GeoJSON, ControlLayers, LayerGroup, } from 'sveaflet?client';
  import 'leaflet/dist/leaflet.css'
  import L from 'leaflet?client';

  let {
    data = null,
    entitiesDisplayMode = null,
    project_id = 'bl24'
  } = $props();

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

  async function fetchJSON(url) {
    return await fetch(url).then((x) => x.json());
  }

  const entitiesStyleDefault = {
    weight: 0.5,
    opacity: 1.0,
    fillOpacity: 0.3
  };


  const entitiesStyleModes = {
    power_need: (feature) =>  {return {...entitiesStyleDefault, fillColor: feature.properties.fill}},
    grid_coverage: (feature) => {return {...entitiesStyleDefault, fillColor: '#00ff00'}},

  }

interface PowerGridFeatureProperties {
  type: string;
  name: string;
  description?: string;
  power_size: string;
  power_native: boolean;
};

interface PowerGridFeature {
    geometry: any;
    properties: PowerGridFeatureProperties;
  }
const PowerGridFeatureStyle = {
    '125': {
        weight: 5,
        color: '#C4162A',
        },
    '63': {
        'weight': 4,
        'color': '#F2495C',
        },
    '32': {
        'weight': 3,
        'color': '#FF9830',
        },
    '16': {
        'weight': 2,
        'color': '#FADE2A'
        },
    '1f': {
        'weight': 1,
        'color': '#5794F2'
        },
    'unknown': {
        'weight': 5,
        'color': '#FF0000'
        },
    };
</script>

{#if browser}
  {#snippet grid_feature_popup(f)}
    <table class="table">
      <tbody>
      {#each Object.entries(f.properties) as k, v}
        <tr><td>{k}</td><td>{v}</td></tr>
      {/each}
      </tbody>
    </table>;
  {/snippet}

  <Map options={mapOptions}>
    <TileLayer url={layerBasemapTileUrl} options={layerBasemapOptions}/>

    <ControlLayers>
      <LayerGroup name='Areas' layerType='overlayer' checked={true}>
        {#await data.powerAreas}
        {:then json}
          <GeoJSON
            json={json}
            options={{
              style(feature) {
                return {
                  weight: 1,
                  color: "#37872D",
                  opacity: 0.3,
                  fillOpacity: 0.15
                }
              }
            }}
          />
        {/await}
      </LayerGroup>

      <LayerGroup name='Entities' layerType='overlayer' checked={false}>
        {#await fetchJSON("https://bl.skookum.cc/api/power_map/"+project_id+"/placement_entities.geojson")}
        {:then geojsonEntities}
          {#if entitiesDisplayMode != "off"}
            <GeoJSON
              json={geojsonEntities}
              options={{
                style(feature) {
                  return {...entitiesStyleDefault, fillColor: feature.properties.fill}
                }
              }}
            />
          {/if}
        {/await}
      </LayerGroup>

      <LayerGroup name='Power grid' layerType='overlayer' checked={true}>
        {#await fetchJSON("https://bl.skookum.cc/api/power_map/"+project_id+"/power_grid.geojson")}
        {:then geojsonGrid}
          <GeoJSON
            json={geojsonGrid}
            options={{
              style(feature: PowerGridFeature) {
                if (feature.properties.type == 'power_grid_cable') {
                  return PowerGridFeatureStyle[feature.properties.power_size]
                }
              },
                pointToLayer(feature, latlng) {
                  let style = PowerGridFeatureStyle[feature.properties.power_size];
                  return L.circleMarker(latlng, {
                    radius: style.weight,
                    fillColor: style.color,
                    color: style.color,
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                  });
                },
            }}
          />
        {/await}
      </LayerGroup>

    </ControlLayers>
  </Map>
{/if}
