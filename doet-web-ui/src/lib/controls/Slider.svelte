<script lang="ts">
  import { Slider as SkeletonSlider } from '@skeletonlabs/skeleton-svelte';

  let {
    value = $bindable(),
    thumbMarkers = true,
    ...restProps
  }: {
    value: number | number[],
    thumbMarkers?: boolean,
  } = $props();


  function normalize(value) {
    const t = typeof value;
    if (t === 'number') {
      return [value]
    } else if (Array.isArray(value)) {
      return value;
    } else {
      throw new Error("Slider value could only be bound to a number or array of numbers")
    }
  }

  let sliderValue: number[] = $state(normalize(value));
</script>

<SkeletonSlider value={sliderValue}
  onValueChange={(e) => { sliderValue = e.value; }}
  onValueChangeEnd={() => {
    value = (sliderValue.length == 1) ? sliderValue[0] : sliderValue
  }}
  markText="text-xs"
  {...restProps}
  />
