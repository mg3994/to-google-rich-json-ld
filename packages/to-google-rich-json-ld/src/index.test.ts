import { describe, it, expect } from 'vitest';
import {
  GoogleRichJsonLdEngine,
  convert,
  detectVersion,
  normalize,
  validate,
  expand,
  compact,
  flatten,
  frame,
  analyze
} from './index.js';

describe('GoogleRichJsonLdEngine', () => {
  const doc = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Super Widget",
    "offers": {
      "@type": "Offer",
      "price": 19.99,
      "priceCurrency": "USD"
    }
  };

  it('should successfully run convert programmatically', async () => {
    const result = await convert(doc);
    expect(result["@type"]).toBe("Product");
    expect(result["name"]).toBe("Super Widget");
    expect(result["offers"]["price"]).toBe(19.99);
  });

  it('should detect the JSON-LD version', async () => {
    const ver = await detectVersion(doc);
    expect(ver).toBe("1.0");
  });

  it('should normalize secure IRIs', async () => {
    const insecDoc = {
      "@context": "http://schema.org",
      "@type": "Product",
      "name": "Insecure Widget"
    };
    const normalized = await normalize(insecDoc);
    expect(normalized["@context"]).toBe("https://schema.org");
  });

  it('should validate standard product types successfully', async () => {
    const validResult = await validate(doc);
    expect(validResult.valid).toBe(true);

    const invalidDoc = {
      "@context": "https://schema.org",
      "@type": "Product"
    };
    const invalidResult = await validate(invalidDoc);
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors[0]).toContain("Missing required field");
  });

  it('should expand terms recursively', async () => {
    const expanded = await expand(doc);
    expect(expanded["https://schema.org/name"]).toBe("Super Widget");
  });

  it('should compact absolute IRIs using target context', async () => {
    const expanded = await expand(doc);
    const compacted = await compact(expanded, { "@vocab": "https://schema.org/" });
    expect(compacted["name"]).toBe("Super Widget");
  });

  it('should flatten nested structures', async () => {
    const flattened = await flatten(doc);
    expect(flattened["@graph"]).toBeDefined();
  });

  it('should frame specific node types', async () => {
    const framed = await frame(doc, { "@type": "Offer" });
    expect(framed["@type"]).toBe("Offer");
    expect(framed["price"]).toBe(19.99);
  });

  it('should deeply analyze keywords and types used', async () => {
    const info = await analyze(doc);
    expect(info.version).toBe("1.0");
    expect(info.keywordsUsed).toContain("@context");
    expect(info.keywordsUsed).toContain("@type");
    expect(info.schemaTypes).toContain("Product");
    expect(info.schemaTypes).toContain("Offer");
  });

  it('should correctly expand prefixed IRIs (e.g. schema:name, schema:Person)', async () => {
    const prefixDoc = {
      "@context": {
        "schema": "https://schema.org/",
        "name": "schema:name",
        "Person": "schema:Person"
      },
      "@type": "Person",
      "name": "Bob"
    };
    const expanded = await expand(prefixDoc);
    expect(expanded["https://schema.org/name"]).toBe("Bob");
  });

  it('should preserve and merge @base defaults when converting relative IDs', async () => {
    const relativeDoc = {
      "@context": {
        "@base": "https://example.com/"
      },
      "@id": "products/123",
      "@type": "https://schema.org/Product",
      "https://schema.org/name": "Laptop"
    };

    const converted = await convert(relativeDoc);

    // Final output should maintain @context as a flat unified object preserving @vocab and @base, and @id as compacted relative ID "products/123"
    expect(converted["@id"]).toBe("products/123");
    expect(converted["@context"]).toBeDefined();
    expect(converted["@context"]["@vocab"]).toBe("https://schema.org/");
    expect(converted["@context"]["@base"]).toBe("https://example.com/");
    expect(converted["name"]).toBe("Laptop");
  });

  it('should cleanly hoist @reverse properties without corrupting parent semantics', async () => {
    const reverseDoc = {
      "@context": "https://schema.org",
      "@type": "Person",
      "name": "Bob",
      "@reverse": {
        "author": {
          "@type": "Book",
          "name": "Gatsby"
        }
      }
    };
    const converted = await convert(reverseDoc);
    expect(converted["@graph"]).toBeDefined();
    const graph = converted["@graph"];
    expect(graph[0]["@type"]).toBe("Person");
    expect(graph[0]["name"]).toBe("Bob");
    expect(graph[1]["@type"]).toBe("Book");
    expect(graph[1]["name"]).toBe("Gatsby");
    expect(graph[1]["author"]["@id"]).toBeDefined();
  });

  it('should raise a warning / error when reverse property is semantically invalid (e.g. author on Product)', async () => {
    const invalidReverseDoc = {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": "Wrench",
      "@reverse": {
        "author": {
          "@type": "Book",
          "name": "Gatsby"
        }
      }
    };
    const result = await validate(invalidReverseDoc);
    expect(result.valid).toBe(false);
    expect(result.errors.some(err => err.includes("Omitted semantically invalid reverse relationship") && err.includes("expects range types"))).toBe(true);
  });

  it('should support default standard ontologies offline (e.g. Brick, FOAF, DCT, Bibo)', async () => {
    const brickDoc = {
      "@type": "brick:Location",
      "dct:title": "Building 1",
      "foaf:name": "HQ"
    };

    const expanded = await expand(brickDoc);
    expect(expanded["@type"]).toContain("https://brickschema.org/schema/Brick#Location");
    expect(expanded["http://purl.org/dc/terms/title"]).toBe("Building 1");
    expect(expanded["http://xmlns.com/foaf/0.1/name"]).toBe("HQ");

    const compacted = await compact(expanded, {});
    expect(compacted["@type"]).toBe("brick:Location");
    expect(compacted["dct:title"]).toBe("Building 1");
    expect(compacted["foaf:name"]).toBe("HQ");
  });

  it('should secure and canonicalize insecure Schema.org enum values and structured enums', async () => {
    const itemWithEnum = {
      "@context": "http://schema.org",
      "@type": "Offer",
      "availability": {
        "@id": "http://schema.org/InStock"
      },
      "itemCondition": "NewCondition"
    };

    const converted = await convert(itemWithEnum);
    expect(converted["availability"]["@id"]).toBe("InStock");
    expect(converted["itemCondition"]).toBe("https://schema.org/NewCondition");
  });
});
