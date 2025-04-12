<script lang="ts">
  import { browser } from '$app/environment'
  import { Map, TileLayer } from 'sveaflet';
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css'
  import "@geoman-io/leaflet-geoman-free";
  import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";

  import MapContent from '$lib/MapContent.svelte';
  import type { MapContentInterface } from '$lib/MapContent.svelte';


  L.PM.setOptIn(true);

  let {
    timeRange,
    instance = $bindable(),
  }: {
    timeRange: TimeRange,
    instance: MapContentInterface
  } = $props();

  let mapRoot: L.Map | undefined = $state();

  const mapOptions: L.MapOptions = {
    center: [57.62377, 14.92715],
    zoom: 15,
    zoomControl: false,
    attributionControl: false,
    pmIgnore: false,
  };

  const layerBasemapTileUrl = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
  const layerBasemapOptions = {
    minZoom: 0,
    maxZoom: 20,
    maxNativeZoom: 19,
    attribution: "© OpenStreetMap contributors",
  };
</script>

{#if browser}
  <Map options={mapOptions} bind:instance={mapRoot}>
    <TileLayer url={layerBasemapTileUrl} options={layerBasemapOptions}/>
    {#if mapRoot}
      <MapContent mapRoot={mapRoot} timeRange={timeRange} bind:instance={instance}/>
    {/if}
  </Map>
{/if}
