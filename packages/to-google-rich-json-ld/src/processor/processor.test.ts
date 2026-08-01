import { describe, it, expect } from 'vitest';
import { ASTBuilder } from '../ast/index.js';
import { ASTSerializer } from '../serializer/index.js';
import { SemanticProcessor } from './index.js';
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

describe('SemanticProcessor', () => {
  it('should successfully expand context terms into full absolute IRIs', async () => {
    const builder = new ASTBuilder();
    const serializer = new ASTSerializer();
    const processor = new SemanticProcessor(defaultConfig);

    const raw = {
      "@context": {
        "@vocab": "https://schema.org/",
        "name": "https://schema.org/name",
        "Offer": "https://schema.org/Offer"
      },
      "@type": "Offer",
      "name": "Special Offer"
    };

    const doc = builder.build(raw);
    const expandedDoc = await processor.expand(doc);
    const serialized = serializer.serialize(expandedDoc);

    expect(serialized["@type"]).toBe("https://schema.org/Offer");
    expect(serialized["https://schema.org/name"]).toBe("Special Offer");
    expect(serialized["@context"]).toBeUndefined();
  });

  it('should support default @language and @direction in context expansion and compaction', async () => {
    const builder = new ASTBuilder();
    const serializer = new ASTSerializer();
    const processor = new SemanticProcessor(defaultConfig);

    const raw = {
      "@context": {
        "@vocab": "https://schema.org/",
        "@language": "ar",
        "@direction": "rtl"
      },
      "@type": "Product",
      "name": "مرحبا"
    };

    const doc = builder.build(raw);
    const expandedDoc = await processor.expand(doc);
    const expandedSerialized = serializer.serialize(expandedDoc);

    // Should expand name to a value object with ar and rtl
    expect(expandedSerialized["https://schema.org/name"]).toEqual({
      "@value": "مرحبا",
      "@language": "ar",
      "@direction": "rtl"
    });

    // Compact back
    const compactedDoc = await processor.compact(expandedDoc, {
      "@vocab": "https://schema.org/",
      "@language": "ar",
      "@direction": "rtl"
    });
    const compactedSerialized = serializer.serialize(compactedDoc);

    expect(compactedSerialized["name"]).toBe("مرحبا");
  });

  it('should successfully compact absolute IRIs into local context terms', async () => {
    const builder = new ASTBuilder();
    const serializer = new ASTSerializer();
    const processor = new SemanticProcessor(defaultConfig);

    const rawExpanded = {
      "@type": "https://schema.org/Offer",
      "https://schema.org/name": "Special Offer"
    };

    const doc = builder.build(rawExpanded);
    const compactedDoc = await processor.compact(doc, {
      "@vocab": "https://schema.org/"
    });
    const serialized = serializer.serialize(compactedDoc);

    expect(serialized["@context"]).toEqual({ "@vocab": "https://schema.org/" });
    expect(serialized["@type"]).toBe("Offer");
    expect(serialized["name"]).toBe("Special Offer");
  });

  it('should successfully flatten deeply nested graphs into single-level structures', () => {
    const builder = new ASTBuilder();
    const serializer = new ASTSerializer();
    const processor = new SemanticProcessor(defaultConfig);

    const rawNested = {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": "Laptop",
      "offers": {
        "@type": "Offer",
        "price": 999.0,
        "seller": {
          "@type": "Organization",
          "name": "BestShop"
        }
      }
    };

    const doc = builder.build(rawNested);
    const flattenedDoc = processor.flatten(doc);
    const serialized = serializer.serialize(flattenedDoc);

    expect(serialized["@graph"]).toBeDefined();
    expect(Array.isArray(serialized["@graph"])).toBe(true);

    // Check that we have multiple flat nodes in the graph
    const types = serialized["@graph"].map((node: any) => node["@type"]);
    expect(types).toContain("Product");
    expect(types).toContain("Offer");
    expect(types).toContain("Organization");
  });

  it('should successfully frame nodes matching a specified type', () => {
    const builder = new ASTBuilder();
    const serializer = new ASTSerializer();
    const processor = new SemanticProcessor(defaultConfig);

    const raw = {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "Product", "name": "A" },
        { "@type": "Offer", "price": 10 },
        { "@type": "Product", "name": "B" }
      ]
    };

    const doc = builder.build(raw);
    const framedDoc = processor.frame(doc, { "@type": "Product" });
    const serialized = serializer.serialize(framedDoc);

    expect(Array.isArray(serialized)).toBe(true);
    expect(serialized.length).toBe(2);
    expect(serialized[0]["@type"]).toBe("Product");
    expect(serialized[1]["@type"]).toBe("Product");
  });
});
