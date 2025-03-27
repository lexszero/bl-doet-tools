import type { PageLoad } from './$types';

export const load: PageLoad = ({ fetch, params }) => {
  async function fetchJSON(url: string): object {
    return await fetch(url).then(x=>x.json());
  }

  //const API_BASE_URL = 'https://bl.skookum.cc/api';
  const API_BASE_URL = 'http://localhost:8000';
  const apiPowerMap =`${API_BASE_URL}/${params.slug}/power_map`;

  return {
    powerAreas: fetchJSON(`${apiPowerMap}/areas.geojson`),
    powerGrid: fetchJSON(`${apiPowerMap}/grid.geojson`),
    placementEntities: fetchJSON(`${apiPowerMap}/placement_entities.geojson`),
  }
};
