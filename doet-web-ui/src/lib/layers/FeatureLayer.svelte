<script lang="ts">
  import { getContext, onDestroy } from "svelte";

  import { GeoJSON } from 'sveaflet';
  import type { Geometry } from "geojson";

  import { ProjectData } from "$lib/ProjectData.svelte";

  import type { LayerData, Props } from "./LayerData.svelte";
  import type { BasicLayerDisplayOptions, LayerControllerOptions } from "./LayerController.svelte";

  let {
    mapRoot,
    layer,
    options,
  }: {
    mapRoot: L.Map,
    layer: LayerData<Geometry, Props>,
    options: Partial<LayerControllerOptions<BasicLayerDisplayOptions>>,
  } = $props();

  const data = getContext<ProjectData>(ProjectData);
  const ctl = data.initController(layer.id, mapRoot, options)

  onDestroy(() => {
    ctl.data.ctl = undefined;
  })
</script>

{#if ctl.data.features && ctl.displayOptions.visible}
  <GeoJSON
    json={{type: "FeatureCollection", features: [...ctl.features.values()]}}
    bind:instance={ctl.mapBaseLayer}
    options={ctl.mapLayerOptions()}
  />
{/if}

