<script lang="ts">
  import { Slider } from '@skeletonlabs/skeleton-svelte';
  import { fromUnixTime, getUnixTime } from 'date-fns';

  let {
    timeStart = $bindable(fromUnixTime(0)),
    timeEnd = $bindable(Date()),
    markers,
  } = $props();

  $inspect(markers);

  let rangeMin = $derived(Math.min.apply(null, markers) - 600);
  let rangeMax = $derived(Math.max(Math.max.apply(null, markers), getUnixTime(Date())));
  let value = $state([0, 100]);

  let displayMarkers = $derived(markers.map((m) => (m - rangeMin)/(rangeMax-rangeMin)*100));

  function changeEnd() {
    timeStart = fromUnixTime(rangeMin+(rangeMax-rangeMin)/100.0*value[0]);
    timeEnd = fromUnixTime(rangeMin+(rangeMax-rangeMin)/100.0*value[1]);
  }

</script>

{#snippet sliderMark(v)}
  <div>|</div>
{/snippet}

<p>Time travel</p>
<Slider name='TimeTravel'
  classes="p-3"
  value={value}
  markers={displayMarkers}
  onValueChange={(e) => (value = e.value)}
  onValueChangeEnd={changeEnd}
  mark={sliderMark}
/>
