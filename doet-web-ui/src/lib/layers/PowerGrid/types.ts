import { type BasicLayerDisplayOptions } from '$lib/layers/LayerController.svelte';

export interface PowerGridDisplayOptions extends BasicLayerDisplayOptions {
  mode: 'size' | 'loss';
  loadPercent: number;
  showCoverage: boolean;
  coverageRadius: number;
  scalePDU: number;
  scaleCable: number;
};
