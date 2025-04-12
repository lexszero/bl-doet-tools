<script lang="ts">
  import LayerDisplayOptions from '$lib/controls/LayerDisplayOptions.svelte';

  import Segment from '$lib/controls/Segment.svelte';
  import { SegmentItem } from '$lib/controls/Segment.svelte';
  import { Slider } from '@skeletonlabs/skeleton-svelte';

  import type { default as Controller } from './Controller.svelte';
  import { IconPlacement, IconPDU, IconCable, IconPower, IconResistance, IconSound, IconRuler } from '$lib/Icons';
  import { Hash as IconNumber } from '@lucide/svelte';

  let { ctl }: { ctl: Controller } = $props();
</script>

<LayerDisplayOptions value={ctl.layerName} title="Placement" icon={IconPlacement}
  bind:visible={ctl.displayOptions.visible}
>
  <div class="flex justify-between items-center gap-4 p-1">
    <p>Color by</p>
    <Segment bind:value={ctl.displayOptions.mode}>
      <SegmentItem value="grid_n_pdus"><div class="flex flex-row"><IconPDU /><IconNumber /></div></SegmentItem>
      <SegmentItem value="grid_distance"><IconPDU /><IconRuler /></SegmentItem>
      <SegmentItem value="grid_loss"><IconCable /><IconResistance /></SegmentItem>
      <SegmentItem value="power_need"><IconPower /></SegmentItem>
      <SegmentItem value="sound"><IconSound /></SegmentItem>
    </Segment>
  </div>

  {#if ctl.displayOptions.mode == 'power_need'}
    <div class="flex justify-between items-center gap-4 p-1">
      <p>Power thresholds</p>
      <Slider value={ctl.displayOptions.powerNeedThresholds} onValueChangeEnd={(e) => {
        ctl.displayOptions.powerNeedThresholds = e.value as [number, number];
      }}
      min={0} max={20000} step={500} />
    </div>
  {:else if ctl.displayOptions.mode == 'grid_n_pdus'}
    <div class="flex justify-between items-center gap-4 p-1">
      <p>PDU range, m</p>
      <Slider value={[ctl.displayOptions.pduSearchRadius]} onValueChangeEnd={(e) => {
        ctl.displayOptions.pduSearchRadius = e.value[0];
      }}
      min={0} max={300} step={5} />
    </div>
  {/if}
</LayerDisplayOptions>
