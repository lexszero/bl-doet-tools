<script lang="ts">
  import * as slider from '@zag-js/slider';
  import { normalizeProps, useMachine } from '@zag-js/svelte';

  import { fromUnixTime, getUnixTime, format } from 'date-fns';
  import { TimeRange } from '$lib/utils/misc';

  /*
  import {
    ArrowLeftToLine as IconBackToStart,
    ChevronLeft as IconBack1,
    ChevronsLeft as IconBack2,
    ChevronRight as IconForward1,
    ChevronsRight as IconForward2,
    ArrowRightToLine as IconForwardToEnd
  } from '@lucide/svelte';
  */

  let {
    timeRange = $bindable(new TimeRange(fromUnixTime(0), new Date())),
    markers,
  }: {
    timeRange: TimeRange,
    markers: number[]
  }= $props();

  function formatUnixTime(t: number) {
    return format(fromUnixTime(t), 'MMM d yyyy, HH:mm');
  }

  /*
  function debugRange(label: string) {
    return (t: 'init' | 'update', v: number[]) => {
      const d = v.map((v) => {
        try {
          return formatUnixTime(v);
        }
        catch (err) {
          return "error";
        }
      });
      console.debug(`${label} ${t}: ${v[0]} - ${v[1]} | ${d[0]} - ${d[1]}`)
    };
  }

  $inspect(selectedRange).with(debugRange('selected'))
  $inspect(visibleRange).with(debugRange('visible'))
  */
  
  let fullRange = [
    Math.min.apply(null, markers) - 600,
    Math.max(Math.max.apply(null, markers), getUnixTime(Date()))
  ];

  const sliderMax = 1000;
  let visibleRange = $state(fullRange);
  let selectedRange = $state([getUnixTime(timeRange.start), getUnixTime(timeRange.end)]);

  function setVisibleRange(start: number, end: number) {
    visibleRange = [start, end];
  }

  function moveVisibleRange(delta: number) {
    let [start, end] = visibleRange;
    const length = end - start;
    if (delta > 0) {
      end = Math.min(end + delta, fullRange[1]);
      start = end - length;
    }
    else {
      start = Math.max(start + delta, fullRange[0]);
      end = start + length;
    }
    setVisibleRange(start, end);
  }

  setVisibleRange(fullRange[0], fullRange[1]);

  function timestampToSlider(t: number) {
    return (t - visibleRange[0])/(visibleRange[1]-visibleRange[0])*sliderMax;
  }

  function sliderToTimestamp(t: number) {
    return visibleRange[0]+(visibleRange[1]-visibleRange[0])/sliderMax*t;
  }

  interface Marker {
    position: number;
    label: string;
  }

  let dataMarkers = $derived(
    markers.filter(
      (m) => (m >= visibleRange[0] && m <= visibleRange[1])
    ).map(
      (m) => ({
        position: timestampToSlider(m)
      } as Marker)
    )
  );

  let timeMarkers = $derived.by(() => ([
    {
      position: 0,
      label: formatUnixTime(visibleRange[0])
    },
    {
      position: sliderMax,
      label: formatUnixTime(visibleRange[1])
    }
  ]));

  let value = $state([0, sliderMax]);

  let firstKnobIsEnd = $state(false);
  let dir: 'rtl'|'ltr' = $derived((value.length < 2 && !firstKnobIsEnd) ? 'rtl' : 'ltr');

  $effect(() => {
    let knobs = [];
    let k = false;
    if (visibleRange[0] <= selectedRange[0]) {
      knobs.push(timestampToSlider(selectedRange[0]))
    }
    if (visibleRange[1] >= selectedRange[1]) {
      knobs.push(timestampToSlider(selectedRange[1]))
      if (knobs.length == 1) {
        k = true;
      }
    }
    value = knobs;
    firstKnobIsEnd = k;
  });

  const service = useMachine(slider.machine, () => ({
    min: 0, max: sliderMax, dir,
    value,
    onValueChange(e) { value = e.value },
    onValueChangeEnd() {
      selectedRange = [
        firstKnobIsEnd
          ? selectedRange[0]
          : sliderToTimestamp(value[0]),
        firstKnobIsEnd
          ? sliderToTimestamp(value[0])
          : (value.length == 2)
            ? sliderToTimestamp(value[1])
            : value[1]
      ];
      timeRange = new TimeRange(
        fromUnixTime(selectedRange[0]),
        fromUnixTime(selectedRange[1])
      )
    }
  }));
  const api = $derived(slider.connect(service, normalizeProps));

  const navBtnClass = "chip preset-outlined-primary-500";
  const navBtnIconClass = "chip-icon preset-outlined-primary-500";
</script>


<div class="flex flex-col w-full">
  <div class="flex flex-row justify-between w-full grid-cols-[auto_1fr_auto]">
    <div>
      <!--
      <button class={navBtnIconClass}
        onclick={() => setVisibleRange(fullRange[0], fullRange[0] + (visibleRange[1] - visibleRange[0]))}
      ><IconBackToStart /></button>
      <button class={navBtnIconClass}
        onclick={() => moveVisibleRange(-86400*7)}
      ><IconBack2 /></button>
      <button class={navBtnIconClass}
        onclick={() => moveVisibleRange(-86400)}
      ><IconBack1 /></button>
    -->
    </div>

    <div>
      <button class={navBtnClass}
        onclick={() => {setVisibleRange(...fullRange)}}
      >All time</button>
  
      <button class={navBtnClass}
        onclick={() => {setVisibleRange(fullRange[1] - 86400*7, fullRange[1])}}
      >Last week</button>
  
      <button class={navBtnClass}
        onclick={() => {setVisibleRange(fullRange[1] - 86400, fullRange[1])}}
      >Last day</button>
    </div>
    
    <div>
    <!--
      <button class={navBtnIconClass}
        onclick={() => moveVisibleRange(86400)}
      ><IconForward1 /></button>
      <button class={navBtnIconClass}
        onclick={() => moveVisibleRange(86400*7)}
      ><IconForward2 /></button>
      <button class={navBtnIconClass}
        onclick={() => setVisibleRange(fullRange[1] - (visibleRange[1] - visibleRange[0]), fullRange[1])}
      ><IconForwardToEnd /></button>
    -->
    </div>
  </div>


  {#key dataMarkers}
    <div {...api.getRootProps()} class="w-full min-h-content bg-green h-1 pt-7 pb-8 px-10 w-full">
      <div {...api.getControlProps()}>
        <div {...api.getTrackProps()} class="overflow-hidden bg-surface-200-800 h-1 rounded-full">
          <div {...api.getRangeProps()} class="h-1 bg-surface-950-50 rounded-container"></div>
        </div>
        <div class="h-1" style="display: flex; align-items: center; transform: translateY(-100%);">
          {#each api.value as value, index}
            <div {...api.getThumbProps({ index })}>
              <div
                class="ring-inset transition-scale duration-100 ease-in-out size-8 md:size-5 bg-surface-50-950 ring-2 ring-surface-950-50 rounded-full"
              ></div>
              <input {...api.getHiddenInputProps({ index })} />
            </div>
            <div {...api.getThumbProps({ index })}>
              <div class="w-content text-nowrap text-xs -translate-y-full">{formatUnixTime(sliderToTimestamp(value))}</div>
            </div>
          {/each}
        </div>
      </div>
      {#if dataMarkers.length > 0}
        <div {...api.getMarkerGroupProps()}>
          {#each dataMarkers as marker}
            <!-- Mark -->
            <span {...api.getMarkerProps({ value: marker.position })} class="text-xs opacity-50">|</span>
          {/each}
        </div>
        <div {...api.getMarkerGroupProps()} class="w-content text-nowrap text-xs translate-y-3 items-center-safe">
          {#each timeMarkers as marker, i}
            {@const align = 
              (i == 0) ? 'self-end' :
              (i == timeMarkers.length-1) ? 'self-start' :
              ''}
            <div {...api.getMarkerProps({ value: marker.position })} class="absolute {align}">{marker.label}</div>
          {/each}
        </div>
      {/if}
    </div>
  {/key}
</div>
