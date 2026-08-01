import { describe, it, expect } from 'vitest';
import { ContextLoader } from './context-loader.js';
import { Config } from '../types/index.js';

const defaultConfig: Config = {
  target: "google",
  schemaVersion: "latest",
  jsonldVersion: "auto",
  preserveUnknownKeywords: true,
  removeUnsupportedFeatures: true,
  normalizeIRIs: true,
  fetchRemoteContexts: true,
  cacheContexts: true,
  strict: false
};

describe('ContextLoader', () => {
  it('should load offline fallback for Schema.org instantly', async () => {
    const loader = new ContextLoader(defaultConfig);
    const context = await loader.load("https://schema.org");
    expect(context["@vocab"]).toBe("https://schema.org/");
  });

  it('should merge multiple contexts in an array', async () => {
    const loader = new ContextLoader(defaultConfig);
    const context = await loader.load([
      "https://schema.org",
      { "name": "schema:name", "customProp": "https://example.com/prop" }
    ]);
    expect(context["@vocab"]).toBe("https://schema.org/");
    expect(context["name"]).toBe("schema:name");
    expect(context["customProp"]).toBe("https://example.com/prop");
  });

  it('should load local embedded objects', async () => {
    const loader = new ContextLoader(defaultConfig);
    const localCtx = { "custom": "https://example.com/custom" };
    const context = await loader.load(localCtx);
    expect(context["custom"]).toBe("https://example.com/custom");
  });
});
