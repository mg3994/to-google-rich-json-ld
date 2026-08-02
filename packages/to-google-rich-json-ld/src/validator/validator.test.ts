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
      "recipeIngredient": "Salt"
    };

    const ast = builder.build(raw);
    const errors = validator.validate(ast);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("is not valid for Schema.org type");
  });

  it('should issue a warning warning when datePublished datetime lacks a timezone', () => {
    const builder = new ASTBuilder();
    const validator = new SchemaValidator();

    const raw = {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": "Title",
      "datePublished": "2026-08-01T12:00:00" // Missing timezone
    };

    const ast = builder.build(raw);
    const errors = validator.validate(ast);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("is missing a time zone");
  });

  it('should issue a warning when telephone lacks a + prefix', () => {
    const builder = new ASTBuilder();
    const validator = new SchemaValidator();

    const raw = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "name": "Greens Grocer",
      "telephone": "1-800-555-0199" // Missing '+'
    };

    const ast = builder.build(raw);
    const errors = validator.validate(ast);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(err => err.includes("telephone") && err.includes("missing a '+' prefix"))).toBe(true);
  });

  it('should issue a warning for invalid isbn format', () => {
    const builder = new ASTBuilder();
    const validator = new SchemaValidator();

    const raw = {
      "@context": "https://schema.org",
      "@type": "Book",
      "name": "The Great Gatsby",
      "isbn": "invalid-isbn-123"
    };

    const ast = builder.build(raw);
    const errors = validator.validate(ast);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(err => err.includes("isbn") && err.includes("not a valid ISBN"))).toBe(true);
  });

  it('should issue a warning for invalid email format', () => {
    const builder = new ASTBuilder();
    const validator = new SchemaValidator();

    const raw = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "name": "Shop",
      "email": "notanemail.com" // Missing '@'
    };

    const ast = builder.build(raw);
    const errors = validator.validate(ast);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(err => err.includes("email") && err.includes("missing an '@' symbol"))).toBe(true);
  });
});
