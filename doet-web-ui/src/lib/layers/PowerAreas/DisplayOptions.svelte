<script lang="ts">
  import LayerDisplayOptions from '$lib/controls/LayerDisplayOptions.svelte';
  import type { default as Controller } from './Controller.svelte';

  import Slider from '$lib/controls/Slider.svelte';
  import { Switch } from '@skeletonlabs/skeleton-svelte';
  import { IconPower } from '$lib/Icons';

  let { ctl }: { ctl: Controller } = $props();
</script>

<LayerDisplayOptions value={ctl.layerName} title="Power areas" icon={IconPower} bind:visible={ctl.displayOptions.visible}>
  <div class="flex justify-between items-center gap-4 p-1">
    <p>Show total power need</p>
    <Switch checked={ctl.displayOptions.showTotalPower}
      onCheckedChange={(e) => {ctl.displayOptions.showTotalPower = e.checked}}
      />
  </div>

  <div class="flex justify-between items-center gap-4 p-1">
    <p>Total power divider</p>
    <Slider bind:value={ctl.displayOptions.divTotalPower}
      min={1} max={10} step={1}
      markers={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
      >
    </Slider>
    <span>{ctl.displayOptions.divTotalPower}</span>
  </div>

</LayerDisplayOptions>
