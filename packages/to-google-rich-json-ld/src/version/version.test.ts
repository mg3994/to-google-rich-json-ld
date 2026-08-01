import { describe, it, expect } from 'vitest';
import { VersionDetector } from './index.js';

describe('VersionDetector', () => {
  it('should default to 1.0 for standard simple documents', () => {
    const detector = new VersionDetector();
    const doc = {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": "Widget"
    };
    expect(detector.detect(doc)).toBe('1.0');
  });

  it('should detect 1.1 explicitly via @version', () => {
    const detector = new VersionDetector();
    const doc = {
      "@context": {
        "@version": 1.1,
        "@vocab": "https://schema.org/"
      },
      "@type": "Product",
      "name": "Widget"
    };
    expect(detector.detect(doc)).toBe('1.1');
  });

  it('should detect 1.1 via 1.1 keywords', () => {
    const detector = new VersionDetector();
    const doc = {
      "@context": "https://schema.org",
      "@type": "Person",
      "name": "Jane",
      "@nest": {
        "jobTitle": "Engineer"
      }
    };
    expect(detector.detect(doc)).toBe('1.1');
  });
});
