
import IconClose from '@lucide/svelte/icons/x';
import IconWarning from '@lucide/svelte/icons/triangle-alert';
import IconFeatureDefault from '@lucide/svelte/icons/map-pin';
import IconCable from '@lucide/svelte/icons/cable';
import IconPDU from '@lucide/svelte/icons/smartphone-charging';
import IconRuler from '@lucide/svelte/icons/ruler';
import IconPower from '@lucide/svelte/icons/zap';
import IconResistance from '@lucide/svelte/icons/omega';
import IconPlacement from '@lucide/svelte/icons/land-plot';
import IconPlacementEntity from '@lucide/svelte/icons/tent';
import IconPlug from '@lucide/svelte/icons/plug';
import IconSound from '@lucide/svelte/icons/volume-2';

export {
  IconClose,
  IconWarning,
  IconFeatureDefault,
  IconCable,
  IconPDU,
  IconRuler,
  IconPower,
  IconResistance,
  IconPlacement,
  IconPlacementEntity,
  IconPlug,
  IconSound
};

import type { Snippet } from 'svelte';
import type { SVGAttributes, SvelteHTMLElements } from 'svelte/elements';
type Attrs = SVGAttributes<SVGSVGElement>;
type IconNode = [elementName: keyof SvelteHTMLElements, attrs: Attrs][];
export interface IconProps extends Attrs {
    name?: string;
    color?: string;
    size?: number | string;
    strokeWidth?: number | string;
    absoluteStrokeWidth?: boolean;
    iconNode?: IconNode;
    children?: Snippet;
}

declare const Icon: import("svelte").Component<IconProps, {}, "">;
export type IconType = ReturnType<typeof Icon>;


