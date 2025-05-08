import {SvelteMap} from 'svelte/reactivity';

import type {Geometry} from 'geojson';
import type {Feature} from '$lib/utils/geojson';
import {logLevelToString, type ItemLogEntry} from '$lib/utils/misc';
import type {CacheMixin, Named, ValidationLog} from '$lib/utils/types';
import { parseJSON as parseTimestamp } from 'date-fns';

import type {FeaturesDataElement, ProjectView} from '$lib/api_project';
import {ProjectData} from '$lib/ProjectData.svelte';
import type {Layer} from './LayerInterface';
import type {BasicLayerDisplayOptions, LayerController} from './LayerController.svelte';
import type {LayerID} from './Layers';

export type Props = CacheMixin<ValidationLog> & Named & {
    type?: string;
}

export function featureCachedProps<
  PC extends ValidationLog,
  >(feature: Feature<Geometry, CacheMixin<PC>>): PC {
  if (!feature.properties._cache)
    feature.properties._cache = {} as PC;
  return feature.properties._cache;
}

export abstract class LayerData<G extends Geometry, P extends Props> {
  declare readonly layer: Layer<LayerData<G, P>, LayerController<G, P, BasicLayerDisplayOptions>>
  public readonly dependencies: LayerID[] = [];
  public readonly project: ProjectData;
  public readonly id: LayerID;
  ctl: LayerController<G, P, BasicLayerDisplayOptions> | undefined = $state();

  public features: SvelteMap<string, Feature<G, P>> = $state(new SvelteMap<string, Feature<G, P>>());
  public featuresLoaded: Map<string, Feature<G, P>> = new Map();
  public featuresChanged: Map<string, Feature<G, P> | null> = new SvelteMap<string, Feature<G, P> | null>();

  public timestamp: Date | undefined;
  public editable: boolean = false;

  constructor(
    project: ProjectData,
    layer: Layer<LayerData<G, P>, LayerController<G, P, BasicLayerDisplayOptions>>,
    element: string,
  ) {
    this.project = project;
    this.layer = layer;
    this.id = element;
  }

  setDataFromElement(data: FeaturesDataElement<Feature<G, P>>) {
    this.timestamp = parseTimestamp(data.timestamp || "");
    this.editable = data.editable;
    const features = new Map<string, Feature<G, P>>(
      data.features.map(
        (it: Feature<G, P>) => ([it.id, it])
      ));

    this.processFeaturesAfterLoad(features);
    this.featuresLoaded = features;
    this.resetChanges();
    console.info(`${this.id}: ${this.features.size} features, timestamp: ${data.timestamp}, editable: ${this.editable}`);
  }

  setDataFromView(view: ProjectView) {
    this.setDataFromElement(view.map_data.layers[this.id] as FeaturesDataElement<Feature<G, P>>);
  }

  processFeaturesAfterLoad(features: Map<string, Feature<G, P>>) {}

  resetChanges() {
    this.features = new SvelteMap<string, Feature<G, P>>(this.featuresLoaded.entries().map(
      ([k, v]: [string, Feature<G, P>]) => ([k, structuredClone(v)])
    ));
    this.cacheReady = false;
  }

  validateFeature(_feature: Feature<G, P>): ItemLogEntry[] | undefined {}

  getFeature(id?: string) {
    const result = (id) ? this.features.get(id) : undefined;
    if (!result) {
      console.error("Can't find feature ", id);
    }
    return result;
  }

  cacheReady: boolean = false;
  invalidateCache() {
    //console.debug(`${this.id}: invalidateCache`);
    for (const f of this.features.values()) {
      f.properties._cache = undefined;
    }
    this.cacheReady = false;
  }

  updateCache() {
    //console.debug(`${this.id}: updateCache`);
    this.cacheReady = false;
    for (const f of this.features.values()) {
      this.updateFeatureCache(f.id, this.featureCachedProps(f));
    }
    this.cacheReady = true;
    this.updateWarnings();
  }

  updateFeatureCache(id: string, data: object) {
    const feature = this.getFeature(id);
    if (!feature)
      return;
    feature.properties._cache = {...feature.properties._cache, ...data};
  }

  featureCachedProps(feature: Feature<G, P>) {
    return {
      log: this.validateFeature(feature)
    }
  }

  triggerUpdateFrom(_id: LayerID) {}

  public featureWarnings: SvelteMap<string, ItemLogEntry[]> = $state(new SvelteMap<string, ItemLogEntry[]>());
  public warningsSummary: ItemLogEntry[] = $state([]);

  updateWarnings() {
    if (!this.cacheReady)
      return {};
    const entries: [string, ItemLogEntry[]][] = [];
    for (const feature of this.features.values()) {
      const log = feature.properties._cache?.log;
      if (log?.length)
        entries.push([feature.id, log]);
    }
    console.debug(`${this.id}: ${entries.length} warnings`);

    const summary: ItemLogEntry[] = [];
    for (const [id, log] of entries) {
      if (!log?.length)
        continue;
      const byLevel = new Map<number, ItemLogEntry[]>();
      for (const r of log) {
        if (!byLevel.has(r.level))
          byLevel.set(r.level, []);
        (byLevel.get(r.level) || []).push(r);
      }
      if (byLevel.size > 1) {
        summary.push({
          item_id: id,
          level: Math.max(...byLevel.values().map((recs) => recs.length)),
          message: [...byLevel.entries().map(([level, recs]) => (`${recs.length} ${logLevelToString(level)}s`))].join(', ')
        });
      } else if (byLevel.size == 1) {
        const r = byLevel.values().next().value[0];
        summary.push({item_id: id, ...r});
      }
    }
    this.featureWarnings = new SvelteMap<string, ItemLogEntry[]>(entries);
    this.warningsSummary = summary;
  }
}
