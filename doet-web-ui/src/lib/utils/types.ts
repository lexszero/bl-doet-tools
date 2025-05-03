import type { Snippet } from "svelte";
import type { IconType } from "$lib/Icons";
import type { ItemLogEntry } from "./misc";

export type Constructor<T> = { new(...args: any): T }
export type UnionOfValues<T extends object> = { [K in keyof T]: T[K] }[keyof T];

export interface Named {
  name: string;
}

export interface ValidationLog {
  log?: ItemLogEntry[];
}

export interface CacheMixin<T> {
  _cache?: T | ValidationLog;
}

export type CachedValidationLog = CacheMixin<ValidationLog>;

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


