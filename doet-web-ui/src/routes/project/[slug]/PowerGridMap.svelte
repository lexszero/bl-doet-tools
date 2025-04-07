<script lang="ts">
  import { browser } from '$app/environment'
  import { Segment, Switch, Combobox } from '@skeletonlabs/skeleton-svelte';
  import {Map, TileLayer, GeoJSON, Control, LayerGroup} from 'sveaflet?client';
  import 'leaflet/dist/leaflet.css'

  import { logLevelToColor, PowerGridLayer } from './PowerGridLayer.svelte';
  import { PlacementLayer } from './PlacementLayer.svelte';
  import { PowerAreasLayer } from './PowerAreasLayer.svelte';
  import { type InfoItem } from './InteractiveLayer.svelte';
	import {onMount} from 'svelte';
	import type {Feature} from '$lib/api';
	import type {Geometry} from 'geojson';

  import { Eye, TriangleAlert } from '@lucide/svelte';

  let {
    api,
    timeStart,
    timeEnd,
  } = $props();

  let showMapOptionsControl = $state(false);
  let showWarningsControl = $state(false);

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

  let warningsControlColor = $derived(grid._data?.log ? "warning" : undefined);

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

 function getFeatureProperties(feature: Feature<Geometry, any>) {
    let exclude = ['name', 'type'];
    return (Object.entries(feature.properties)
      .filter(([k, v]) => (!exclude.includes(k)))
      .map(([k, v]) => ({label: k, value: v} as InfoItem))
      )
  }
</script>

{#snippet featureInfoHeader(container, feature, prefix="")}
  {@const FeatureIcon = container.featureIcon(feature)}
  {@const statusColor = container.featureColorForStatus(feature)}
  <div class="flex grow h4 justify-start">
    <span>{prefix}</span>
    <FeatureIcon class="w-auto h-auto stroke-{statusColor}-500"/>
    <span> {feature.properties.name}</span>
  </div>
  <span class="text-xs text-surface-500">id: {feature.id}</span>
{/snippet}

{#snippet propertyTable(items: Array<InfoItem>)}
<table class="table">
  <tbody>
    {#each items as it}
      {@const Icon = it.icon}
      {#if it.value}
        <tr class={it.classes || ""}>
          <td>{#if Icon}<Icon />{/if}</td>
          <td>{it.label}</td>
          <td>{it.value}</td>
        </tr>
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
      {#if containerShowingDetails && containerShowingDetails.layerHighlighted}
        {@const c = containerShowingDetails}
        {@const feature = c.layerHighlighted?.feature}
        {@render featureInfoHeader(containerShowingDetails, feature)}
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
          <Eye class="w-2x h-2x"/>
        {/if}
      </Control>

      {#if warningsControlColor}
        <Control options={{position: 'topright'}} class="map-overlay-box grid card"
          onmouseenter={() => (showWarningsControl = true)}
          onmouseleave={() => (showWarningsControl = false)}
        >
          <div class="flex grow h4">
            <TriangleAlert class="w-auto h-auto stroke-{warningsControlColor}-500" />
            {#if showWarningsControl}
            <h5>Validation warnings</h5>
            {/if}
          </div>

          {#if showWarningsControl}
          <div class="flex overflow-scroll max-h-[500px] card">
            <table class="table">
              <tbody>
                {#each (grid._data?.log || []) as r}
                  {@const feature = r.item_id ? grid.features.get(r.item_id) : undefined}
                  {@const color = logLevelToColor(r.level)}
                  <tr class="fill-{color}-300 text-{color}-500">
                    <td><TriangleAlert class="stroke-{color}-500"/></td>
                    <td>
                      {#if feature}
                        <button type="button" class="btn btn-sm preset-outlined-surface-500"
                          onclick={() => {
                            grid.selectFeature(r.item_id);
                            grid.highlightFeature(r.item_id);
                            }}>{feature.properties.name}</button>
                      {:else}
                        {r.item_id}
                      {/if}
                    </td>
                    <td>{r.message}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
          {:else}
          {/if}
        </Control>
      {/if}

      {#if grid?.highlightedGridPath}
        {@const info = grid.getHighlightedPathInfo()}
        {@const feature = grid.highlightedGridPath[0].feature}
        <Control options={{position: 'bottomright'}} class="map-overlay-box">
          {@render featureInfoHeader(grid, feature, "⚡")}
          <span class="text-xs text-surface-500">id: {feature.id}</span>
          {@render propertyTable(info)}
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
