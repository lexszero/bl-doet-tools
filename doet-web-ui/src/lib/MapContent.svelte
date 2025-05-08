<script module lang="ts">
import { type Feature } from '$lib/utils/geojson';
import type { Props } from './layers/LayerData.svelte.ts';
import type {Geometry} from 'geojson';

export interface MapContentInterface {
  getFeature: ((id?: string) => Feature<Geometry, Props> | undefined);
  selectFeature: ((id: string) => void);
  resetSelectedFeature: (() => void);
  getSelectedFeature: (() => string | undefined);
  highlightFeature: ((id: string) => void);
  resetHighlight: (() => void);
  getCurrentDisplayOptions: (() => MapDisplayOptionsDTO);
};
</script>

<script lang="ts">
  import { onMount, getContext } from 'svelte';
  import L from 'leaflet';
  import { TileLayer } from 'sveaflet';
  
  import PropertiesTable from '$lib/controls/PropertiesTable.svelte';
  import WarningsTable from '$lib/controls/PropertiesTable.svelte';
  import MapInfoBox from '$lib/controls/MapInfoBox.svelte';

  import type { LayerController, MapFeatureLayer } from './layers/LayerController.svelte';

  import { ProjectData } from '$lib/ProjectData.svelte';
  import { featureCachedProps } from './layers/LayerData.svelte';
  import FeatureLayer from './layers/FeatureLayer.svelte';
  import PlacementFeatureDetails from './layers/Placement/FeatureDetails.svelte';
  import PowerGridController from './layers/PowerGrid/Controller.svelte';

  import { type MapDisplayOptionsDTO } from '$lib/layers/types';

  import IconPathInfo from '@lucide/svelte/icons/waypoints';

  let {
    mapRoot,
    instance = $bindable(),
    displayOptions,
  }: {
    mapRoot: L.Map,
    instance: MapContentInterface,
    displayOptions?: MapDisplayOptionsDTO,
  } = $props();

  const data = getContext<ProjectData>(ProjectData);

  export function onClick(e: L.LeafletMouseEvent) {
    if (!instance)
      return;
    const layer = e.propagatedFrom;
    if (!layer) {
      instance.resetSelectedFeature();
    } else {
      for (const ctl of data.allControllers) {
        if (ctl.layerSelected && layer.feature?.id != ctl.layerSelected.feature.id)
          ctl.resetSelectedFeature();
      }
    }
  }

  let layerBasemap: L.TileLayer | undefined = $state();
 
  console.debug('init: displayOptions ', displayOptions)

  mapRoot.on('click', onClick);

  const layerControllerOptions = {
    onClick: onClick
  };

  onMount(() => {
    console.debug("MapContent displayOptions: ", displayOptions);
    instance = {
      getFeature(id?: string) {
        if (!id)
          return;
        for (const l of data.allLayers) {
          if (l.features.has(id))
            return l.features.get(id);
        }
      },
      selectFeature(id: string) {
        data.getControllerFor(id)?.selectFeature(id, true);
      },
      resetSelectedFeature() {
        for (const ctl of data.allControllers) {
          ctl.resetSelectedFeature();
        }
      },
      getSelectedFeature(): string | undefined {
        for (const ctl of data.allControllers) {
          if (ctl.layerSelected) {
            return ctl.layerSelected.feature.id;
          }
        }
      },
      highlightFeature(id: string) {
        data.getControllerFor(id)?.highlightFeature(id);
      },
      resetHighlight() {
        details?.data.ctl?.resetHighlightedFeature();
      },
      getCurrentDisplayOptions() {
        return Object.fromEntries(
          Object.entries(data.layers).map(
            ([name, d]) => ([name, d.ctl?.getDisplayOptions()])
          ));
      }
    };
    if (displayOptions?.selected) {
      instance.selectFeature(displayOptions.selected);
    }
  });

  interface LayerItem {
    data: AnyLayerData;
    layer: MapFeatureLayer<Geometry, object>;
  }

  let details = $derived.by(() => {
    let priority = 0;
    let result: LayerItem | undefined;
    if (!instance)
      return;
    for (const ctl of data.allControllers) {
      if (ctl.layerHighlighted && ctl.options.priorityHighlight > priority) {
        result = {data: ctl.data, layer: ctl.layerHighlighted};
        priority = ctl.options.priorityHighlight;
      }
      if (ctl.layerSelected && ctl.options.prioritySelect > priority) {
        result = {data: ctl.data, layer: ctl.layerSelected};
        priority = ctl.options.prioritySelect;
      }
    }
    return result;
  });

</script>

<TileLayer bind:instance={layerBasemap} url={"https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"} />

{#key data.layers}
  {#each data.allLayers as layer}
    <FeatureLayer
      mapRoot={mapRoot}
      layer={layer}
      options={{
        ...layerControllerOptions,
        initDisplayOptions: displayOptions?.[layer.id]
    }} />
  {/each}
{/key}

{#snippet featureInfoHeader(ctl: LayerController<Geometry, Named>, feature: Feature<Geometry, Named>, prefix?: string)}
  {@const FeatureIcon = ctl.featureIcon(feature)}
  {@const statusColor = ctl.featureColorForStatus(feature)}
  <div class="flex h6 justify-start">
    {#if prefix}
      <span>{prefix}</span>
    {/if}
    <FeatureIcon size="16" class="stroke-{statusColor}-500"/>
    <span> {feature.properties.name}</span>
  </div>
  <span class="text-xs text-surface-500 justify-end">id: {feature.id}</span>
{/snippet}

{#key details}
{#if details}
  {@const feature = details.layer.feature}
  <MapInfoBox open={true} visible={true} position='bottomleft' classBody="min-w-[200px] max-w-[500px]">
    {@render featureInfoHeader(details.data.ctl, feature)}
    {#if details.data == data.layers.placement}
      <PlacementFeatureDetails ctl={data.layers.placement?.ctl} feature={feature} onClickChip={instance.selectFeature} />
    {:else}
      <PropertiesTable items={details.data.ctl.featureProperties(feature)} onClickChip={instance.selectFeature} />
    {/if}
    {#if featureCachedProps(feature).log?.length}
    <div class="flex">
      <WarningsTable items={feature} />
    </div>
    {/if}
  </MapInfoBox>
{:else}
  <MapInfoBox open={true} visible={true} position='bottomleft' classBody="max-w-[500px]">
    Hover over a feature to see details
  </MapInfoBox>
{/if}
{/key}

{#if data.layers.power_grid?.ctl?.layerSelected}
<MapInfoBox visible={true} open={true} position="bottomright" classBody="max-w-[500px]" icon={IconPathInfo}>
  {@const ctl: PowerGridController = data.layers.power_grid.ctl}
  {#if ctl.layerSelected}
    {@const feature = ctl.layerSelected.feature}
    {@render featureInfoHeader(ctl, feature, "⚡")}
    <PropertiesTable items={ctl.featureProperties(feature)}
      onClickChip={instance.selectFeature}
      onHoverChip={instance.highlightFeature}
      onUnhoverChip={instance.resetHighlight}
      />
    <hr class="hr" />
    <div class="h5">Metrics</div>
    <PropertiesTable items={ctl.getHighlightedPathInfo()} />
  {/if}
</MapInfoBox>
{/if}


