<script lang="ts">
  import {getContext} from 'svelte';
  
  import { Accordion } from '@skeletonlabs/skeleton-svelte';
  import IconEyeOpen from '@lucide/svelte/icons/eye';
  import IconEyeClosed from '@lucide/svelte/icons/eye-closed';

  import type {MapContentInterface} from '$lib/MapContent.svelte';

  import PowerAreasDisplayOptions from './PowerAreas/DisplayOptions.svelte';
  import PowerGridDisplayOptions from './PowerGrid/DisplayOptions.svelte';
  import PlacementDisplayOptions from './Placement/DisplayOptions.svelte';

  const map = getContext<MapContentInterface>("Map");

  let value = $derived(
    Object.values(map?.layers)
    .filter((ctl) => ctl.displayOptions.visible)
    .map((ctl) => ctl.layerName)
    || []);

  function onValueChange(e) {
    console.log(e);
    for (const ctl of Object.values(map.layers)) {
      ctl.displayOptions.visible = (e.value.indexOf(ctl.layerName) >= 0);
    }
  }
</script>

<Accordion value={value} multiple onValueChange={onValueChange}>
  {#snippet iconOpen()}<IconEyeOpen />{/snippet}
  {#snippet iconClosed()}<IconEyeClosed />{/snippet}

  <PlacementDisplayOptions ctl={map.layers.Placement} />
  <hr class="hr" />
  <PowerAreasDisplayOptions ctl={map.layers.PowerAreas} />
  <hr class="hr" />
  <PowerGridDisplayOptions ctl={map.layers.PowerGrid} />
</Accordion>

