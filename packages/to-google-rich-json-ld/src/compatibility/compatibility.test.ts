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
      "recipeYields": "4 servings",
      "vendor": {
        "@type": "Organization",
        "name": "BestStore"
      }
    });

    const transformedDoc = engine.transform(doc);
    const serialized = serializer.serialize(transformedDoc);

    expect(serialized["recipeYields"]).toBeUndefined();
    expect(serialized["yield"]).toBe("4 servings");

    // legacy "vendor" is mapped to modern canonical "seller"
    expect(serialized["vendor"]).toBeUndefined();
    expect(serialized["seller"]["name"]).toBe("BestStore");
  });

  it('should normalize datetimes, clean numeric strings, and prune empty values', () => {
    const builder = new ASTBuilder();
    const serializer = new ASTSerializer();
    const engine = new CompatibilityEngine(defaultConfig);

    const doc = builder.build({
      "@context": "https://schema.org",
      "@type": "Product",
      "name": "Widget",
      "datePublished": "2026-08-01 12:00:00",
      "price": "$1,499.00",
      "emptyField": ""
    });

    const transformedDoc = engine.transform(doc);
    const serialized = serializer.serialize(transformedDoc);

    expect(serialized["datePublished"]).toBe("2026-08-01T12:00:00");
    expect(serialized["price"]).toBe(1499.00);
    expect(serialized["emptyField"]).toBeUndefined();
  });

  it('should auto-wrap lists, infer missing types, and expand relative url values using @base', () => {
    const builder = new ASTBuilder();
    const serializer = new ASTSerializer();
    const engine = new CompatibilityEngine(defaultConfig);

    const doc = builder.build({
      "@context": {
        "@vocab": "https://schema.org/",
        "@base": "https://example.com/"
      },
      "@type": "Recipe",
      "name": "Cake",
      "image": "/images/cake.jpg",
      "recipeInstructions": [
        "Mix everything",
        "Bake at 350F"
      ],
      "offers": {
        "price": "10.00" // untyped Offer
      },
      "author": {
        "name": "Chef James" // untyped Person
      }
    });

    const transformedDoc = engine.transform(doc);
    const serialized = serializer.serialize(transformedDoc);

    // Image relative value should be expanded to absolute using @base
    expect(serialized["image"]).toBe("https://example.com/images/cake.jpg");

    // recipeInstructions should be auto-wrapped in standard @list container
    expect(serialized["recipeInstructions"]).toEqual({
      "@list": [
        "Mix everything",
        "Bake at 350F"
      ]
    });

    // untyped nested Offer should be auto-inferred
    expect(serialized["offers"]["@type"]).toBe("https://schema.org/Offer");

    // untyped nested author should be auto-inferred as Person
    expect(serialized["author"]["@type"]).toBe("https://schema.org/Person");
    expect(serialized["author"]["name"]).toBe("Chef James");
  });

  it('should deduplicate types and structurally identical nested items', () => {
    const builder = new ASTBuilder();
    const serializer = new ASTSerializer();
    const engine = new CompatibilityEngine(defaultConfig);

    const doc = builder.build({
      "@context": "https://schema.org",
      "@type": ["Product", "Product"], // Redundant types
      "name": "Widget",
      "offers": [
        {
          "@type": "Offer",
          "price": 10
        },
        {
          "@type": "Offer",
          "price": 10 // Identical duplicated offer
        }
      ]
    });

    const transformedDoc = engine.transform(doc);
    const serialized = serializer.serialize(transformedDoc);

    // Type should be deduplicated to a single string (as there's only 1 unique type remaining)
    expect(serialized["@type"]).toBe("Product");

    // Duplicated offers should be structurally deduplicated to just 1 offer item
    expect(Array.isArray(serialized["offers"])).toBe(false);
    expect(serialized["offers"]["price"]).toBe(10);
  });

  it('should auto-inject best/worst rating limits, normalize ratingValue, and secure sameAs links', () => {
    const builder = new ASTBuilder();
    const serializer = new ASTSerializer();
    const engine = new CompatibilityEngine(defaultConfig);

    const doc = builder.build({
      "@context": "https://schema.org",
      "@type": "AggregateRating",
      "ratingValue": "4,5", // commas should be replaced by dots
      "sameAs": [
        "http://twitter.com/mybrand", // insecure social link
        "https://twitter.com/mybrand", // duplicate secure social link
        "https://example.com"
      ]
    });

    const transformedDoc = engine.transform(doc);
    const serialized = serializer.serialize(transformedDoc);

    expect(serialized["ratingValue"]).toBe(4.5);
    expect(serialized["bestRating"]).toBe(5);
    expect(serialized["worstRating"]).toBe(1);

    // sameAs URLs are protocol secured and deduplicated
    expect(serialized["sameAs"].length).toBe(2);
    expect(serialized["sameAs"]).toContain("https://twitter.com/mybrand");
    expect(serialized["sameAs"]).toContain("https://example.com");
  });

  it('should singularize plural keys, extract currency symbols, and strip HTML tags', () => {
    const builder = new ASTBuilder();
    const serializer = new ASTSerializer();
    const engine = new CompatibilityEngine(defaultConfig);

    const doc = builder.build({
      "@context": "https://schema.org",
      "@type": "Product",
      "name": "Ultimate Gaming Laptop",
      "description": "<p>This is an <strong>awesome</strong> laptop!</p>", // HTML tag strip
      "priceCurrency": "$", // Convert symbol to standard 3-letter ISO code
      "reviews": [ // Singularize reviews -> review
        {
          "@type": "Review",
          "reviewBody": "Loved it."
        }
      ]
    });

    const transformedDoc = engine.transform(doc);
    const serialized = serializer.serialize(transformedDoc);

    expect(serialized["description"]).toBe("This is an awesome laptop!");
    expect(serialized["priceCurrency"]).toBe("USD");
    expect(serialized["reviews"]).toBeUndefined();
    expect(serialized["review"]).toBeDefined();
    expect(serialized["review"]["reviewBody"]).toBe("Loved it.");
  });
});
