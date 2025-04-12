<script lang="ts">
  import LayerDisplayOptions from '$lib/controls/LayerDisplayOptions.svelte';
  import type { default as Controller } from './Controller.svelte';
  import { IconPower } from '$lib/Icons';

  let { ctl }: { ctl: Controller } = $props();
</script>

<LayerDisplayOptions value={ctl.layerName} title="Power areas" icon={IconPower} bind:visible={ctl.displayOptions.visible} />
