import { describe, it, expect } from 'vitest';
import { Tokenizer } from './index.js';

describe('Tokenizer', () => {
  it('should successfully tokenize raw JSON-LD keywords and structure', () => {
    const jsonld = '{"@context": "https://schema.org", "name": "Alice"}';
    const tokenizer = new Tokenizer(jsonld);
    const tokens = tokenizer.tokenize();

    expect(tokens.length).toBeGreaterThan(0);

    const braceOpen = tokens[0];
    expect(braceOpen.type).toBe('BraceOpen');

    const contextToken = tokens[1];
    expect(contextToken.type).toBe('Keyword');
    expect(contextToken.value).toBe('@context');

    const colon = tokens[2];
    expect(colon.type).toBe('Colon');

    const urlToken = tokens[3];
    expect(urlToken.type).toBe('IRI');
    expect(urlToken.value).toBe('https://schema.org');
  });
});
