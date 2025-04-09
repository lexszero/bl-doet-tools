<script lang="ts">
  import { browser } from '$app/environment'
  import { Segment, Switch, Slider, Combobox } from '@skeletonlabs/skeleton-svelte';
  import {Map, TileLayer, GeoJSON, Control, LayerGroup} from 'sveaflet';
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css'
  import "@geoman-io/leaflet-geoman-free";
  import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";

  import MapInfoBox from './MapInfoBox.svelte';
  import { logLevelToColor, PowerGridLayer } from './PowerGridLayer.svelte';
  import { PlacementLayer } from './PlacementLayer.svelte';
  import { PowerAreasLayer } from './PowerAreasLayer.svelte';
  import { type InfoItem } from './InteractiveLayer.svelte';

  import { Info as IconInfo, Waypoints as IconPathInfo, Eye, TriangleAlert } from '@lucide/svelte';

  L.PM.setOptIn(false);

  let {
    api,
    timeStart,
    timeEnd,
  } = $props();

  let mapRoot: L.Map = $state();

  $effect(() => {
    if (!mapRoot)
      return;
    mapRoot.on("pm:create", (e) => {
      console.log("pm:create: ", e);
      e.layer.options.pmIgnore = false;
    });
  });


  let layerSelected = $state();

  let grid: PowerGridLayer = new PowerGridLayer(api);
  let areas: PowerAreasLayer = new PowerAreasLayer(grid);
  let placement: PlacementLayer = new PlacementLayer(grid);

  grid.onDataChanged = () => {
    if (grid.layerHighlighted) {
      grid.layerHighlighted = grid.layerHighlighted;
    }
    if (grid.layerSelected) {
      grid.selectFeature(grid.layerSelected.feature.id);
    }
    placement.updateStyle();
  };

  $effect(async () => {
    await areas.load(timeStart, timeEnd);
    await grid.load(timeEnd);
    await placement.load(timeStart, timeEnd);
  });

  $effect(() => {
    areas.mapRoot = mapRoot;
    grid.mapRoot = mapRoot;
    placement.mapRoot = mapRoot;
  })

  let searchItems = $derived([...grid.searchItems, ...placement.searchItems]);

  let details = $derived.by(() => (
    (grid.layerHighlighted) ? {container: grid, layer: grid.layerHighlighted}
        : (placement.layerSelected) ? {container: placement, layer: placement.layerSelected}
          : (areas.layerSelected) ? {container: areas, layer: areas.layerSelected}
            : (placement.layerHighlighted) ? {container: placement, layer: placement.layerHighlighted}
              : (areas.layerHighlighted) ? {container: areas, layer: areas.layerHighlighted}
                : undefined
        ));

  const mapOptions = {
    center: [57.62377, 14.92715],
    zoom: 15,
    zoomControl: false,
    attributionControl: false
  };

  const layerBasemapTileUrl = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
  const layerBasemapOptions = {
    minZoom: 0,
    maxZoom: 20,
    maxNativeZoom: 19,
    attribution: "© OpenStreetMap contributors",
  };

  let searchValue = $state();

  function selectFeature(id?: string) {
    if (!id)
      return;
    if (grid.features.has(id)) {
      grid.selectFeature(id);
    }
    else if (placement.features.has(id)) {
      placement.selectFeature(id);
    }
  }
</script>

{#snippet featureInfoHeader(container, feature, prefix="")}
  {@const FeatureIcon = container.featureIcon(feature)}
  {@const statusColor = container.featureColorForStatus(feature)}
  <div class="flex grow h3 justify-start">
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
      {#if it.chips || it.value}
        <tr class={`justify-items-start ${it.classes}`}>
          <td>{#if Icon}<Icon />{/if}</td>
          <td>{it.label}</td>
          <td>
            {#if it.selectId}
              <button type="button" class="btn btn-sm preset-outlined-surface-500"
                onclick={() => selectFeature(it.selectId)}>{it.value}</button>
            {:else if it.chips}
              {#each it.chips as chip}
                <button type="button" class="chip preset-outlined-surface-500"
                  onclick={() => {if (chip.id) selectFeature(chip.id); }}>
                  {chip.label}
                </button>
              {/each}
            {/if}
            {#if it.value}
              <span>{it.value}</span>
            {/if}
          </td>
        </tr>
      {/if}
    {/each}
  </tbody>
</table>
{/snippet}

{#snippet warningsTable(items: ItemizedLogEntry[])}
<table class="table">
  <tbody>
    {#each (items || []) as r}
      {@const feature = r.item_id ? grid.features.get(r.item_id) : undefined}
      {@const color = logLevelToColor(r.level)}
      <tr class="fill-{color}-300 text-{color}-500">
        <td><TriangleAlert class="stroke-{color}-500"/></td>
        <td>
          {#if feature}
            <button type="button" class="btn btn-sm preset-outlined-surface-500"
              onclick={() => selectFeature(feature.id)}>{feature.properties.name}</button>
          {:else}
            {r.item_id}
          {/if}
        </td>
        <td>{r.message}</td>
      </tr>
    {/each}
  </tbody>
</table>
{/snippet}

{#if browser}
  <Map options={mapOptions} bind:instance={mapRoot}>
    <TileLayer url={layerBasemapTileUrl} options={layerBasemapOptions}/>

      <LayerGroup name='Areas' layerType='overlay' checked={true}>
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
      <LayerGroup name='Placement' layerType='overlay' checked={placement?.mode != 'off'}>
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

      <LayerGroup name='Power grid' layerType='overlay' checked={true}>
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

    <Control options={{position: 'topleft'}} class="flex map-info-box">
    {#key searchItems}
      <Combobox
        data={searchItems}
        value={searchValue}
        onValueChange={(e) => selectFeature(e.value[0])}
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

    <MapInfoBox title="Display options" position="topright" icon={Eye}
      classBody="grid">
      <div class="flex justify-between items-center gap-4 p-1">
        <p>Show grid coverage</p>
        <Switch checked={grid.showCoverage} onCheckedChange={(e) => (showGridCoverage = e.checked)} />
      </div>

      <hr class="hr" />
      <div class="flex justify-between items-center gap-4 p-1">
        <p>Grid</p>
        <Segment value={grid.displayMode} onValueChange={(e) => (grid.displayMode = e.value)}>
          <Segment.Item value="off">Off</Segment.Item>
          <Segment.Item value="raw">Raw</Segment.Item>
          <Segment.Item value="processed">Processed</Segment.Item>
        </Segment>
      </div>

      <div class="flex justify-between items-center gap-4 p-1">
        <p>Grid coloring</p>
        <Segment value={grid.coloringMode} onValueChange={(e) => (grid.coloringMode = e.value)}>
          <Segment.Item value="size">Cable size</Segment.Item>
          <Segment.Item value="loss">Loss</Segment.Item>
        </Segment>
      </div>

      {#if grid.coloringMode == 'loss'}
      {/if}

      <hr class="hr" />

      <div class="flex justify-between items-center gap-4 p-1">
        <p>Placement</p>
        <Segment value={placement.mode} onValueChange={(e) => (placement.mode = e.value)}>
          <Segment.Item value="off">Off</Segment.Item>
          <Segment.Item value="grid_n_pdus"># PDUs</Segment.Item>
          <Segment.Item value="grid_distance">Distance to PDU</Segment.Item>
          <Segment.Item value="grid_loss">Path resistance</Segment.Item>
          <Segment.Item value="power_need">Consumption</Segment.Item>
        </Segment>
      </div>



      {#if placement?.mode == 'power_need'}
        <div class="flex justify-between items-center gap-4 p-1">
          <p>Power thresholds</p>
          <Slider value={placement.powerNeedThresholds} onValueChangeEnd={(e) => {
            placement.powerNeedThresholds = e.value as [number, number];
            }}
            min={0} max={20000} step={500} />
        </div>
      {:else if placement.mode == 'grid_n_pdus'}
         <div class="flex justify-between items-center gap-4 p-1">
          <p>PDU range, m</p>
          <Slider value={[placement.pduSearchRadius]} onValueChangeEnd={(e) => {
            placement.pduSearchRadius = e.value[0];
            }}
            min={0} max={300} step={5} />
        </div>

      {/if}
    </MapInfoBox>

    <MapInfoBox title="Warnings" position="topright" icon={TriangleAlert} classBody="max-h-[500px]">
      {@render warningsTable(grid.data.log)}
    </MapInfoBox>

    <MapInfoBox title="Statistics" position="topright" icon={IconInfo}>
      {@render propertyTable(grid.getStatistics())}
    </MapInfoBox>

    <Control options={{position: 'bottomleft'}} class="map-info-box max-w-[500px] m-2">
      {#if details}
        {@const {container, layer} = details}
        {@const feature = layer.feature}
        {@render featureInfoHeader(container, feature)}
        <div class="flex justify-start justify-items-start">
          {@render propertyTable(container.featureProperties(feature))}
        </div>
        {#if feature.properties._drc}
        <div class="flex">
          {@render warningsTable(feature.properties._drc)}
        </div>
        {/if}
      {:else}
        Hover over a feature to see details
      {/if}
    </Control>

    <MapInfoBox visible={grid?.layerSelected || false} open={true} position="bottomright" icon={IconPathInfo} classBody="max-w-[500px]">
      {#if grid?.layerSelected}
        {@const feature = grid.layerSelected.feature}
        {@render featureInfoHeader(grid, feature, "⚡")}
        {@render propertyTable(grid.featureProperties(feature))}
        <hr class="hr" />
        <div class="h5">Metrics</div>
        {@render propertyTable(grid.getHighlightedPathInfo())}
      {/if}
    </MapInfoBox>
  </Map>
{/if}
