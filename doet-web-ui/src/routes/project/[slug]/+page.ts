import type { PageLoad } from './$types';

export const load: PageLoad = ({ fetch, params }) => {
  async function fetchJSON(url: string): object {
    return await fetch(url).then(x=>x.json());
  }

  const API_BASE_URL = 'https://bl.skookum.cc/api';
  const apiPowerMap =`${API_BASE_URL}/power_map/${params.slug}`;

  return {
    powerAreas: fetchJSON(`${apiPowerMap}/power_areas.geojson`),
    powerGrid: fetchJSON(`${apiPowerMap}/power_grid.geojson`),
    placementEntities: fetchJSON(`${apiPowerMap}/placement_entities.geojson`),
  }
};
