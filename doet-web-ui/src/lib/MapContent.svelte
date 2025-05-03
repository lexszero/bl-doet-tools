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

  import { ProjectData } from '$lib/ProjectData.svelte';
  import { featureCachedProps } from './layers/LayerData.svelte';
  import FeatureLayer from './layers/FeatureLayer.svelte';

  import { type MapDisplayOptionsDTO } from '$lib/layers/types';
  import type {AnyLayerController} from './layers/Layers';
  import type {BasicLayerDisplayOptions, LayerController} from './layers/LayerController.svelte.js';

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
  /*
  data.ready().then(() => {
    for (const l of data.allLayers) {
      data.initController(l.id, mapRoot, {
        ...layerControllerOptions,
        ...(displayOptions?.[l.id] || {})
      });
    }
  });
  */

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
        details?.ctl.resetHighlightedFeature();
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

  interface LayerItem<G extends Geometry, P extends Props> {
    ctl: LayerController<G, P, BasicLayerDisplayOptions>;
    feature: Feature<G, P>;
  }

  let details = $derived.by(() => {
    let priority = 0;
    let result: LayerItem<Geometry, Props> | undefined;
    if (!instance)
      return result;
    for (const ctl of data.allControllers) {
      if (ctl.layerHighlighted && ctl.options.priorityHighlight > priority) {
        result = {ctl: ctl, feature: ctl.layerHighlighted.feature};
        priority = ctl.options.priorityHighlight;
      }
      if (ctl.layerSelected && ctl.options.prioritySelect > priority) {
        result = {ctl: ctl, feature: ctl.layerSelected.feature};
        priority = ctl.options.prioritySelect;
      }
    }
    return result;
  });
  $inspect(details);

</script>

<TileLayer bind:instance={layerBasemap} url={"https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"} />

{#key data.layers}
  {#each data.allLayers as layer}
    <FeatureLayer
      mapRoot={mapRoot}
      layer={layer}
      displayOptions={{
        ...layerControllerOptions,
        ...displayOptions?.[layer.id]
    }} />
  {/each}
{/key}

{#snippet featureInfo(ctl: AnyLayerController, feature: Feature<Geometry, Props>)}
  {@const FeatureDetails = ctl.FeatureDetailsComponent}
  {@const FeatureIcon = ctl.featureIcon(feature)}
  {@const statusColor = ctl.featureColorForStatus(feature)}

  <div class="flex h6 justify-start items-center">
    <FeatureIcon size="16" class="stroke-{statusColor}-500"/>
    <span> {feature.properties.name}</span>
  </div>
  <span class="text-xs text-surface-500 justify-end">id: {feature.id}</span>

  {#if FeatureDetails}
    <FeatureDetails ctl={ctl} feature={feature} />
  {:else}
    <PropertiesTable items={ctl.featureProperties(feature)} onClickChip={instance.selectFeature} />
      {#if featureCachedProps(feature).log?.length}
        <div class="flex">
          <WarningsTable items={feature} />
        </div>
      {/if}
  {/if}
{/snippet}

{#if details}
  <MapInfoBox open={true} visible={true} position='bottomleft' classBody="min-w-[200px] max-w-[500px] md:max-w-full max-h-[40vh] overflow-auto">

    <!-- HACK: trying to work around Svelte bug.
    When `details` becomes `undefined`, this whole block should disappear,
    but because whatever was stored in `details` is now gone, $.get() wrappers
    fail causing a crash on teardown, despite this block is explicitly wrapped
    in `{#if details}`. 

    https://github.com/sveltejs/svelte/issues/14389
    -->
    {@render featureInfo(details.ctl, details.feature)}
  </MapInfoBox>
{/if}
