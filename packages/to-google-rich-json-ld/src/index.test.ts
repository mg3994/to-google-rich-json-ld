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
    expect(Array.isArray(converted)).toBe(true);
    expect(converted[0]["@type"]).toBe("Person");
    expect(converted[0]["name"]).toBe("Bob");
    expect(converted[1]["@type"]).toBe("Book");
    expect(converted[1]["name"]).toBe("Gatsby");
    expect(converted[1]["author"]["name"]).toBe("Bob");
  });
});
