<script lang="ts">
  import { type Snippet } from 'svelte';
  import { Popover } from '@skeletonlabs/skeleton-svelte';
  import { IconClose, type IconType } from '$lib/Icons';

  let {
    title,
    icon,
    trigger,
    content,
    ...restProps
  }: {
    title: string,
    icon: IconType,
    trigger: Snippet,
    content: Snippet
  } = $props()

  let openState = $state(false);
  function popoverClose() {
    openState = false;
  }
</script>

<Popover
  open={openState}
  onOpenChange={(e) => (openState = e.open)}
  positioning={{placement: 'bottom'}}
  triggerBase="btn preset-tonal-primary"
  contentBase="card p-2 preset-box"
  zIndex="2000"
  arrow
  arrowBackground="!bg-surface-100 dark:!bg-surface-900"
  trigger={trigger}
  {...restProps}
>
  {#snippet content()}
    <header class="flex items-center justify-between">
      <p class="font-bold">{title}</p>
      <button class="btn-icon hover:preset-tonal" onclick={popoverClose}><IconClose /></button>
    </header>
    {@render content?.()}
  {/snippet}
</Popover>
