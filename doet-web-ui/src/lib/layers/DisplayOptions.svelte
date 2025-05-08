<script lang="ts">
  import {getContext} from 'svelte';
  
  import { Accordion } from '@skeletonlabs/skeleton-svelte';
  import IconEyeOpen from '@lucide/svelte/icons/eye';
  import IconEyeClosed from '@lucide/svelte/icons/eye-closed';

  import {ProjectData} from '$lib/ProjectData.svelte';
  import {MapLayerControls} from './LayerController.svelte';
  import BasicLayerDisplayOptions from '$lib/controls/LayerDisplayOptions.svelte';

  const data = getContext<ProjectData>(ProjectData);

  let value = $derived(
    data.allControllers
    .filter((ctl) => ctl.displayOptions.visible)
    .map((ctl) => ctl.data.id)
    || []);

  function onValueChange(e) {
    console.log(e);
    for (const l of data.allLayers) {
      l.ctl.displayOptions.visible = (e.value.indexOf(l.id) >= 0);
    }
  }
</script>

<Accordion value={value} multiple onValueChange={onValueChange}>
  {#snippet iconOpen()}<IconEyeOpen />{/snippet}
  {#snippet iconClosed()}<IconEyeClosed />{/snippet}

  {#each data.allControllers as ctl}
    {@const LayerDisplayOptions = ctl.DisplayOptionsComponent}
    {#if LayerDisplayOptions}
      <hr class="hr border-t-4 border-surface-500" />
      <LayerDisplayOptions ctl={ctl} />
    {:else if ctl.options.controls !== MapLayerControls.Off}
      <hr class="hr border-t-4 border-surface-500" />
      <BasicLayerDisplayOptions value={ctl.id} title={ctl.data.layer.name} icon={ctl.data.layer.icon} />
    {/if}
  {/each}
</Accordion>

