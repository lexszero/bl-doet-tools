import type { EntryGenerator } from './$types';

export const entries: EntryGenerator = () => {
  return ['bl24', 'bl24_test', 'bl25', 'bl25_test'].map((x) => ({slug: x}))
};

export const prerender = true;


