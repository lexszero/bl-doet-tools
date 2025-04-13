import { type Icon as IconType } from '@lucide/svelte';

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
};

export interface InfoItem {
  label: string;
  value: any;
  icon?: IconType;
  classes?: string;
  chips?: ChipItem[];
};


