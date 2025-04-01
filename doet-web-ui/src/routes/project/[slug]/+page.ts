import type { PageLoad } from './$types';

export const load: PageLoad = ({ fetch, params }) => {
  return {
    project_name: params.slug
  }
};
