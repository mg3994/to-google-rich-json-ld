import {
  Config,
  ConvertInput,
  RawDocument,
  SemanticEngine
} from './types/index.js';

import { Parser } from './parser/index.js';
import { VersionDetector } from './version/index.js';
import { ASTBuilder } from './ast/index.js';
import { ASTSerializer } from './serializer/index.js';
import { SemanticProcessor } from './processor/index.js';
import { CompatibilityEngine } from './compatibility/index.js';
import { SchemaValidator } from './validator/index.js';

const defaultConfig: Config = {
  target: "google",
  schemaVersion: "latest",
  jsonldVersion: "auto",
  preserveUnknownKeywords: true,
  removeUnsupportedFeatures: true,
  normalizeIRIs: true,
  fetchRemoteContexts: true,
  cacheContexts: true,
  strict: false
};

export class GoogleRichJsonLdEngine implements SemanticEngine {
  private parser = new Parser();
  private versionDetector = new VersionDetector();
  private astBuilder = new ASTBuilder();
  private serializer = new ASTSerializer();
  private schemaValidator = new SchemaValidator();

  /**
   * Helper to merge user options with default configuration.
   */
  private mergeConfig(options?: Partial<Config>): Config {
    return { ...defaultConfig, ...options };
  }

  /**
   * Transforms any JSON-LD document into a Google Rich Results compatible JSON-LD document.
   */
  public async convert(document: ConvertInput, options?: Partial<Config>): Promise<RawDocument> {
    const config = this.mergeConfig(options);
    const raw = await this.parser.parse(document);

    // Build AST
    const ast = this.astBuilder.build(raw);

    // Core expansion to resolve context values and properties
    const processor = new SemanticProcessor(config);
    const expandedAST = await processor.expand(ast);

    // Run Compatibility & Google Rich Results Layers
    const compatibilityEngine = new CompatibilityEngine(config);
    const transformedAST = compatibilityEngine.transform(expandedAST);

    // Compact back to target Schema.org context (defaulting to https://schema.org)
    const compactedAST = await processor.compact(transformedAST, "https://schema.org");

    // Serialize back to raw JSON object
    return this.serializer.serialize(compactedAST);
  }

  /**
   * Automatically detect JSON-LD version from document.
   */
  public async detectVersion(document: ConvertInput): Promise<string> {
    const raw = await this.parser.parse(document);
    return this.versionDetector.detect(raw);
  }

  /**
   * Normalizes document structure without losing semantic meaning.
   */
  public async normalize(document: ConvertInput, options?: Partial<Config>): Promise<RawDocument> {
    const config = this.mergeConfig(options);
    const raw = await this.parser.parse(document);

    const ast = this.astBuilder.build(raw);
    const processor = new SemanticProcessor(config);
    const expanded = await processor.expand(ast);
    const compacted = await processor.compact(expanded, "https://schema.org");

    return this.serializer.serialize(compacted);
  }

  /**
   * Performs basic JSON-LD syntax checks, Google structured data conformance checks,
   * and deep Schema.org type/property validation using the ingested schema registry.
   */
  public async validate(document: ConvertInput): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    try {
      const raw = await this.parser.parse(document);
      if (!raw || typeof raw !== 'object') {
        errors.push("Document is not a valid JSON-LD object or array.");
        return { valid: false, errors };
      }

      // 1. Basic rich results conformance checks
      const traverse = (node: any) => {
        if (!node || typeof node !== 'object') return;

        if (node['@type'] === 'Product') {
          if (!node['name']) {
            errors.push("Missing required field 'name' for Product type.");
          }
        }
        if (node['@type'] === 'Review') {
          if (!node['reviewRating'] && !node['reviewBody']) {
            errors.push("Review should have either 'reviewRating' or 'reviewBody'.");
          }
        }

        for (const val of Object.values(node)) {
          if (Array.isArray(val)) {
            val.forEach(traverse);
          } else {
            traverse(val);
          }
        }
      };
      traverse(raw);

      // 2. Deep Schema.org type and property validation via AST
      const ast = this.astBuilder.build(raw);
      const schemaErrors = this.schemaValidator.validate(ast);
      errors.push(...schemaErrors);

    } catch (err: any) {
      errors.push(`JSON parsing/validation error: ${err.message}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Programmatic Expansion API.
   */
  public async expand(document: ConvertInput, options?: Partial<Config>): Promise<RawDocument> {
    const config = this.mergeConfig(options);
    const raw = await this.parser.parse(document);
    const ast = this.astBuilder.build(raw);
    const processor = new SemanticProcessor(config);
    const expandedAST = await processor.expand(ast);
    return this.serializer.serialize(expandedAST);
  }

  /**
   * Programmatic Compaction API.
   */
  public async compact(document: ConvertInput, context: any, options?: Partial<Config>): Promise<RawDocument> {
    const config = this.mergeConfig(options);
    const raw = await this.parser.parse(document);
    const ast = this.astBuilder.build(raw);
    const processor = new SemanticProcessor(config);
    const compactedAST = await processor.compact(ast, context);
    return this.serializer.serialize(compactedAST);
  }

  /**
   * Programmatic Flattening API.
   */
  public async flatten(document: ConvertInput, options?: Partial<Config>): Promise<RawDocument> {
    const config = this.mergeConfig(options);
    const raw = await this.parser.parse(document);
    const ast = this.astBuilder.build(raw);
    const processor = new SemanticProcessor(config);
    const flattenedAST = processor.flatten(ast);
    return this.serializer.serialize(flattenedAST);
  }

  /**
   * Programmatic Flattening API.
   */
  public async frame(document: ConvertInput, frameSpec: any, options?: Partial<Config>): Promise<RawDocument> {
    const config = this.mergeConfig(options);
    const raw = await this.parser.parse(document);
    const ast = this.astBuilder.build(raw);
    const processor = new SemanticProcessor(config);
    const framedAST = processor.frame(ast, frameSpec);
    return this.serializer.serialize(framedAST);
  }

  /**
   * Performs deep semantic metadata analysis on the document.
   */
  public async analyze(document: ConvertInput): Promise<{
    version: string;
    keywordsUsed: string[];
    unknownKeywords: string[];
    schemaTypes: string[];
    contextUrls: string[];
  }> {
    const raw = await this.parser.parse(document);
    const version = this.versionDetector.detect(raw);

    const keywordsUsed = new Set<string>();
    const unknownKeywords = new Set<string>();
    const schemaTypes = new Set<string>();
    const contextUrls = new Set<string>();

    const traverse = (node: any) => {
      if (!node || typeof node !== 'object') return;

      if (Array.isArray(node)) {
        node.forEach(traverse);
        return;
      }

      if ('@context' in node) {
        const ctx = node['@context'];
        if (typeof ctx === 'string') {
          contextUrls.add(ctx);
        } else if (Array.isArray(ctx)) {
          ctx.forEach(c => {
            if (typeof c === 'string') contextUrls.add(c);
          });
        }
      }

      if ('@type' in node) {
        const t = node['@type'];
        if (Array.isArray(t)) {
          t.forEach(item => schemaTypes.add(String(item)));
        } else if (typeof t === 'string') {
          schemaTypes.add(t);
        }
      }

      for (const [k, v] of Object.entries(node)) {
        if (k.startsWith('@')) {
          keywordsUsed.add(k);
          const isKnown = k === '@context' || k === '@type' || k === '@id' || k === '@value' || k === '@language' || k === '@graph' || k === '@list' || k === '@set' || k === '@reverse' || k === '@index' || k === '@base' || k === '@vocab' || k === '@version' || k === '@direction' || k === '@import' || k === '@included' || k === '@json' || k === '@nest' || k === '@none' || k === '@prefix' || k === '@propagate' || k === '@protected' || k === '@container';
          if (!isKnown) {
            unknownKeywords.add(k);
          }
        }
        traverse(v);
      }
    };

    traverse(raw);

    return {
      version,
      keywordsUsed: Array.from(keywordsUsed),
      unknownKeywords: Array.from(unknownKeywords),
      schemaTypes: Array.from(schemaTypes),
      contextUrls: Array.from(contextUrls)
    };
  }
}

// Export default helper instance and static functions
const engine = new GoogleRichJsonLdEngine();

export const convert = (doc: ConvertInput, options?: Partial<Config>) => engine.convert(doc, options);
export const detectVersion = (doc: ConvertInput) => engine.detectVersion(doc);
export const normalize = (doc: ConvertInput, options?: Partial<Config>) => engine.normalize(doc, options);
export const validate = (doc: ConvertInput) => engine.validate(doc);
export const expand = (doc: ConvertInput, options?: Partial<Config>) => engine.expand(doc, options);
export const compact = (doc: ConvertInput, context: any, options?: Partial<Config>) => engine.compact(doc, context, options);
export const flatten = (doc: ConvertInput, options?: Partial<Config>) => engine.flatten(doc, options);
export const frame = (doc: ConvertInput, frameSpec: any, options?: Partial<Config>) => engine.frame(doc, frameSpec, options);
export const analyze = (doc: ConvertInput) => engine.analyze(doc);
