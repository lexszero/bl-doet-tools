<script lang="ts">
import { Switch } from '@skeletonlabs/skeleton-svelte';
import {
  EyeIcon,
  EyeOffIcon,
  ListCollapseIcon,
} from '@lucide/svelte';

let {
  title,
  icon,
  classBody = '',
  visible = $bindable(true),
  opacity = $bindable(1),
  openDrawer = $bindable(false),
  openDirection = 'down',
  children
} = $props();
</script>

{#snippet header()}
  {@const LayerIcon = icon}
  <div class="flex flex-row justify-between h5 gap-2 m-1">
    <div class="flex flex-row">
      <LayerIcon />
      <span>{title}</span>
    </div>
    <div class="flex flex-row gap-2 m-1">
      {#if children}
        <button type="button" class={["chip-icon", "preset-" + (openDrawer ? "filled" : "outline") + "-primary-500"]}
          onclick={() => {openDrawer = !openDrawer}}>
          <ListCollapseIcon class="w-auto h-auto" />
        </button>
      {/if}
      <Switch checked={visible} onCheckedChange={(e) => {visible = e.checked}} />
    </div>
  </div>
  {#if !openDrawer}<hr class="hr" />{/if}
{/snippet}


{#if openDirection == 'down'}
  {@render header()}
{/if}

{#if children && openDrawer}
  <div class={["flex flex-col overflow-scroll m-1 drawer-content", classBody]}>
  {@render children?.()}
  </div>
  <hr class="hr" />
{/if}

{#if openDirection == 'up'}
  {#if children}<hr class="hr" />{/if}
  {@render header()}
{/if}

<style>
  .drawer-contents {
    border: 1px solid gray;
    border-radius: 5px;
  }
</style>
