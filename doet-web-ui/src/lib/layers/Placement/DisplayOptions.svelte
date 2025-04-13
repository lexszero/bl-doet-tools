<script lang="ts">
  import LayerDisplayOptions from '$lib/controls/LayerDisplayOptions.svelte';

  import Slider from '$lib/controls/Slider.svelte';
  import Segment from '$lib/controls/Segment.svelte';
  import { SegmentItem } from '$lib/controls/Segment.svelte';

  import type { default as Controller } from './Controller.svelte';
  import { type IconType, IconPlacement, IconPDU, IconCable, IconPower, IconResistance, IconSound, IconRuler } from '$lib/Icons';
  import { Hash as IconNumber } from '@lucide/svelte';

  import unitFormat from 'unitformat';

  let { ctl }: { ctl: Controller } = $props();
</script>

{#snippet segItemIcons(value: string, icons: IconType[])}
  <SegmentItem value={value}>
    <div class="flex flex-row">
      {#each icons as I}
        <I />
      {/each}
    </div>
  </SegmentItem>
{/snippet}

<LayerDisplayOptions value={ctl.layerName} title="Placement" icon={IconPlacement}>
  {@const mode = ctl.displayOptions.mode}
  <div class="flex justify-between items-center gap-4 p-1">
    <p>Color by</p>
    <Segment bind:value={ctl.displayOptions.mode}>
      {@render segItemIcons('grid_n_pdus', [IconPDU, IconNumber])}
      {@render segItemIcons('grid_distance', [IconPDU, IconRuler])}
      {@render segItemIcons('grid_loss', [IconCable, IconResistance])}
      <SegmentItem value="power_need"><IconPower /></SegmentItem>
      <SegmentItem value="sound"><IconSound /></SegmentItem>
    </Segment>
  </div>

  {#if mode == 'power_need'}
    <div class="flex justify-between items-center gap-4 p-1">
      <p>Power thresholds</p>
      <Slider bind:value={ctl.displayOptions.powerNeedThresholds}
        min={0} max={20000} step={500}
        markers={[0, 1000, 2000, 5000, 10000, 15000, 20000]}
      >
        {#snippet mark(v: number)}{unitFormat(v)}{/snippet}
      </Slider>
      <span>{ctl.displayOptions.powerNeedThresholds.map((v) => unitFormat(v, 'W'))}</span>
    </div>
  {:else if mode == 'grid_n_pdus' || mode == 'grid_distance'}
    <div class="flex justify-between items-center gap-4 p-1">
      <p>PDU range</p>
      <Slider bind:value={ctl.displayOptions.pduSearchRadius}
        min={0} max={200} step={5}
        markers={[0, 50, 100, 150, 200]}
        />
      <span>{ctl.displayOptions.pduSearchRadius}m</span>
    </div>
  {:else if mode == 'grid_loss'}
  {:else if mode == 'sound'}
    <div class="flex justify-between items-center gap-4 p-1">
      <p>Max sound power</p>
      <Slider bind:value={ctl.displayOptions.soundMax}
        min={0} max={10000} step={100}
        markers={[0, 1000, 2500, 5000, 7500, 10000]}
        >
        {#snippet mark(v: number)}{unitFormat(v)}{/snippet}
      </Slider>
    <span>{unitFormat(ctl.displayOptions.soundMax, 'W')}</span>
    </div>

  {/if}
</LayerDisplayOptions>
