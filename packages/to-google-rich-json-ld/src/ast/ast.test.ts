import { describe, it, expect } from 'vitest';
import { ASTBuilder } from './index.js';

describe('ASTBuilder', () => {
  it('should parse standard NodeObjects and literal properties', () => {
    const builder = new ASTBuilder();
    const raw = {
      "@context": "https://schema.org",
      "@id": "https://example.com/product/1",
      "@type": "Product",
      "name": "SuperWidget",
      "price": 99.9
    };

    const doc = builder.build(raw);
    expect(doc.type).toBe("Document");
    expect(doc.context).not.toBeNull();
    expect(doc.context?.value).toBe("https://schema.org");

    const rootNode = doc.body[0];
    expect(rootNode.type).toBe("NodeObject");
    if (rootNode.type === "NodeObject") {
      expect(rootNode.id).toBe("https://example.com/product/1");
      expect(rootNode.types).toContain("Product");

      const nameProp = rootNode.properties["name"][0];
      expect(nameProp.type).toBe("Literal");
      if (nameProp.type === "Literal") {
        expect(nameProp.value).toBe("SuperWidget");
      }
    }
  });

  it('should preserve unknown keywords as UnknownKeywordNode', () => {
    const builder = new ASTBuilder();
    const raw = {
      "@context": "https://schema.org",
      "@type": "Product",
      "@future_keyword": "experimental-value"
    };

    const doc = builder.build(raw);
    const rootNode = doc.body[0];
    expect(rootNode.type).toBe("NodeObject");
    if (rootNode.type === "NodeObject") {
      const futureProp = rootNode.properties["@future_keyword"][0];
      expect(futureProp.type).toBe("UnknownKeyword");
      if (futureProp.type === "UnknownKeyword") {
        expect(futureProp.value).toBe("@future_keyword");
        expect(futureProp.associatedValue).toBe("experimental-value");
      }
    }
  });

  it('should handle @reverse and nested ValueObjects', () => {
    const builder = new ASTBuilder();
    const raw = {
      "@context": "https://schema.org",
      "@type": "Person",
      "name": "Alice",
      "@reverse": {
        "author": {
          "@type": "Book",
          "name": "Alice in Wonderland"
        }
      }
    };

    const doc = builder.build(raw);
    const rootNode = doc.body[0];
    if (rootNode.type === "NodeObject") {
      const reverseProp = rootNode.properties["@reverse"] || [];
      expect(reverseProp.length).toBe(1);
      expect(reverseProp[0].type).toBe("ReverseObject");
    }
  });

  it('should successfully parse language maps into LanguageMapNode', () => {
    const builder = new ASTBuilder();
    const raw = {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": {
        "en": "Apple",
        "fr": "Pomme"
      }
    };
    const doc = builder.build(raw);
    const rootNode = doc.body[0];
    if (rootNode.type === "NodeObject") {
      const nameProp = rootNode.properties["name"][0];
      expect(nameProp.type).toBe("LanguageMap");
      if (nameProp.type === "LanguageMap") {
        expect(nameProp.map["en"]).toContain("Apple");
        expect(nameProp.map["fr"]).toContain("Pomme");
      }
    }
  });
});
