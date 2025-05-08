import type { EntryGenerator } from './$types';

type ProjectNameView = {
  slug: string,
  view: string,
};

export const entries: EntryGenerator = () => {
  return ['bl24', 'bl24_test', 'bl25', 'bl25_test'].reduce(
    (all: ProjectNameView[], project_name: string) => ([
      ...all,
      ...(['default', 'power_rollout'].map(
        (view_name) => ({slug: project_name, view: view_name})
      ))
    ]),
    []
  );
};

export const prerender = true;


