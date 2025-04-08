<script lang="ts">
import { type Snippet } from 'svelte';
import { Control } from 'sveaflet';
import { type Icon } from '@lucide/svelte';

let {
  title,
  icon,
  classButton,
  classBody = "flex overflow-scroll max-h-[300px] card",
  visible = $bindable(true),
  open = $bindable(false),
  children,
}: {
  title?: string,
  icon: Icon,
  visible: boolean,
  open: boolean,
  classButton?: string,
  classBody: string;
  children?: Snippet,
  } = $props();

</script>

{#if visible}
  {@const ButtonIcon = icon}
  <Control options={{position: 'topright'}} class="map-info-box">
    <div class="flex grow h3 justify-between">
      {#if open}
        <span>{title}</span>
      {/if}
      <button type="button" class="btn btn-sm preset-outlined-surface-500 {classButton}"
        onclick={() => {open = !open}}>
        <ButtonIcon class="w-auto h-auto" />
      </button>
    </div>
    <hr class="hr" />
    
    {#if open}
      <div class="{classBody} m-2">
      {@render children?.()}
      </div>
    {/if}
  </Control>
{/if}

<style>
  :global(.map-info-box) {
    border: 2px solid gray;
    padding: 6px 8px;
    font:
      14px/16px Arial,
      Helvetica,
      sans-serif;
    background: rgba(0, 0, 0, 0.8);
    box-shadow: 0 0 15px rgba(0, 0, 0, 0.2);
    border-radius: 5px;
  }
</style>
