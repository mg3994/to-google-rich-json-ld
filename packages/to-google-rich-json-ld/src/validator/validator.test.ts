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
        "price": 10,
        "priceCurrency": "USD"
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
    expect(errors[0]).toContain("is not valid for declared Schema.org types");
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

  it('should issue a warning for negative price values', () => {
    const builder = new ASTBuilder();
    const validator = new SchemaValidator();

    const raw = {
      "@context": "https://schema.org",
      "@type": "Offer",
      "price": -19.99
    };

    const ast = builder.build(raw);
    const errors = validator.validate(ast);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(err => err.includes("price") && err.includes("cannot be negative"))).toBe(true);
  });

  it('should issue a warning when ratingValue is out of bounds (worstRating <= ratingValue <= bestRating)', () => {
    const builder = new ASTBuilder();
    const validator = new SchemaValidator();

    const raw = {
      "@context": "https://schema.org",
      "@type": "AggregateRating",
      "ratingValue": 0.5,
      "worstRating": 1,
      "bestRating": 5
    };

    const ast = builder.build(raw);
    const errors = validator.validate(ast);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(err => err.includes("ratingValue") && err.includes("is less than 'worstRating'"))).toBe(true);
  });

  it('should issue a warning when ISBN checksum calculation fails for ISBN-10 or ISBN-13', () => {
    const builder = new ASTBuilder();
    const validator = new SchemaValidator();

    const invalidIsbn10 = {
      "@context": "https://schema.org",
      "@type": "Book",
      "name": "Title",
      "isbn": "0-306-40615-1" // Checksum should be 2, but we supplied 1
    };

    const ast = builder.build(invalidIsbn10);
    const errors = validator.validate(ast);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(err => err.includes("isbn") && err.includes("invalid ISBN-10 checksum"))).toBe(true);

    const validIsbn10 = {
      "@context": "https://schema.org",
      "@type": "Book",
      "name": "Title",
      "isbn": "0-306-40615-2" // Correct checksum
    };
    const validAst = builder.build(validIsbn10);
    const validErrors = validator.validate(validAst);
    expect(validErrors.length).toBe(0);
  });

  it('should issue a warning when bestRating is less than or equal to worstRating', () => {
    const builder = new ASTBuilder();
    const validator = new SchemaValidator();

    const rawInconsistent = {
      "@context": "https://schema.org",
      "@type": "AggregateRating",
      "ratingValue": 3,
      "worstRating": 5,
      "bestRating": 1 // Inconsistent bounds
    };

    const ast = builder.build(rawInconsistent);
    const errors = validator.validate(ast);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(err => err.includes("bestRating") && err.includes("must be greater than 'worstRating'"))).toBe(true);
  });

  it('should issue a warning when coordinates fall out of range [-90, 90] / [-180, 180]', () => {
    const builder = new ASTBuilder();
    const validator = new SchemaValidator();

    const outOfBoundsCoords = {
      "@context": "https://schema.org",
      "@type": "GeoCoordinates",
      "latitude": 95.0, // Invalid latitude > 90
      "longitude": -190.0 // Invalid longitude < -180
    };

    const ast = builder.build(outOfBoundsCoords);
    const errors = validator.validate(ast);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(err => err.includes("latitude") && err.includes("must be within"))).toBe(true);
    expect(errors.some(err => err.includes("longitude") && err.includes("must be within"))).toBe(true);
  });

  it('should issue a warning when Offer has a price but is missing priceCurrency', () => {
    const builder = new ASTBuilder();
    const validator = new SchemaValidator();

    const rawOffer = {
      "@context": "https://schema.org",
      "@type": "Offer",
      "price": 99.99
    };

    const ast = builder.build(rawOffer);
    const errors = validator.validate(ast);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(err => err.includes("priceCurrency") && err.includes("missing"))).toBe(true);
  });

  it('should issue a warning when a Date property represents an invalid calendar date', () => {
    const builder = new ASTBuilder();
    const validator = new SchemaValidator();

    const rawBook = {
      "@context": "https://schema.org",
      "@type": "Book",
      "name": "Leap Year Out of Range",
      "datePublished": "2026-02-29" // 2026 is not a leap year, so Feb 29 is invalid
    };

    const ast = builder.build(rawBook);
    const errors = validator.validate(ast);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(err => err.includes("datePublished") && err.includes("invalid calendar date"))).toBe(true);
  });
});
