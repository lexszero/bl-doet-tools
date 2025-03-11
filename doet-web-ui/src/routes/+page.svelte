<script lang="ts">
  import { Segment } from '@skeletonlabs/skeleton-svelte';
  import PowerGridMap from "$lib/PowerGridMap.svelte";

  let mapEntitiesDisplayMode = $state('power_need');
</script>

<div class="flex gap-4 w-screen h-screen">
  <div class="w-3/4">
    <PowerGridMap entitiesDisplayMode={mapEntitiesDisplayMode}/>
  </div>
  <!--
  <div class="w-1/4">
    <Segment bind:value={mapEntitiesDisplayMode}>
      <Segment.Item value="off">Off</Segment.Item>
      <Segment.Item value="grid_coverage">Coverage</Segment.Item>
      <Segment.Item value="power_need">Consumption</Segment.Item>
    </Segment>
</div>
	/-->
</div>
