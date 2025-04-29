import type { Snippet } from "svelte";
import type { IconType } from "$lib/Icons";

export interface Named {
  name: string;
}

export interface SearchboxItem {
  label: string;
  value: string;
  icon: IconType;
};

export interface ChipItem {
  id?: string;
  label: string;
  onclick?: (() => unknown);
};

export interface InfoItem {
  label: string;
  value?: any;
  content?: Snippet;
  icon?: IconType;
  classes?: string;
  chips?: ChipItem[];
};


