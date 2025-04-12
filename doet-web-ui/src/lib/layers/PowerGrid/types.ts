import { type BasicLayerDisplayOptions } from '$lib/layers/LayerController.svelte';

export interface PowerGridDisplayOptions extends BasicLayerDisplayOptions {
  coloringMode: 'size' | 'loss';
  coloringLossAtLoadLevel: number;
  showCoverage: boolean;
};
