import { describe, it, expect } from 'vitest';
import { SchemaValidator } from './index.js';
import { ASTBuilder } from '../ast/index.js';

describe('SchemaValidator', () => {
  it('should successfully pass validation for correct types and properties', () => {
    const builder = new ASTBuilder();
    const validator = new SchemaValidator();

    const raw = {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": "Widget",
      "offers": {
        "@type": "Offer",
        "price": 10
      }
    };

    const ast = builder.build(raw);
    const errors = validator.validate(ast);
    expect(errors.length).toBe(0);
  });

  it('should flag unknown Schema.org types', () => {
    const builder = new ASTBuilder();
    const validator = new SchemaValidator();

    const raw = {
      "@context": "https://schema.org",
      "@type": "UnknownSuperClass"
    };

    const ast = builder.build(raw);
    const errors = validator.validate(ast);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("Unknown Schema.org type");
  });

  it('should flag invalid properties for a specific Schema.org type', () => {
    const builder = new ASTBuilder();
    const validator = new SchemaValidator();

    const raw = {
      "@context": "https://schema.org",
      "@type": "Offer",
      "recipeIngredient": "Salt" // Invalid property for Offer (recipeIngredient belongs to Recipe!)
    };

    const ast = builder.build(raw);
    const errors = validator.validate(ast);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("is not valid for Schema.org type");
  });
});
