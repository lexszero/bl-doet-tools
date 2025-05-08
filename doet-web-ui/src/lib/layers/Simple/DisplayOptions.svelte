<script lang="ts">
  import LayerDisplayOptions from '$lib/controls/LayerDisplayOptions.svelte';
  import { MapLayerControls } from '../LayerController.svelte';
  import type { default as Controller } from './Controller.svelte';

  let { ctl }: { ctl: Controller } = $props();
</script>

<LayerDisplayOptions value={ctl.data.id} title={ctl.data.layer.name} icon={ctl.data.layer.icon} bind:visible={ctl.displayOptions.visible}>
  {#if ctl.options.controls == MapLayerControls.Full}
    <div class="flex justify-between items-center gap-4">
      <p>Types</p>
      {#each ctl.featureTypes as t}
        {@const checked = ctl.displayOptions.types ? ctl.displayOptions.types.indexOf(t) >= 0 : true}
        <button
          class={["chip", checked ? "preset-filled-primary-500" : "preset-tonal-primary-500"]}
          onclick={() => {
            if (!ctl.displayOptions.types)
              ctl.displayOptions.types = [];
            const checked = ctl.displayOptions.types.indexOf(t) >= 0;
            if (checked) {
              ctl.displayOptions.types = ctl.displayOptions.types.filter((v) => v !== t);
            } else {
              ctl.displayOptions.types.push(t);
            }
          }}
        >{t}</button>
      {/each}
    </div>
  {/if}
</LayerDisplayOptions>
