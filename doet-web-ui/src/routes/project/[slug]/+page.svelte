<script lang="ts">
  import type { PageProps } from './$types';
  import { Segment } from '@skeletonlabs/skeleton-svelte';
  import PowerGridMap from './PowerGridMap.svelte';

  let { data }: PageProps = $props();
  let mapEntitiesDisplayMode = $state('power_need');
</script>

<div class="flex gap-4 w-screen h-screen">
  <div class="w-3/4">
    <PowerGridMap data={data} entitiesDisplayMode={mapEntitiesDisplayMode}/>
  </div>
  <div class="w-1/4">
    <Segment value={mapEntitiesDisplayMode}>
      <Segment.Item value="off">Off</Segment.Item>
      <Segment.Item value="grid_coverage">Coverage</Segment.Item>
      <Segment.Item value="power_need">Consumption</Segment.Item>
    </Segment>
  </div>
</div>
