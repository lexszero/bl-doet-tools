<script lang="ts">
  import LayerDisplayOptions from '$lib/controls/LayerDisplayOptions.svelte';
  import Slider from '$lib/controls/Slider.svelte';
  import Segment from '$lib/controls/Segment.svelte';
  import { SegmentItem } from '$lib/controls/Segment.svelte';
  import { Switch } from '@skeletonlabs/skeleton-svelte';

  import type { default as Controller } from './Controller.svelte';
  import { IconPower } from '$lib/Icons';

  let { ctl }: { ctl: Controller } = $props();
</script>

<LayerDisplayOptions value={ctl.data.id} title="Power grid" icon={IconPower}>
  {@const mode = ctl.displayOptions.mode}

  <div class="flex justify-between items-center gap-4">
    <p>Show coverage</p>
    <Switch checked={ctl.displayOptions.showCoverage}
      onCheckedChange={(e) => {ctl.displayOptions.showCoverage = e.checked}}
      />
  </div>

  <div class="flex justify-between items-center gap-4">
    <p>Thickness</p>
    <Slider bind:value={ctl.displayOptions.scaleCable}
      min={0.5} max={3} step={0.1}
      />
  </div>

  <div class="flex justify-between items-center gap-4">
    <p>Color by</p>
    <Segment bind:value={ctl.displayOptions.mode}>
      <SegmentItem value="size">Cable size</SegmentItem>
      <SegmentItem value="loss">Loss</SegmentItem>
    </Segment>
  </div>

  {#if mode == 'loss'}
    <div class="flex justify-between items-center gap-4">
      <p>Grid load</p>
      <Slider bind:value={ctl.displayOptions.loadPercent}
        min={0} max={100} step={5}
        markers={[0, 25, 50, 75, 100]}
        />
    <span>{ctl.displayOptions.loadPercent}%</span>
    </div>
  {/if}

</LayerDisplayOptions>

