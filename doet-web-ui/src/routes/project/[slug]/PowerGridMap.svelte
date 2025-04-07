<script lang="ts">
  import { browser } from '$app/environment'
  import { Segment, Switch, Combobox } from '@skeletonlabs/skeleton-svelte';
  import {Map, TileLayer, GeoJSON, Control, LayerGroup} from 'sveaflet?client';
  import 'leaflet/dist/leaflet.css'

  import { PowerGridLayer } from './PowerGridLayer.svelte';
  import { PlacementLayer } from './PlacementLayer.svelte';
  import { PowerAreasLayer } from './PowerAreasLayer.svelte';
	import {onMount} from 'svelte';

  let {
    api,
    timeStart,
    timeEnd,
  } = $props();

  let showMapOptionsControl = $state(false);

  let mapRoot: L.Map = $state();

  let showGridCoverage: boolean = $state(false);

  let layerSelected = $state();

  let grid: PowerGridLayer = new PowerGridLayer(api);
  let areas: PowerAreasLayer = new PowerAreasLayer(grid);
  let placement: PlacementLayer = new PlacementLayer(grid);

  onMount(async () => {
    await areas.load(timeStart, timeEnd);
    await grid.load(timeStart, timeEnd);
    await placement.load(timeStart, timeEnd);
  });

  $effect(() => {
    areas.mapRoot = mapRoot;
    grid.mapRoot = mapRoot;
    placement.mapRoot = mapRoot;
  })

  let containerShowingDetails = $derived.by(() => (
    (grid.layerHighlighted) ? 
      grid
      : (placement.layerHighlighted) ?
        placement
        : (areas.layerHighlighted) ?
        areas
        : undefined
        ));

  const mapOptions = {
    center: [57.62377, 14.92715],
    zoom: 15,
    zoomControl: false
  };

  const layerBasemapTileUrl = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
  const layerBasemapOptions = {
    minZoom: 0,
    maxZoom: 20,
    maxNativeZoom: 19,
    attribution: "© OpenStreetMap contributors",
  };

  let searchValue = $state();
  function searchValueChange(e) {
    let id = e.value[0];
    grid?.selectFeature(id);
  }

 function getFeatureProperties(feature) {
    let exclude = ['name', 'type'];
    return Object.entries(feature.properties).filter(([k, v]) => (!exclude.includes(k)));
  }

  function getFeatureTitle(feature) {
    if (feature.properties.type) {
      if (feature.properties.type == 'power_grid_cable') {
        return `⚡Cable: ${feature.properties.name}`;
      } else if (feature.properties.type == 'power_grid_pdu') {
        return `⚡PDU: ${feature.properties.name}`;
      }
    } else {
      return `${feature.properties.name}`
    }
  }

  function getFeatureIcon(feature) {
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
  <Map options={mapOptions} bind:instance={mapRoot}>
    <TileLayer url={layerBasemapTileUrl} options={layerBasemapOptions}/>

      <LayerGroup name='Areas' layerType='overlayer' checked={true}>
        {#key areas.geojson}
          {#if areas?.geojson}
            <GeoJSON
              json={areas.geojson}
              bind:instance={areas.mapBaseLayer}
              options={areas.mapLayerOptions()}
            />
          {/if}
        {/key}
      </LayerGroup>
      <LayerGroup name='Placement' layerType='overlayer' checked={placement?.mode != 'off'}>
        {#key placement.geojson}
          {#if placement?.geojson && placement?.mode != "off"}
            <GeoJSON
              json={placement.geojson}
              bind:instance={placement.mapBaseLayer}
              options={placement.mapLayerOptions()}
            />
          {/if}
        {/key}
      </LayerGroup>

      <LayerGroup name='Power grid' layerType='overlayer' checked={true}>
        {#key grid.geojson}
          {#if grid?.geojson}
            <GeoJSON
              json={grid.geojson}
              bind:instance={grid.mapBaseLayer}
              options={grid.mapLayerOptions()}
            />
          {/if}
        {/key}
      </LayerGroup>

    <Control options={{position: 'topleft'}} class="flex map-overlay-box">
    {#key grid.searchItems}
      <Combobox
        data={grid.searchItems}
        value={searchValue}
        onValueChange={searchValueChange}
        placeholder="Search..."
        width="w-100"
      >
        <!-- This is optional. Combobox will render label by default -->
        {#snippet item(item)}
          {@const Icon = item.icon}
          <div class="flex grow w-150 justify-between space-x-2">
            <span>{@html item.label}</span>
            <Icon />
          </div>
        {/snippet}
      </Combobox>
      {#if layerSelected && searchValue}
        <button type="button" class="btn preset-outlined-surface-500" onclick={() => {searchValue = null; resetSelectedFeature();}}>X</button>
      {/if}
      {/key}
    </Control>

    <Control options={{position: 'bottomleft'}} class="map-overlay-box">
      {#if containerShowingDetails}
        {@const layer = containerShowingDetails.layerHighlighted}
        {@const feature = layer?.feature}
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
              <p>Grid</p>
              <Segment value={grid.displayMode} onValueChange={(e) => (grid.displayMode = e.value)}>
                <Segment.Item value="off">Off</Segment.Item>
                <Segment.Item value="raw">Raw</Segment.Item>
                <Segment.Item value="processed">Processed</Segment.Item>
              </Segment>
            </div>

            <hr class="hr" />
            <div class="flex justify-between items-center gap-4">
              <p>Placement</p>
              <Segment value={placement.mode} onValueChange={(e) => (placement.mode = e.value)}>
                <Segment.Item value="off">Off</Segment.Item>
                <Segment.Item value="grid_coverage">Coverage</Segment.Item>
                <Segment.Item value="power_need">Consumption</Segment.Item>
              </Segment>
            </div>
            <!--
            {#if placement?.mode == 'power_need'}
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

      {#if grid?.highlightedGridPath}
        {@const info = grid.getHighlightedPathInfo()}
        {@const table = info.map((item) => ([item.label, item.value]))}
        <Control options={{position: 'bottomright'}} class="map-overlay-box">
          <div class="h4">Path info</div>
          <span class="text-xs text-surface-500">id: {grid.highlightedGridPath[0].feature.id}</span>
          {@render propertyTable(table)}
        </Control>
      {/if}
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
