import { RawDocument } from '../types/index.js';

export class VersionDetector {
  private static readonly KEYWORDS_1_1 = new Set([
    '@version',
    '@direction',
    '@import',
    '@included',
    '@json',
    '@nest',
    '@none',
    '@prefix',
    '@propagate',
    '@protected'
  ]);

  /**
   * Detects the JSON-LD version from a RawDocument.
   */
  public detect(doc: RawDocument): string {
    if (!doc || typeof doc !== 'object') {
      return '1.0';
    }

    const docArray = Array.isArray(doc) ? doc : [doc];
    let has1_1Keywords = false;
    let explicitVersion: string | null = null;

    const traverse = (node: any) => {
      if (!node || typeof node !== 'object') return;

      if (Array.isArray(node)) {
        node.forEach(traverse);
        return;
      }

      // Check for explicit version inside object
      if ('@version' in node) {
        explicitVersion = String(node['@version']);
      }

      // Check context for version
      if ('@context' in node) {
        const ctx = node['@context'];
        if (typeof ctx === 'object' && ctx !== null) {
          if ('@version' in ctx) {
            explicitVersion = String(ctx['@version']);
          }
        }
      }

      // Check for any 1.1 keywords
      for (const key of Object.keys(node)) {
        if (VersionDetector.KEYWORDS_1_1.has(key)) {
          has1_1Keywords = true;
        }
        traverse(node[key]);
      }
    };

    docArray.forEach(traverse);

    if (explicitVersion) {
      return explicitVersion;
    }

    if (has1_1Keywords) {
      return '1.1';
    }

    // Default/heuristic fallback
    return '1.0';
  }
}
