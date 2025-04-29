import type {GridFeature} from "./types";

interface StyleWeightColor {
  weight: number;
  color: string;
}

interface GridItemSizeData {
  phases: 3 | 1;
  max_amps: number;
  pdu_fractionLoad: number;
  ohm_per_km: number;
  style: StyleWeightColor;
}

const gridItemSizeData = {
  '250': {
    phases: 3,
    max_amps: 250,
    pdu_fractionLoad: 0.01,
    ohm_per_km: 0.366085,
    style: {
      weight: 6,
      color: '#B50E85',
    }
  },
  '125': {
    phases: 3,
    max_amps: 125,
    pdu_fractionLoad: 0.2,
    ohm_per_km: 0.522522,
    style: {
      weight: 5,
      color: '#C4162A',
    }
  },
  '63': {
    phases: 3,
    max_amps: 63,
    pdu_fractionLoad: 0.3,
    ohm_per_km: 1.14402,
    style: {
      weight: 4,
      color: '#F2495C',
    }
  },
  '32': {
    phases: 3,
    max_amps: 32,
    pdu_fractionLoad: 0.5,
    ohm_per_km: 3.05106,
    style: {
      weight: 3,
      color: '#FF9830',
    }
  },
  '16': {
    phases: 3,
    max_amps: 16,
    pdu_fractionLoad: 0.8,
    ohm_per_km: 7.32170,
    style: {
      weight: 2,
      color: '#FADE2A'
    }
  },
  '1f': {
    phases: 1,
    max_amps: 16,
    ohm_per_km: 7.32170,
    style: {
      weight: 1,
      color: '#5794F2'
    }
  },
  'unknown': {
    phases: undefined,
    max_amps: undefined,
    ohm_per_km: undefined,
    style: {
      weight: 5,
      color: '#FF0000'
    }
  },
};

export function getGridItemSizeInfo(f: GridFeature) {
  return gridItemSizeData[f.properties.power_size] as GridItemSizeData;
}

export const gridItemSizes = ['250', '125', '63', '32', '16', '1f'];
export function gridItemSizeLE(a: string, b: string) {
  return gridItemSizes.indexOf(a) >= gridItemSizes.indexOf(b);
}

export const Vref_LL = 400;
export const Vref_LN = Vref_LL / Math.sqrt(3);
