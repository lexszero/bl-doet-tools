<script lang="ts">
  import {getContext} from 'svelte';
  import { browser } from '$app/environment'
  import { Map } from 'sveaflet';

  import { LocateControl } from "leaflet.locatecontrol";
  import "leaflet.locatecontrol/dist/L.Control.Locate.min.css";

  import "@geoman-io/leaflet-geoman-free";
  import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";

  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css'

  import "leaflet.polylinemeasure";
  import "leaflet.polylinemeasure/Leaflet.PolylineMeasure.css";

  import MapContent, { type MapContentInterface } from '$lib/MapContent.svelte';
  import {ProjectData} from '$lib/ProjectData.svelte';

  import { coordsToLatLng } from '$lib/utils/geo';
  import { TimeRange } from '$lib/utils/misc';
  import { decompressFromEncodedURIComponent, } from 'lz-string';

  L.PM.setOptIn(true);

  let {
    content = $bindable(),
    showLocateControl = true,
    showRulerControl = true,
  }: {
    timeRange: TimeRange,
    content: MapContentInterface,
    showLocateControl: boolean,
    showRulerControl: boolean,
  } = $props();

  let map: L.Map | undefined = $state();
  let location: L.LocationEvent | undefined = $state();

  let data = getContext<ProjectData>(ProjectData);

  $effect(() => {
    if (!map)
      return;

    if (showLocateControl) {
      map.on('locationfound', (e) => {
        console.log(e)
        location = e;
      });
  
      const locateControl = new LocateControl();
      locateControl.addTo(map);
    }

    if (showRulerControl) {
      L.control.polylineMeasure({
        useSubunits: true,
        measureControlLabel: '&#128207;',
        measureControlTitleOn: 'Measure distance',
        measureControlTitleOff: 'Stop measurement',
      }).addTo(map);
    }
  });
  $inspect(data.mapOptions);

  const mapOptions: L.MapOptions = {
    center: coordsToLatLng(data.mapOptions.center),
    zoom: data.mapOptions.zoom,
    minZoom: data.mapOptions.minZoom,
    maxZoom: data.mapOptions.maxZoom,
    zoomControl: false,
    attributionControl: false,
    pmIgnore: false,
  };
  console.debug("Map options: ", mapOptions);

  const params = new URLSearchParams(window.location.search);
  const initDisplayOptionsEncoded = params.get('d') || '';
  const initDisplayOptions = {
    selected: params.get('selected'),
    position: params.get('position'),
    ...(initDisplayOptionsEncoded ? JSON.parse(decompressFromEncodedURIComponent(initDisplayOptionsEncoded)) : {})
    };
</script>

{#if browser}
  <Map options={mapOptions} bind:instance={map}>
    {#if map}
      <MapContent mapRoot={map} bind:instance={content} displayOptions={initDisplayOptions}/>
    {/if}
  </Map>
{/if}
