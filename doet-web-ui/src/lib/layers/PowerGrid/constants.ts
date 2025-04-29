import {
  type GridFeature,
  PowerPlugType
} from "./types";

interface StyleWeightColor {
  weight: number;
  color: string;
}

type NPhase = 3 | 1;
const ThreePhase: NPhase = 3;
const SinglePhase: NPhase = 1;

interface GridItemSizeData {
  phases: NPhase;
  max_amps: number;
  pdu_fractionLoad: number;
  ohm_per_km: number;
  style: StyleWeightColor;
}

const gridItemSizeData = {
  '250': {
    phases: ThreePhase,
    max_amps: 250,
    pdu_fractionLoad: 0.01,
    ohm_per_km: 0.366085,
    style: {
      weight: 6,
      color: '#B50E85',
    }
  },
  '125': {
    phases: ThreePhase,
    max_amps: 125,
    pdu_fractionLoad: 0.2,
    ohm_per_km: 0.522522,
    style: {
      weight: 5,
      color: '#C4162A',
    }
  },
  '63': {
    phases: ThreePhase,
    max_amps: 63,
    pdu_fractionLoad: 0.3,
    ohm_per_km: 1.14402,
    style: {
      weight: 4,
      color: '#F2495C',
    }
  },
  '32': {
    phases: ThreePhase,
    max_amps: 32,
    pdu_fractionLoad: 0.5,
    ohm_per_km: 3.05106,
    style: {
      weight: 3,
      color: '#FF9830',
    }
  },
  '16': {
    phases: ThreePhase,
    max_amps: 16,
    pdu_fractionLoad: 0.8,
    ohm_per_km: 7.32170,
    style: {
      weight: 2,
      color: '#FADE2A'
    }
  },
  '1f': {
    phases: SinglePhase,
    max_amps: 16,
    ohm_per_km: 7.32170,
    pdu_fractionLoad: 1,
    style: {
      weight: 1,
      color: '#5794F2'
    }
  },
  'unknown': {
    phases: ThreePhase,
    max_amps: 0,
    ohm_per_km: Infinity,
    pdu_fractionLoad: 0,
    style: {
      weight: 5,
      color: '#FF0000'
    }
  },
};

export function getGridItemSizeInfo(f: GridFeature) {
  return gridItemSizeData[f.properties.power_size] as GridItemSizeData;
}

export function getPlugTypeInfo(t: PowerPlugType): GridItemSizeData {
  switch (t) {
    case PowerPlugType.SinglePhase_Schuko:
    case PowerPlugType.SinglePhase_Danish:
    case PowerPlugType.SinglePhase_CEE:
      return gridItemSizeData['1f'];
    case PowerPlugType.ThreePhase_16A:
      return gridItemSizeData['16'];
    case PowerPlugType.ThreePhase_32A:
      return gridItemSizeData['32'];
    case PowerPlugType.ThreePhase_63A:
      return gridItemSizeData['63'];
    case PowerPlugType.ThreePhase_125A:
      return gridItemSizeData['125'];
    default:
      return gridItemSizeData['unknown'];
  }
}

export const gridItemSizes = ['250', '125', '63', '32', '16', '1f'];
export function gridItemSizeLE(a: string, b: string) {
  return gridItemSizes.indexOf(a) >= gridItemSizes.indexOf(b);
}

export const Vref_LL = 400;
export const Vref_LN = Vref_LL / Math.sqrt(3);
