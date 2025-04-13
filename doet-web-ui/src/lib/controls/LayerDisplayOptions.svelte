<script lang="ts">
import { type Snippet } from 'svelte';
import { Accordion, Switch } from '@skeletonlabs/skeleton-svelte';
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

<Accordion.Item value={value} panelPadding="px-4">
  {#snippet lead()}
    {@const LayerIcon = icon}
    <div class="flex flex-row">
      <LayerIcon />
    </div>
  {/snippet}

  {#snippet control()}{title}{/snippet}

  {#snippet panel()}
    {@render children?.()}
  {/snippet}
</Accordion.Item>
