import { type BasicLayerDisplayOptions } from '$lib/layers/LayerController.svelte';

export interface PowerGridDisplayOptions extends BasicLayerDisplayOptions {
  mode: 'size' | 'loss';
  loadPercent: number;
  showCoverage: boolean;
  scalePDU: number;
  scaleCable: number;
};
