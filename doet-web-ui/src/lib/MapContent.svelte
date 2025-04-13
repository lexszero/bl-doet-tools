<script module lang="ts">
import { type Feature } from '$lib/utils/geojson';
import { type Named } from '$lib/utils/types';

export interface MapContentInterface {
  layers: {
    Placement: PlacementLayer,
    PowerAreas: PowerAreasLayer,
    PowerGrid: PowerGridLayer,
  };
  getFeature: ((id?: string) => Feature<Geometry, any> | undefined);
  selectFeature: ((id: string) => void);
  resetSelectedFeature: (() => void);
  highlightFeature: ((id: string) => void);
  resetHighlight: (() => void);
};
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import L from 'leaflet';
  import { Control, GeoJSON } from 'sveaflet';
  import type {Geometry} from 'geojson';
  
  import PropertiesTable from '$lib/controls/PropertiesTable.svelte';
  import WarningsTable from '$lib/controls/PropertiesTable.svelte';
  import MapInfoBox from '$lib/controls/MapInfoBox.svelte';

  import type { LayerController } from './layers/LayerController.svelte';

  import { default as PowerAreasLayer } from '$lib/layers/PowerAreas/Controller.svelte';
  import { default as PowerGridLayer } from '$lib/layers/PowerGrid/Controller.svelte';
  import { default as PlacementLayer } from '$lib/layers/Placement/Controller.svelte';

  import { TimeRange } from '$lib/utils/misc';

  import {
    Waypoints as IconPathInfo,
  } from '@lucide/svelte';

  let {
    mapRoot,
    timeRange = new TimeRange(),
    instance = $bindable()
  }: {
    mapRoot: L.Map,
    timeRange: TimeRange,
    instance: MapContentInterface
  }= $props();

  let layerPowerGrid = new PowerGridLayer(mapRoot);
  let layerPowerAreas = new PowerAreasLayer(mapRoot);
  let layerPlacement =  new PlacementLayer(mapRoot);

  onMount(() => {
    instance = {
      layers: {
        Placement: layerPlacement,
        PowerGrid: layerPowerGrid,
        PowerAreas: layerPowerAreas,
      },
      getFeature: getFeature,
      selectFeature: selectFeature,
      highlightFeature: highlightFeature,
      resetHighlight: resetHighlight
    };
  });

  layerPowerGrid.onDataChanged = () => {
    layerPlacement.updateStyle();
  }

  async function reload() {
    await layerPowerAreas.load(timeRange.start, timeRange.end);
    await layerPowerGrid.load(timeRange.end);
    await layerPlacement.load(timeRange.start, timeRange.end);
  }

  $effect(async () => {
    if (timeRange)
      await reload();
  });

  let details = $derived(
    (layerPowerGrid.layerHighlighted) ? {ctl: layerPowerGrid, layer: layerPowerGrid.layerHighlighted}
    : (layerPlacement.layerSelected) ? {ctl: layerPlacement, layer: layerPlacement.layerSelected}
      : (layerPowerAreas.layerSelected) ? {ctl: layerPowerAreas, layer: layerPowerAreas.layerSelected}
        : (layerPlacement.layerHighlighted) ? {ctl: layerPlacement, layer: layerPlacement.layerHighlighted}
          : (layerPowerAreas.layerHighlighted) ? {ctl: layerPowerAreas, layer: layerPowerAreas.layerHighlighted}
            : undefined
  );

  function getFeature(id?: string) {
    if (!id)
      return;
    for (const l of Object.values(instance.layers)) {
      if (l.features.has(id))
        return l.features.get(id);
    }
  }

  function getControllerForFeature(id?: string) {
    if (!id)
      return;
    for (const l of Object.values(instance.layers)) {
      if (l.features.has(id))
        return l;
    }
  }

  function selectFeature(id: string) {
    getControllerForFeature(id)?.selectFeature(id, true);
  }

  function resetSelectedFeature() {
    for (const l of Object.values(instance.layers)) {
      l.resetSelectedFeature();
    }
  }

  function highlightFeature(id: string) {
    getControllerForFeature(id)?.highlightFeature(id);
  }

  function resetHighlight() {
    details?.ctl.resetHighlightedFeature();
  }
</script>

{#each Object.values(instance?.layers || {}) as c}
<LayerGroup layerType='overlay'>
  {#key c.geojson}
    {#if c?.geojson && c.displayOptions.visible}
      <GeoJSON
        json={c.geojson}
        bind:instance={c.mapBaseLayer}
        options={c.mapLayerOptions()}
      />
    {/if}
  {/key}
</LayerGroup>
{/each}

{#snippet featureInfoHeader(ctl: LayerController<Geometry, Named>, feature: Feature<Geometry, Named>, prefix?: string)}
  {@const FeatureIcon = ctl.featureIcon(feature)}
  {@const statusColor = ctl.featureColorForStatus(feature)}
  <div class="flex grow h5 justify-start">
    {#if prefix}
      <span>{prefix}</span>
    {/if}
    <FeatureIcon class="w-auto h-auto stroke-{statusColor}-500"/>
    <span> {feature.properties.name}</span>
  </div>
  <span class="text-xs text-surface-500 justify-end">id: {feature.id}</span>
{/snippet}

<Control options={{position: 'bottomleft'}} class="map-info-box max-w-[500px] m-2">
  {#if details}
    {@const feature = details.layer.feature}
    {@render featureInfoHeader(details.ctl, feature)}
    <div class="flex justify-start justify-items-start">
      <PropertiesTable items={details.ctl.featureProperties(feature)} onClickChip={selectFeature} />
    </div>
    {#if feature.properties._drc}
    <div class="flex">
      <WarningsTable items={feature.properties._drc} />
    </div>
    {/if}
  {:else}
    Hover over a feature to see details
  {/if}
</Control>

<MapInfoBox visible={(!!layerPowerGrid.layerSelected) || false} open={true} position="bottomright" icon={IconPathInfo} classBody="max-w-[500px]">
  {@const ctl = layerPowerGrid}
  {#if ctl.layerSelected}
    {@const feature = ctl.layerSelected.feature}
    {@render featureInfoHeader(ctl, feature, "⚡")}
    <PropertiesTable items={ctl.featureProperties(feature)}
      onClickChip={selectFeature}
      onHoverChip={highlightFeature}
      onUnhoverChip={resetHighlight}
      />
    <hr class="hr" />
    <div class="h5">Metrics</div>
    <PropertiesTable items={ctl.getHighlightedPathInfo()} />
  {/if}
</MapInfoBox>


