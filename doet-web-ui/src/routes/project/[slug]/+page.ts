import type { EntryGenerator, PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
  return {
    project_name: params.slug
  }
};

export const entries: EntryGenerator = () => {
  return ['bl24', 'bl25', 'bl25_test'].map((x) => ({slug: x}))
};

export const prerender = true;


