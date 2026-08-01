import { describe, it, expect } from 'vitest';
import { ASTBuilder } from '../ast/index.js';
import { ASTSerializer } from '../serializer/index.js';
import { CompatibilityEngine } from './index.js';
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

describe('CompatibilityEngine', () => {
  it('should simplify a single-node graph structure', () => {
    const builder = new ASTBuilder();
    const serializer = new ASTSerializer();
    const engine = new CompatibilityEngine(defaultConfig);

    const rawGraph = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Product",
          "name": "SingleWidget"
        }
      ]
    };

    const doc = builder.build(rawGraph);
    const transformedDoc = engine.transform(doc);
    const serialized = serializer.serialize(transformedDoc);

    expect(serialized["@graph"]).toBeUndefined();
    expect(serialized["@type"]).toBe("Product");
    expect(serialized["name"]).toBe("SingleWidget");
  });

  it('should canonicalize insecure http schema.org context to https', () => {
    const builder = new ASTBuilder();
    const serializer = new ASTSerializer();
    const engine = new CompatibilityEngine(defaultConfig);

    const doc = builder.build({
      "@context": "http://schema.org",
      "@type": "Product"
    });

    const transformedDoc = engine.transform(doc);
    const serialized = serializer.serialize(transformedDoc);
    expect(serialized["@context"]).toBe("https://schema.org");
  });

  it('should prune unknown keywords and keywords ignored by Google', () => {
    const builder = new ASTBuilder();
    const serializer = new ASTSerializer();
    const engine = new CompatibilityEngine(defaultConfig);

    const doc = builder.build({
      "@context": "https://schema.org",
      "@type": "Product",
      "name": "Widget",
      "@nest": {
        "color": "blue"
      },
      "@future_keyword": "experimental-value"
    });

    const transformedDoc = engine.transform(doc);
    const serialized = serializer.serialize(transformedDoc);

    expect(serialized["@nest"]).toBeUndefined();
    expect(serialized["@future_keyword"]).toBeUndefined();
    expect(serialized["name"]).toBe("Widget");
  });

  it('should transform reverse properties into forward properties', () => {
    const builder = new ASTBuilder();
    const serializer = new ASTSerializer();
    const engine = new CompatibilityEngine(defaultConfig);

    const doc = builder.build({
      "@context": "https://schema.org",
      "@type": "Person",
      "name": "Alice",
      "@reverse": {
        "author": {
          "@type": "Book",
          "name": "Alice in Wonderland"
        }
      }
    });

    const transformedDoc = engine.transform(doc);
    const serialized = serializer.serialize(transformedDoc);

    // It should flatten to a root @graph containing Person and Book pointing forward to Person with pure @id reference
    expect(serialized["@graph"]).toBeDefined();
    const graph = serialized["@graph"];
    expect(graph[0]["@type"]).toBe("Person");
    expect(graph[0]["name"]).toBe("Alice");
    expect(graph[1]["@type"]).toBe("Book");
    expect(graph[1]["name"]).toBe("Alice in Wonderland");
    expect(graph[1]["author"]["@id"]).toBeDefined();
    expect(graph[1]["author"]["@type"]).toBeUndefined();
  });

  it('should hoist included secondary nodes into graph structures', () => {
    const builder = new ASTBuilder();
    const serializer = new ASTSerializer();
    const engine = new CompatibilityEngine(defaultConfig);

    const doc = builder.build({
      "@context": "https://schema.org",
      "@type": "Product",
      "name": "Tablet",
      "@included": [
        {
          "@type": "Review",
          "reviewBody": "Awesome"
        }
      ]
    });

    const transformedDoc = engine.transform(doc);
    const serialized = serializer.serialize(transformedDoc);

    expect(serialized["@graph"]).toBeDefined();
    const graph = serialized["@graph"];
    expect(graph.length).toBe(2);
    expect(graph[0]["@type"]).toBe("Product");
    expect(graph[1]["@type"]).toBe("Review");
  });

  it('should replace superseded Schema.org terms with their current equivalents', () => {
    const builder = new ASTBuilder();
    const serializer = new ASTSerializer();
    const engine = new CompatibilityEngine(defaultConfig);

    const doc = builder.build({
      "@context": "https://schema.org",
      "@type": "Recipe",
      "recipeYields": "4 servings"
    });

    const transformedDoc = engine.transform(doc);
    const serialized = serializer.serialize(transformedDoc);

    expect(serialized["recipeYields"]).toBeUndefined();
    expect(serialized["yield"]).toBe("4 servings");
  });
});
