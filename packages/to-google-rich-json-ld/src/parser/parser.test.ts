import { describe, it, expect } from 'vitest';
import { Parser } from './index.js';
import { Readable } from 'stream';

describe('Parser', () => {
  it('should parse a standard JSON string', async () => {
    const parser = new Parser();
    const result = await parser.parse('{"@context": "https://schema.org", "@type": "Product", "name": "Apple"}');
    expect(result.name).toBe('Apple');
    expect(result['@type']).toBe('Product');
  });

  it('should deeply clone an object to ensure immutability', async () => {
    const parser = new Parser();
    const original = { name: 'Banana', details: { color: 'yellow' } };
    const result = await parser.parse(original);

    expect(result).toEqual(original);
    expect(result).not.toBe(original);
    expect(result.details).not.toBe(original.details);
  });

  it('should parse a stream input', async () => {
    const parser = new Parser();
    const stream = Readable.from(['{"@context": "https:', '//schema.org", "@type": "Book"}']);
    const result = await parser.parse(stream);

    expect(result['@type']).toBe('Book');
  });

  it('should parse a Buffer input', async () => {
    const parser = new Parser();
    const buf = Buffer.from('{"name": "Orange"}');
    const result = await parser.parse(buf);

    expect(result.name).toBe('Orange');
  });
});
