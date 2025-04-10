<script module lang="ts">
  import { Segment as SkeletonSegment } from '@skeletonlabs/skeleton-svelte';

  export const SegmentItem = SkeletonSegment.Item;
</script>

<script lang="ts">
  let {
    value = $bindable(),
    children
  } = $props();

  let segmentValue = $state(value);
  $effect(() => {
    segmentValue = value;
  })
</script>

<SkeletonSegment value={segmentValue} onValueChange={(e) => {
  value = e.value;
  }}>
  {@render children?.()}
</SkeletonSegment>


