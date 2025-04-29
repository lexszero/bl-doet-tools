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
  getSelectedFeature: (() => string | undefined);
  highlightFeature: ((id: string) => void);
  resetHighlight: (() => void);
  getCurrentDisplayOptions: (() => MapDisplayOptionsDTO);
};
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import L from 'leaflet';
  import { Control, GeoJSON, TileLayer } from 'sveaflet';
  import type {Geometry} from 'geojson';
  
  import PropertiesTable from '$lib/controls/PropertiesTable.svelte';
  import WarningsTable from '$lib/controls/PropertiesTable.svelte';
  import MapInfoBox from '$lib/controls/MapInfoBox.svelte';

  import type { LayerController, MapFeatureLayer } from './layers/LayerController.svelte';

  import { default as PowerAreasLayer } from '$lib/layers/PowerAreas/Controller.svelte';
  import { default as PowerGridLayer } from '$lib/layers/PowerGrid/Controller.svelte';
  import { default as PlacementLayer } from '$lib/layers/Placement/Controller.svelte';
  import { default as PlacementFeatureDetails } from '$lib/layers/Placement/FeatureDetails.svelte';

  import { type MapDisplayOptionsDTO } from '$lib/layers/types';

  import { TimeRange } from '$lib/utils/misc';

  import IconPathInfo from '@lucide/svelte/icons/waypoints';

  let {
    mapRoot,
    timeRange = new TimeRange(),
    instance = $bindable(),
    displayOptions,
  }: {
    mapRoot: L.Map,
    timeRange: TimeRange,
    instance: MapContentInterface,
    displayOptions?: MapDisplayOptionsDTO,
  } = $props();

  export function onClick(e: L.LeafletMouseEvent) {
    if (!instance)
      return;
    const layer = e.propagatedFrom;
    if (!layer) {
      resetSelectedFeature();
    } else {
      for (const ctl of Object.values(instance.layers)) {
        if (ctl.layerSelected && layer.feature?.id != ctl.layerSelected.feature.id)
          ctl.resetSelectedFeature();
      }
    }
  }

  let layerBasemap: L.TileLayer | undefined = $state();
 
  console.debug('init: displayOptions ', displayOptions)
 
  let layerPowerGrid = new PowerGridLayer(mapRoot, {onClick: onClick, initDisplayOptions: displayOptions?.PowerGrid});
  let layerPowerAreas = new PowerAreasLayer(mapRoot, {onClick: onClick, initDisplayOptions: displayOptions?.PowerAreas});
  let layerPlacement =  new PlacementLayer(mapRoot, {onClick: onClick, initDisplayOptions: displayOptions?.Placement});

  mapRoot.on('click', onClick);

  onMount(() => {
    console.debug("MapContent displayOptions: ", displayOptions);
    instance = {
      layers: {
        Placement: layerPlacement,
        PowerGrid: layerPowerGrid,
        PowerAreas: layerPowerAreas,
      },
      getFeature: getFeature,
      selectFeature: selectFeature,
      resetSelectedFeature: resetSelectedFeature,
      getSelectedFeature: getSelectedFeature,
      highlightFeature: highlightFeature,
      resetHighlight: resetHighlight,
      getCurrentDisplayOptions() {
        return {
          PowerGrid: layerPowerGrid.getDisplayOptions(),
          PowerAreasLayer: layerPowerAreas.getDisplayOptions(),
          Placement: layerPlacement.getDisplayOptions(),
        }
      }
    };
    if (displayOptions?.selected) {
      selectFeature(displayOptions.selected);
    }
  });

  layerPowerGrid.onDataChanged = () => {
    layerPlacement.updateStyle();
  }

  async function reload() {
    await Promise.all([
      layerPowerAreas.load(timeRange.start, timeRange.end),
      layerPowerGrid.load(timeRange.end),
      layerPlacement.load(timeRange.start, timeRange.end),
      ]);
    layerPowerAreas.updateStats(layerPlacement.features.values());
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
  let detailsGroup = $state('general');

  function getFeature(id?: string) {
    if (!id)
      return;
    for (const l of Object.values(instance.layers)) {
      if (l.features.has(id))
        return l.features.get(id);
    }
  }

  function getID(item: string | Feature<Geometry, object> | MapFeatureLayer<Geometry, object>): string | undefined {
    if (typeof item === 'string') {
      return item;
    }
    else if (typeof item === 'object') {
      return item.id || item.feature?.id;
    }
  }

  function getControllerFor(item?: string | Feature<Geometry, object> | MapFeatureLayer<Geometry, object>) {
    if (!item)
      return;
  
    const id = getID(item);
    if (!id)
      return;

    for (const l of Object.values(instance.layers)) {
      if (l.features.has(id))
        return l;
    }
  }

  function selectFeature(id: string) {
    getControllerFor(id)?.selectFeature(id, true);
  }

  function resetSelectedFeature() {
    for (const l of Object.values(instance.layers)) {
      l.resetSelectedFeature();
    }
  }

  function getSelectedFeature(): string | undefined {
    for (const l of Object.values(instance.layers)) {
      if (l.layerSelected) {
        return l.layerSelected.feature.id;
      }
    }
  }

  function highlightFeature(id: string) {
    getControllerFor(id)?.highlightFeature(id);
  }

  function resetHighlight() {
    details?.ctl.resetHighlightedFeature();
  }
</script>

<TileLayer bind:instance={layerBasemap} url={"https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"} />

{#each Object.values(instance?.layers || {}) as c}
  {@const options = c.mapLayerOptions()}
  {#key c.geojson}
    {#if c?.geojson && c.displayOptions.visible}
      <GeoJSON
        json={c.geojson}
        bind:instance={c.mapBaseLayer}
        options={options}
      />
    {/if}
  {/key}
{/each}

{#snippet featureInfoHeader(ctl: LayerController<Geometry, Named>, feature: Feature<Geometry, Named>, prefix?: string)}
  {@const FeatureIcon = ctl.featureIcon(feature)}
  {@const statusColor = ctl.featureColorForStatus(feature)}
  <div class="flex h5 justify-start">
    {#if prefix}
      <span>{prefix}</span>
    {/if}
    <FeatureIcon class="w-auto h-auto stroke-{statusColor}-500"/>
    <span> {feature.properties.name}</span>
  </div>
  <span class="text-xs text-surface-500 justify-end">id: {feature.id}</span>
{/snippet}

{#key details}
{#if details}
  {@const feature = details.layer.feature}
  <MapInfoBox open={true} visible={true} position='bottomleft' classBody="min-w-[200px] max-w-[500px]">
    {@render featureInfoHeader(details.ctl, feature)}
    {#if details.ctl == layerPlacement}
      <PlacementFeatureDetails ctl={layerPlacement} feature={details.layer.feature} onClickChip={selectFeature} />
    {:else}
      <PropertiesTable items={details.ctl.featureProperties(feature)} onClickChip={selectFeature} />
    {/if}
    {#if feature.properties._drc}
    <div class="flex">
      <WarningsTable items={feature.properties._drc} />
    </div>
    {/if}
  </MapInfoBox>
{:else}
  <MapInfoBox open={true} visible={true} position='bottomleft' classBody="max-w-[500px]">
    Hover over a feature to see details
  </MapInfoBox>
{/if}
{/key}

<MapInfoBox visible={(!!layerPowerGrid.layerSelected) || false} open={true} position="bottomright" classBody="max-w-[500px]" icon={IconPathInfo}>
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


