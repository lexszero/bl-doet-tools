<script lang="ts">
  import LayerDisplayOptions from '$lib/controls/LayerDisplayOptions.svelte';
  import Segment from '$lib/controls/Segment.svelte';
  import { SegmentItem } from '$lib/controls/Segment.svelte';

  import type { default as Controller } from './Controller.svelte';
  import { IconPower } from '$lib/Icons';

  let { ctl }: { ctl: Controller } = $props();
</script>

<LayerDisplayOptions value={ctl.layerName} title="Power grid" icon={IconPower} bind:visible={ctl.displayOptions.visible}>
  <div class="flex justify-between items-center gap-4 p-1">
    <p>Color by</p>
    <Segment bind:value={ctl.displayOptions.coloringMode}>
      <SegmentItem value="size">Cable size</SegmentItem>
      <SegmentItem value="loss">Loss</SegmentItem>
    </Segment>
  </div>
</LayerDisplayOptions>

