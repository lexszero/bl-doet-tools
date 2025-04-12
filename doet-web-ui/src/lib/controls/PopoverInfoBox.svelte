<script lang="ts">
  import { type Snippet } from 'svelte';
  import { Popover } from '@skeletonlabs/skeleton-svelte';
  import { IconClose, type IconType } from '$lib/Icons';

  let {
    title,
    icon,
    contentClasses,
    trigger,
    content,
    ...restProps
  }: {
    title: string,
    icon: IconType,
    contentClasses: string,
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
  triggerBase="btn preset-filled-surface-100-900"
  contentBase="card p-2 preset-box"
  zIndex="2000"
  arrow
  arrowBackground="!bg-surface-700 dark:!bg-surface-300"
  trigger={trigger}
  {...restProps}
>
  {#snippet content()}
    <header class="flex items-center justify-between">
      <p class="font-bold">{title}</p>
      <button class="btn-icon hover:preset-tonal" onclick={popoverClose}><IconClose /></button>
    </header>
    <div class={contentClasses}>
      {@render content?.()}
    </div>
  {/snippet}
</Popover>
