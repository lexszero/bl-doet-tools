<script lang="ts">
  import { Slider } from '@skeletonlabs/skeleton-svelte';
  import { fromUnixTime, getUnixTime } from 'date-fns';
  import { TimeRange } from '$lib/utils/misc';

  let {
    timeRange = $bindable(new TimeRange(fromUnixTime(0), new Date())),
    markers,
  }: {
    timeRange: TimeRange,
    markers: number[]
  }= $props();

  $inspect(markers);

  let rangeMin = $derived(Math.min.apply(null, markers) - 600);
  let rangeMax = $derived(Math.max(Math.max.apply(null, markers), getUnixTime(Date())));
  let value = $state([0, 100]);

  let displayMarkers = $derived(markers.map((m) => (m - rangeMin)/(rangeMax-rangeMin)*100));

  function changeEnd() {
    timeRange = new TimeRange(
      fromUnixTime(rangeMin+(rangeMax-rangeMin)/100.0*value[0]),
      fromUnixTime(rangeMin+(rangeMax-rangeMin)/100.0*value[1])
      );
  }

</script>

{#snippet sliderMark(v)}
  <div>|</div>
{/snippet}

<Slider name='TimeTravel'
  classes="p-3 w-full"
  value={value}
  markers={displayMarkers}
  onValueChange={(e) => (value = e.value)}
  onValueChangeEnd={changeEnd}
  mark={sliderMark}
/>
