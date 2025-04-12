import { type BasicLayerDisplayOptions } from '$lib/layers/LayerController.svelte';

export interface PlacementDisplayOptions extends BasicLayerDisplayOptions {
    mode: 'power_need' | 'grid_n_pdus' | 'grid_distance' | 'grid_loss' | 'sound',
    powerNeedThresholds: [number, number],
    pduSearchRadius: number,
};
