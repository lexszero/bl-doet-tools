<script lang="ts">
  import { browser } from '$app/environment'
  import { Map, TileLayer } from 'sveaflet';

  import { LocateControl } from "leaflet.locatecontrol";
  import "leaflet.locatecontrol/dist/L.Control.Locate.min.css";

  import "@geoman-io/leaflet-geoman-free";
  import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";

  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css'

  import "leaflet.polylinemeasure";
  import "leaflet.polylinemeasure/Leaflet.PolylineMeasure.css";

  import MapContent from '$lib/MapContent.svelte';
  import type { MapContentInterface } from '$lib/MapContent.svelte';

  import { TimeRange } from '$lib/utils/misc';

  L.PM.setOptIn(true);

  let {
    timeRange,
    content = $bindable(),
    locate = false
  }: {
    timeRange: TimeRange,
    content: MapContentInterface,
    locate: boolean
  } = $props();

  let map: L.Map | undefined = $state();
  let location: L.LocationEvent | undefined = $state();

  $effect(() => {
    if (!map)
      return;

    map.on('locationfound', (e) => {
      console.log(e)
      location = e;
    });

    const locateControl = new LocateControl();
    locateControl.addTo(map);

    L.control.polylineMeasure({
      useSubunits: true,
      measureControlLabel: '&#128207;',
      measureControlTitleOn: 'Measure distance',
      measureControlTitleOff: 'Stop measurement',
    }).addTo(map);
  });

  const mapOptions: L.MapOptions = {
    center: [57.62377, 14.92715],
    zoom: 15,
    minZoom: 0,
    maxZoom: 21,
    zoomControl: false,
    attributionControl: false,
    pmIgnore: false,
  };

  const layerBasemapTileUrl = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
  const layerBasemapOptions = {
    attribution: "© OpenStreetMap contributors",
  };
</script>

{#if browser}
  <Map options={mapOptions} bind:instance={map}>
    {#if map}
      <MapContent mapRoot={map} timeRange={timeRange} bind:instance={content}/>
    {/if}
  </Map>
{/if}
