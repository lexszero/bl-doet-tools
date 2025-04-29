<script lang="ts">
import { type Snippet } from 'svelte';
import { Accordion, Switch } from '@skeletonlabs/skeleton-svelte';
import Slider from './Slider.svelte';
import { type IconType } from '$lib/Icons';

let {
  title,
  value,
  icon,
  opacity = $bindable(1),
  children
  }: {
    title: string,
    value: string,
    icon: IconType,
    classBody?: string,
    opacity?: number,
    children?: Snippet
  } = $props();
</script>

<Accordion.Item spaceY="space-y-1" value={value} panelPadding="px-4">
  {#snippet lead()}
    {@const LayerIcon = icon}
    <div class="flex flex-row">
      <LayerIcon />
    </div>
  {/snippet}

  {#snippet control()}{title}{/snippet}

  {#snippet panel()}
    <!--
    <div class="flex justify-between items-center gap-4">
      <p>Opacity</p>
      <Slider bind:value={opacity}
        min={0} max={1} step={0.05}
        />
    </div>
    -->

    {@render children?.()}
  {/snippet}
</Accordion.Item>
