import { Config } from '../types/index.js';

export class ContextLoader {
  private cache: Map<string, any> = new Map();
  private config: Config;

  constructor(config: Config) {
    this.config = config;
    // Store unwrapped context objects directly in the cache.
    const schemaOrgContext = {
      "@vocab": "https://schema.org/",
      "schema": "https://schema.org/"
    };
    this.cache.set("https://schema.org", schemaOrgContext);
    this.cache.set("http://schema.org", schemaOrgContext);
    this.cache.set("https://schema.org/", schemaOrgContext);
    this.cache.set("http://schema.org/", schemaOrgContext);
  }

  /**
   * Resolves a context value (which could be a string URL, a local object, or an array of both).
   * Returns a flattened/merged single context object.
   */
  public async load(contextValue: any): Promise<Record<string, any>> {
    if (!contextValue) {
      return {};
    }

    if (Array.isArray(contextValue)) {
      let merged: Record<string, any> = {};
      for (const item of contextValue) {
        const resolved = await this.load(item);
        merged = { ...merged, ...resolved };
      }
      return merged;
    }

    if (typeof contextValue === 'string') {
      return this.loadRemote(contextValue);
    }

    if (typeof contextValue === 'object' && contextValue !== null) {
      // Support nested imports
      let baseContext = { ...contextValue };
      if ('@context' in baseContext) {
        baseContext = baseContext['@context'];
      }
      if ('@import' in baseContext && typeof baseContext['@import'] === 'string') {
        const imported = await this.loadRemote(baseContext['@import'] as string);
        baseContext = { ...imported, ...baseContext };
        delete baseContext['@import'];
      }
      return baseContext;
    }

    return {};
  }

  /**
   * Fetches a remote context and caches it if configured.
   */
  private async loadRemote(url: string): Promise<Record<string, any>> {
    if (!this.config.fetchRemoteContexts) {
      return this.cache.get(url) || {};
    }

    if (this.config.cacheContexts && this.cache.has(url)) {
      return this.cache.get(url);
    }

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) {
        throw new Error(`Failed to fetch context: ${res.statusText}`);
      }
      const data = await res.json() as any;
      const parsed = data['@context'] || data;

      if (this.config.cacheContexts) {
        this.cache.set(url, parsed);
      }
      return parsed;
    } catch (err: any) {
      // Graceful fallback to cached Schema.org or empty
      const normalizedUrl = url.replace(/\/$/, "");
      if (normalizedUrl.includes("schema.org")) {
        return this.cache.get("https://schema.org");
      }
      console.warn(`Could not load remote context from: ${url}. Error: ${err.message}`);
      return {};
    }
  }
}
