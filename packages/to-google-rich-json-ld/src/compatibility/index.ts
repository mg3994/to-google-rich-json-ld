import {
  ASTNode,
  Config,
  Plugin,
  DocumentNode,
  NodeObjectNode,
  ValueObjectNode,
  GraphObjectNode,
  ReverseObjectNode,
  IncludedObjectNode,
  ContextNode,
  ListObjectNode,
  SetObjectNode
} from '../types/index.js';

import {
  DocumentNodeImpl,
  ContextNodeImpl,
  NodeObjectNodeImpl,
  ValueObjectNodeImpl,
  GraphObjectNodeImpl,
  SetObjectNodeImpl,
  LiteralNodeImpl,
  ListObjectNodeImpl
} from '../ast/index.js';

import keywordsMetadata from '../generated/keywords.json' with { type: 'json' };
import schemaMetadata from '../generated/schema.json' with { type: 'json' };

function extractContextDefaults(ctx: any): Record<string, any> {
  const defaults: Record<string, any> = {};
  if (!ctx) return defaults;

  if (Array.isArray(ctx)) {
    for (const item of ctx) {
      Object.assign(defaults, extractContextDefaults(item));
    }
  } else if (typeof ctx === 'object' && ctx !== null) {
    if ('@base' in ctx) defaults['@base'] = ctx['@base'];
    if ('@language' in ctx) defaults['@language'] = ctx['@language'];
    if ('@direction' in ctx) defaults['@direction'] = ctx['@direction'];
  }
  return defaults;
}

const areNodesEqual = (node1: ASTNode, node2: ASTNode, visited = new Set<string>()): boolean => {
  if (node1.type !== node2.type) return false;
  if (node1.type === "Literal" || node1.type === "IRI" || node1.type === "BlankNode" || node1.type === "Keyword") {
    return (node1 as any).value === (node2 as any).value;
  }
  if (node1.type === "ValueObject") {
    const v1 = node1 as ValueObjectNode;
    const v2 = node2 as ValueObjectNode;
    return v1.value === v2.value && v1.language === v2.language && v1.direction === v2.direction && v1.dataType === v2.dataType;
  }
  if (node1.type === "NodeObject") {
    const n1 = node1 as NodeObjectNode;
    const n2 = node2 as NodeObjectNode;
    if (n1.id !== n2.id) return false;

    // Cycle detection for deep comparison
    const pairKey = `${n1.id || 'b1'}_${n2.id || 'b2'}`;
    if (visited.has(pairKey)) {
      return true; // Match found or cyclic fallback to avoid infinite loops
    }
    visited.add(pairKey);

    if (n1.types.length !== n2.types.length || !n1.types.every((t, i) => t === n2.types[i])) return false;
    const keys1 = Object.keys(n1.properties);
    const keys2 = Object.keys(n2.properties);
    if (keys1.length !== keys2.length) return false;
    const match = keys1.every(k => {
      const val1 = n1.properties[k];
      const val2 = n2.properties[k];
      if (!val2) return false;
      if (val1.length !== val2.length) return false;
      return val1.every((item, idx) => areNodesEqual(item, val2[idx], visited));
    });

    visited.delete(pairKey);
    return match;
  }
  if (node1.type === "ListObject") {
    const l1 = node1 as ListObjectNode;
    const l2 = node2 as ListObjectNode;
    if (l1.list.length !== l2.list.length) return false;
    return l1.list.every((item, idx) => areNodesEqual(item, l2.list[idx], visited));
  }
  if (node1.type === "SetObject") {
    const s1 = node1 as SetObjectNode;
    const s2 = node2 as SetObjectNode;
    if (s1.set.length !== s2.set.length) return false;
    return s1.set.every((item, idx) => areNodesEqual(item, s2.set[idx], visited));
  }
  return false;
};

export class CompatibilityEngine {
  private plugins: Plugin[] = [];
  private config: Config;

  // Public warnings array to collect and expose semantic mapping warnings
  public warnings: string[] = [];

  constructor(config: Config) {
    this.config = config;
    this.registerDefaultPlugins();
  }

  public registerPlugin(plugin: Plugin) {
    this.plugins.push(plugin);
  }

  private registerDefaultPlugins() {
    this.registerPlugin(this.createSchemaPlugin());
    this.registerPlugin(this.createGooglePlugin());
  }

  /**
   * Applies all compatibility transformations across registered plugins to the AST.
   */
  public transform(doc: DocumentNode): DocumentNode {
    let transformedDoc = doc;
    this.warnings = [];

    // Extract default context values (@base) to allow relative URL expansions in properties
    const defaults = extractContextDefaults(doc.context ? doc.context.value : null);
    const base = defaults['@base'] || '';

    // Run plug-in transform pipelines
    for (const plugin of this.plugins) {
      if (plugin.transforms) {
        for (const transformFn of plugin.transforms) {
          transformedDoc = this.transformDocumentWithFn(transformedDoc, transformFn, base);
        }
      }
    }

    // Run custom non-corrupting global hoisting for Google Compatibility
    if (this.config.target === "google") {
      transformedDoc = this.hoistGlobalEntities(transformedDoc);
    }

    return transformedDoc;
  }

  private transformDocumentWithFn(
    doc: DocumentNode,
    fn: (node: ASTNode, config: Config, base?: string) => ASTNode,
    base: string
  ): DocumentNode {
    const visitedNodes = new Set<ASTNode>();

    const transformNode = (node: ASTNode): ASTNode => {
      if (visitedNodes.has(node)) {
        return node; // Return node as-is if circular path detected
      }
      visitedNodes.add(node);

      let updatedNode = fn(node, this.config, base);

      if (updatedNode.type === "NodeObject") {
        const properties: Record<string, ASTNode[]> = {};
        for (const [k, v] of Object.entries(updatedNode.properties)) {
          properties[k] = v.map(transformNode);
        }
        const result = new NodeObjectNodeImpl(updatedNode.id, updatedNode.types, properties);
        visitedNodes.delete(node);
        return result;
      }

      if (updatedNode.type === "GraphObject") {
        const result = new GraphObjectNodeImpl(updatedNode.id, updatedNode.graph.map(transformNode));
        visitedNodes.delete(node);
        return result;
      }

      if (updatedNode.type === "SetObject") {
        const result = new SetObjectNodeImpl(updatedNode.set.map(transformNode));
        visitedNodes.delete(node);
        return result;
      }

      if (updatedNode.type === "Document") {
        const body = updatedNode.body.map(transformNode);
        const context = updatedNode.context ? transformNode(updatedNode.context) as ContextNode : null;
        const result = new DocumentNodeImpl(context, body);
        visitedNodes.delete(node);
        return result;
      }

      visitedNodes.delete(node);
      return updatedNode;
    };

    return transformNode(doc) as DocumentNode;
  }

  /**
   * Global non-corrupting hoisting walker:
   * Extracts @reverse and @included secondary/nested nodes, cleans parent properties,
   * and hoists everything cleanly into a root-level Set or Graph representation.
   */
  private hoistGlobalEntities(doc: DocumentNode): DocumentNode {
    const mainNodes: ASTNode[] = [];
    const hoistedNodes: ASTNode[] = [];
    let blankNodeCounter = 0;
    const visitedWalkNodes = new Set<ASTNode>();

    const getNextBlankNodeId = (): string => `_:b${blankNodeCounter++}`;

    const isTypeInAllowedRange = (typeName: string, allowedRanges: string[]): boolean => {
      if (allowedRanges.length === 0) return true;
      let current: string | null = typeName;
      const visited = new Set<string>();
      while (current && !visited.has(current)) {
        visited.add(current);
        if (allowedRanges.includes(current)) return true;
        const def: { parent: string | null; properties: string[] } | undefined = (schemaMetadata.types as any)[current];
        current = def ? def.parent : null;
      }
      return false;
    };

    const walkAndExtract = (node: ASTNode): ASTNode => {
      if (visitedWalkNodes.has(node)) {
        return node;
      }
      visitedWalkNodes.add(node);

      if (node.type === "NodeObject") {
        const nodeId = node.id || null;
        const parentNode = new NodeObjectNodeImpl(nodeId, node.types, node.properties);

        const cleanProperties: Record<string, ASTNode[]> = {};
        let hasIncluded = false;
        let includedNode: IncludedObjectNode | null = null;
        let hasReverse = false;
        let reverseNode: ReverseObjectNode | null = null;

        for (const [k, v] of Object.entries(node.properties)) {
          if (k === '@included' && v.length > 0 && v[0].type === "IncludedObject") {
            hasIncluded = true;
            includedNode = v[0] as IncludedObjectNode;
          } else if (k === '@reverse' && v.length > 0 && v[0].type === "ReverseObject") {
            hasReverse = true;
            reverseNode = v[0] as ReverseObjectNode;
          } else {
            cleanProperties[k] = v.map(walkAndExtract);
          }
        }

        // Only assign a blank node ID if it's referenced and doesn't already have one
        let activeNodeId = nodeId;
        if (!activeNodeId && hasReverse) {
          activeNodeId = getNextBlankNodeId();
        }

        const cleanParentNode = new NodeObjectNodeImpl(activeNodeId, node.types, cleanProperties);

        // Process @included
        if (hasIncluded && includedNode) {
          includedNode.included.forEach(child => {
            hoistedNodes.push(walkAndExtract(child));
          });
        }

        // Process @reverse with strict domain/range checks and shallow NodeReference linking
        if (hasReverse && reverseNode) {
          for (const [propName, childNodes] of Object.entries(reverseNode.properties)) {
            const propLocalName = propName.replace("https://schema.org/", "").replace("http://schema.org/", "");
            const propDef: { domain: string[]; range: string[] } | undefined = (schemaMetadata.properties as any)[propLocalName];
            const allowedRanges: string[] = propDef ? propDef.range : [];

            // Check if our parent node's type matches the allowed ranges for this property
            let isSemanticallyValid = false;
            if (cleanParentNode.types.length === 0) {
              isSemanticallyValid = true; // allow if parent type is unknown
            } else {
              for (const parentTypeIRI of cleanParentNode.types) {
                const parentTypeName = parentTypeIRI.replace("https://schema.org/", "").replace("http://schema.org/", "");
                if (isTypeInAllowedRange(parentTypeName, allowedRanges)) {
                  isSemanticallyValid = true;
                  break;
                }
              }
            }

            if (isSemanticallyValid) {
              for (const child of childNodes) {
                if (child.type === "NodeObject") {
                  const childProperties = { ...child.properties };

                  // OPTION A (Best Practice): Represent parent reference as a pure reference link with ONLY @id (no duplicated type or name!)
                  const parentReference = new NodeObjectNodeImpl(cleanParentNode.id, [], {});
                  childProperties[propName] = [parentReference];

                  const updatedChild = new NodeObjectNodeImpl(child.id, child.types, childProperties);
                  hoistedNodes.push(walkAndExtract(updatedChild));
                } else {
                  hoistedNodes.push(walkAndExtract(child));
                }
              }
            } else {
              const warnMsg = `Omitted semantically invalid reverse relationship: parent of type(s) [${cleanParentNode.types.join(", ")}] cannot be assigned to property '${propName}' (expects range types/subtypes: [${allowedRanges.join(", ")}])`;
              this.warnings.push(warnMsg);
              console.warn(warnMsg);
            }
          }
        }

        visitedWalkNodes.delete(node);
        return cleanParentNode;
      }

      if (node.type === "GraphObject") {
        const result = new GraphObjectNodeImpl(node.id, node.graph.map(walkAndExtract));
        visitedWalkNodes.delete(node);
        return result;
      }

      if (node.type === "SetObject") {
        const result = new SetObjectNodeImpl(node.set.map(walkAndExtract));
        visitedWalkNodes.delete(node);
        return result;
      }

      visitedWalkNodes.delete(node);
      return node;
    };

    for (const item of doc.body) {
      mainNodes.push(walkAndExtract(item));
    }

    if (hoistedNodes.length > 0) {
      // Group all hoisted and main nodes cleanly into a root-level @graph structure (Option A best practice)
      const allNodes = [...mainNodes, ...hoistedNodes];
      return new DocumentNodeImpl(doc.context, [new GraphObjectNodeImpl(null, allNodes)]);
    }

    return new DocumentNodeImpl(doc.context, mainNodes);
  }

  /**
   * Schema.org Plugin: Handles canonical property translation and superseded term cleanup.
   */
  private createSchemaPlugin(): Plugin {
    return {
      name: "SchemaPlugin",
      transforms: [
        (node: ASTNode, config: Config): ASTNode => {
          if (node.type === "NodeObject") {
            const properties: Record<string, ASTNode[]> = {};
            const supersededRecord = {
              ...schemaMetadata.superseded,
              "vendor": "seller", // Cleanly map superseded vendor property to seller
              "https://schema.org/vendor": "https://schema.org/seller",
              "http://schema.org/vendor": "https://schema.org/seller"
            } as Record<string, string>;

            for (const [k, v] of Object.entries(node.properties)) {
              let finalKey = k;
              if (supersededRecord[k]) {
                finalKey = supersededRecord[k];
              }
              properties[finalKey] = v;
            }
            return new NodeObjectNodeImpl(node.id, node.types, properties);
          }
          return node;
        }
      ]
    };
  }

  /**
   * Google Plugin: Google Rich Results Compatibility Layer.
   */
  private createGooglePlugin(): Plugin {
    return {
      name: "GooglePlugin",
      transforms: [
        // 1. Simplify single-node graph structures: if root is a GraphObject with 1 element, hoist it.
        (node: ASTNode, config: Config): ASTNode => {
          if (config.target === "google" && node.type === "Document") {
            if (node.body.length === 1 && node.body[0].type === "GraphObject") {
              const graphNode = node.body[0] as GraphObjectNode;
              if (graphNode.graph.length === 1) {
                return new DocumentNodeImpl(node.context, [graphNode.graph[0]]);
              }
            }
          }
          return node;
        },

        // 2. Normalize, Secure, and Deduplicate Schema.org IRI schemas & Enum URLs: http -> https
        (node: ASTNode, config: Config): ASTNode => {
          if (node.type === "Context" && typeof node.value === 'string') {
            if (node.value.startsWith("http://schema.org")) {
              return new ContextNodeImpl(node.value.replace("http://schema.org", "https://schema.org"));
            }
          }

          if (config.target === "google") {
            // Secure and deduplicate types, and secure IDs in NodeObjects
            if (node.type === "NodeObject") {
              const types = Array.from(new Set(node.types.map(t => t.startsWith("http://schema.org") ? t.replace("http://schema.org", "https://schema.org") : t)));
              const id = node.id && node.id.startsWith("http://schema.org") ? node.id.replace("http://schema.org", "https://schema.org") : node.id;

              const properties: Record<string, ASTNode[]> = {};
              for (const [k, v] of Object.entries(node.properties)) {
                const secureKey = k.startsWith("http://schema.org/") ? k.replace("http://schema.org/", "https://schema.org/") : k;
                properties[secureKey] = v;
              }
              return new NodeObjectNodeImpl(id, types, properties);
            }

            // Secure enum values inside ValueObjects
            if (node.type === "ValueObject") {
              const dataType = node.dataType && node.dataType.startsWith("http://schema.org") ? node.dataType.replace("http://schema.org", "https://schema.org") : node.dataType;
              const value = typeof node.value === 'string' && node.value.startsWith("http://schema.org") ? node.value.replace("http://schema.org", "https://schema.org") : node.value;
              return new ValueObjectNodeImpl(value, node.language, node.direction, dataType);
            }

            // Secure enum values inside LiteralNodes
            if (node.type === "Literal" && typeof node.value === 'string') {
              if (node.value.startsWith("http://schema.org")) {
                return new LiteralNodeImpl(node.value.replace("http://schema.org", "https://schema.org"));
              }
            }
          }
          return node;
        },

        // 3. Canonicalize and Secure Schema.org Enum values
        (node: ASTNode, config: Config): ASTNode => {
          if (config.target === "google" && node.type === "NodeObject") {
            const properties: Record<string, ASTNode[]> = {};
            const ENUM_PROPERTIES = new Set([
              "availability", "itemCondition", "dayOfWeek", "bookFormat", "paymentStatus", "contactType",
              "https://schema.org/availability", "https://schema.org/itemCondition", "https://schema.org/dayOfWeek", "https://schema.org/bookFormat", "https://schema.org/paymentStatus", "https://schema.org/contactType",
              "http://schema.org/availability", "http://schema.org/itemCondition", "http://schema.org/dayOfWeek", "http://schema.org/bookFormat", "http://schema.org/paymentStatus", "http://schema.org/contactType"
            ]);
            const KNOWN_ENUM_VALUES = new Set([
              "InStock", "OutOfStock", "PreOrder", "InStoreOnly", "OnlineOnly", "Discontinued", "LimitedAvailability", "SoldOut",
              "NewCondition", "UsedCondition", "RefurbishedCondition", "DamagedCondition",
              "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
              "Hardcover", "Paperback", "EBook", "Audiobook"
            ]);

            const cleanEnumString = (valStr: string, propKey: string): string => {
              let cleaned = valStr;
              if (cleaned.startsWith("http://schema.org")) {
                cleaned = cleaned.replace("http://schema.org", "https://schema.org");
              }
              if (KNOWN_ENUM_VALUES.has(cleaned) || (ENUM_PROPERTIES.has(propKey) && !cleaned.includes(":"))) {
                return "https://schema.org/" + cleaned;
              }
              return cleaned;
            };

            for (const [k, v] of Object.entries(node.properties)) {
              properties[k] = v.map(item => {
                if (item.type === "Literal" && typeof item.value === 'string') {
                  return new LiteralNodeImpl(cleanEnumString(item.value, k));
                }

                if (item.type === "ValueObject" && typeof item.value === 'string') {
                  return new ValueObjectNodeImpl(cleanEnumString(item.value, k), item.language, item.direction, item.dataType);
                }

                if (item.type === "NodeObject") {
                  if (item.id && (ENUM_PROPERTIES.has(k) || KNOWN_ENUM_VALUES.has(item.id.replace("https://schema.org/", "").replace("http://schema.org/", "")))) {
                    const cleanedId = cleanEnumString(item.id, k);
                    return new NodeObjectNodeImpl(cleanedId, item.types, item.properties);
                  }
                }

                return item;
              });
            }
            return new NodeObjectNodeImpl(node.id, node.types, properties);
          }
          return node;
        },

        // 4. Strip unknown/experimental keywords & nested features ignored by Google
        // and hoist @nest nested properties to parent.
        (node: ASTNode, config: Config): ASTNode => {
          if (config.target === "google" && node.type === "NodeObject") {
            const properties: Record<string, ASTNode[]> = {};
            for (const [k, v] of Object.entries(node.properties)) {
              // Hoist @nest properties
              if (k === '@nest' && v.length > 0 && v[0].type === "NodeObject") {
                const nestObj = v[0] as NodeObjectNode;
                for (const [nestK, nestV] of Object.entries(nestObj.properties)) {
                  properties[nestK] = nestV;
                }
                continue;
              }

              // Ignore standard keywords Google ignores (like @index, @protected, @propagate)
              const kwMeta = keywordsMetadata.find(m => m.keyword === k);
              if (kwMeta && kwMeta.googleSupport === "ignored") {
                continue;
              }

              // Prune Unknown/Future keywords to prevent validation errors
              if (k.startsWith('@') && !kwMeta) {
                continue;
              }

              properties[k] = v;
            }
            return new NodeObjectNodeImpl(node.id, node.types, properties);
          }
          return node;
        },

        // 5. Datetime ISO8601 Normalization, Numeric Field Cleaning, Empty Property Pruning,
        // Auto-wrapping of lists, Nested Type Inference, Relative URL Expansion, Rating Normalization, SameAs securing,
        // Singularization / Pluralization, White-space normalization, ISBN Normalization, DayOfWeek Normalization,
        // PostalCode / Coordinate Normalization, Property Casing Correction, and Structural Value Deduplication.
        (node: ASTNode, config: Config, base?: string): ASTNode => {
          if (config.target === "google" && node.type === "NodeObject") {
            const properties: Record<string, ASTNode[]> = {};
            const NUMERIC_PROPERTIES = new Set([
              "price", "ratingValue", "reviewCount", "lowPrice", "highPrice", "priceMin", "priceMax", "bestRating", "worstRating",
              "https://schema.org/price", "https://schema.org/ratingValue", "https://schema.org/reviewCount", "https://schema.org/lowPrice", "https://schema.org/highPrice"
            ]);
            const URL_PROPERTIES = new Set([
              "image", "logo", "url", "sameAs", "hasPart", "partOf", "itemReviewed",
              "https://schema.org/image", "https://schema.org/logo", "https://schema.org/url", "https://schema.org/sameAs"
            ]);
            const LIST_PROPERTIES = new Set([
              "itemListElement", "recipeInstructions",
              "https://schema.org/itemListElement", "https://schema.org/recipeInstructions"
            ]);
            const PLURAL_TO_SINGULAR_MAP: Record<string, string> = {
              "reviews": "review",
              "awards": "award",
              "additionalTypes": "additionalType",
              "founders": "founder",
              "employees": "employee"
            };
            const TEXT_NORMALIZATION_PROPERTIES = new Set([
              "name", "headline", "sku", "mpn", "telephone", "email",
              "https://schema.org/name", "https://schema.org/headline", "https://schema.org/sku", "https://schema.org/mpn", "https://schema.org/telephone", "https://schema.org/email"
            ]);
            const COORD_PROPERTIES = new Set([
              "latitude", "longitude",
              "https://schema.org/latitude", "https://schema.org/longitude"
            ]);

            const toCamelCase = (str: string): string => {
              if (str.startsWith("@")) return str;
              let cleaned = str.replace(/[-_]([a-z])/g, (_, char) => char.toUpperCase());
              if (cleaned.length > 0 && cleaned[0] === cleaned[0].toUpperCase()) {
                cleaned = cleaned[0].toLowerCase() + cleaned.slice(1);
              }
              return cleaned;
            };

            const isDateField = (key: string): boolean => {
              const localKey = key.replace("https://schema.org/", "").replace("http://schema.org/", "");
              return localKey.toLowerCase().includes("date") || localKey.toLowerCase().includes("time") || localKey === "availabilityStarts" || localKey === "availabilityEnds";
            };

            // Dynamic nested type inference
            let updatedTypes = [...node.types];
            if (updatedTypes.length === 0) {
              const keys = Object.keys(node.properties);
              const isOfferClue = keys.some(key => {
                const localKey = key.replace("https://schema.org/", "").replace("http://schema.org/", "");
                return localKey === "price" || localKey === "priceCurrency" || localKey === "lowPrice" || localKey === "highPrice";
              });
              if (isOfferClue) {
                updatedTypes.push("https://schema.org/Offer");
              }
            }

            const isRatingType = updatedTypes.some(t => {
              const localType = t.replace("https://schema.org/", "").replace("http://schema.org/", "");
              return localType === "Rating" || localType === "AggregateRating";
            });
            const isAggregateRatingType = updatedTypes.some(t => {
              const localType = t.replace("https://schema.org/", "").replace("http://schema.org/", "");
              return localType === "AggregateRating";
            });

            // Phase A: Prefix casing mapping, property casing correction, and singularization with array merging
            const mergedProperties: Record<string, ASTNode[]> = {};
            for (let [k, v] of Object.entries(node.properties)) {
              if (k.startsWith("@")) {
                mergedProperties[k] = v;
                continue;
              }

              // Apply casing correction (e.g. Price_Currency -> priceCurrency)
              const originalLocalKey = k.replace("https://schema.org/", "").replace("http://schema.org/", "");
              const correctedLocalKey = toCamelCase(originalLocalKey);
              let finalK = k;
              if (correctedLocalKey !== originalLocalKey) {
                const namespace = k.startsWith("https://schema.org/") ? "https://schema.org/" : (k.startsWith("http://schema.org/") ? "http://schema.org/" : "");
                finalK = namespace + correctedLocalKey;
              }

              // Singularize property key if plural variant was used
              const localKey = finalK.replace("https://schema.org/", "").replace("http://schema.org/", "");
              if (PLURAL_TO_SINGULAR_MAP[localKey]) {
                const namespace = finalK.startsWith("https://schema.org/") ? "https://schema.org/" : (finalK.startsWith("http://schema.org/") ? "http://schema.org/" : "");
                finalK = namespace + PLURAL_TO_SINGULAR_MAP[localKey];
              }

              mergedProperties[finalK] = [...(mergedProperties[finalK] || []), ...v];
            }

            // Phase B: Normalization, cleaning, and filtering of the merged properties
            for (let [k, v] of Object.entries(mergedProperties)) {
              if (k.startsWith("@")) {
                properties[k] = v;
                continue;
              }

              const localKey = k.replace("https://schema.org/", "").replace("http://schema.org/", "");

              // Auto-wrap itemListElement and recipeInstructions into @list containers
              if (LIST_PROPERTIES.has(k) && v.length > 0) {
                if (v.length === 1 && v[0].type === "ListObject") {
                  properties[k] = v;
                } else {
                  properties[k] = [new ListObjectNodeImpl(v)];
                }
                continue;
              }

              const cleanedList: ASTNode[] = [];
              const isAuthorProp = k === "author" || k === "https://schema.org/author";
              const isByArtistProp = k === "byArtist" || k === "https://schema.org/byArtist";
              const isPerformerProp = k === "performer" || k === "https://schema.org/performer";

              for (const item of v) {
                // Prune empty string literals
                if (item.type === "Literal" && item.value === "") {
                  continue;
                }
                if (item.type === "ValueObject" && item.value === "") {
                  continue;
                }

                // Nested Type Inference for Author sub-objects
                if (isAuthorProp && item.type === "NodeObject" && item.types.length === 0) {
                  cleanedList.push(new NodeObjectNodeImpl(item.id, ["https://schema.org/Person"], item.properties));
                  continue;
                }
                if (isByArtistProp && item.type === "NodeObject" && item.types.length === 0) {
                  cleanedList.push(new NodeObjectNodeImpl(item.id, ["https://schema.org/MusicGroup"], item.properties));
                  continue;
                }
                if (isPerformerProp && item.type === "NodeObject" && item.types.length === 0) {
                  cleanedList.push(new NodeObjectNodeImpl(item.id, ["https://schema.org/PerformingGroup"], item.properties));
                  continue;
                }

                // Datetime ISO8601 Normalization
                if (isDateField(k)) {
                  if (item.type === "Literal" && typeof item.value === 'string') {
                    // Normalize "YYYY-MM-DD HH:MM:SS" -> "YYYY-MM-DDTHH:MM:SS"
                    const val = item.value.trim();
                    const dateTimeWithSpaceRegex = /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})(.*)$/;
                    if (dateTimeWithSpaceRegex.test(val)) {
                      const normalized = val.replace(dateTimeWithSpaceRegex, "$1T$2$3");
                      cleanedList.push(new LiteralNodeImpl(normalized));
                      continue;
                    }
                  }
                  if (item.type === "ValueObject" && typeof item.value === 'string') {
                    const val = item.value.trim();
                    const dateTimeWithSpaceRegex = /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})(.*)$/;
                    if (dateTimeWithSpaceRegex.test(val)) {
                      const normalized = val.replace(dateTimeWithSpaceRegex, "$1T$2$3");
                      cleanedList.push(new ValueObjectNodeImpl(normalized, item.language, item.direction, item.dataType));
                      continue;
                    }
                  }
                }

                // Numeric Field Cleaning (e.g. "$1,499.00" -> "1499.00") and Rating String Normalization
                const cleanLocalKey = k.replace("https://schema.org/", "").replace("http://schema.org/", "");
                if (NUMERIC_PROPERTIES.has(cleanLocalKey) || NUMERIC_PROPERTIES.has(k)) {
                  if (item.type === "Literal" && typeof item.value === 'string') {
                    let val = item.value.trim();
                    if (cleanLocalKey === "ratingValue" || cleanLocalKey === "bestRating" || cleanLocalKey === "worstRating") {
                      val = val.replace(/,/g, '.');
                    }
                    // Strip currency symbols and commas (thousands separator)
                    let cleaned = val.replace(/[$,€,£,¥]/g, '').replace(/,/g, '');
                    // Convert to float if it matches a valid number pattern, otherwise keep clean string
                    if (/^-?\d+(?:\.\d+)?$/.test(cleaned)) {
                      cleanedList.push(new LiteralNodeImpl(parseFloat(cleaned)));
                    } else {
                      cleanedList.push(new LiteralNodeImpl(cleaned));
                    }
                    continue;
                  }
                  if (item.type === "ValueObject" && typeof item.value === 'string') {
                    let val = item.value.trim();
                    if (cleanLocalKey === "ratingValue" || cleanLocalKey === "bestRating" || cleanLocalKey === "worstRating") {
                      val = val.replace(/,/g, '.');
                    }
                    let cleaned = val.replace(/[$,€,£,¥]/g, '').replace(/,/g, '');
                    cleanedList.push(new ValueObjectNodeImpl(cleaned, item.language, item.direction, item.dataType));
                    continue;
                  }
                }

                // Coordinate (latitude, longitude) string-to-number normalization
                if (COORD_PROPERTIES.has(k)) {
                  if (item.type === "Literal" && typeof item.value === 'string') {
                    const cleaned = item.value.trim().replace(/,/g, '.');
                    if (/^-?\d+(?:\.\d+)?$/.test(cleaned)) {
                      cleanedList.push(new LiteralNodeImpl(parseFloat(cleaned)));
                      continue;
                    }
                  }
                  if (item.type === "ValueObject" && typeof item.value === 'string') {
                    const cleaned = item.value.trim().replace(/,/g, '.');
                    if (/^-?\d+(?:\.\d+)?$/.test(cleaned)) {
                      cleanedList.push(new ValueObjectNodeImpl(parseFloat(cleaned), item.language, item.direction, item.dataType));
                      continue;
                    }
                  }
                }

                // PostalCode trimming and cleaning
                if (cleanLocalKey === "postalCode" || k === "postalCode" || k === "https://schema.org/postalCode") {
                  if (item.type === "Literal" && typeof item.value === 'string') {
                    cleanedList.push(new LiteralNodeImpl(item.value.trim()));
                    continue;
                  }
                  if (item.type === "ValueObject" && typeof item.value === 'string') {
                    cleanedList.push(new ValueObjectNodeImpl(item.value.trim(), item.language, item.direction, item.dataType));
                    continue;
                  }
                }

                // Price Currency Symbol Extraction (e.g. "$" -> "USD")
                const isPriceCurrencyProp = k === "priceCurrency" || k === "https://schema.org/priceCurrency";
                if (isPriceCurrencyProp) {
                  if (item.type === "Literal" && typeof item.value === 'string') {
                    const val = item.value.trim();
                    const SYMBOL_TO_ISO: Record<string, string> = {
                      "$": "USD",
                      "€": "EUR",
                      "£": "GBP",
                      "¥": "JPY",
                      "C$": "CAD",
                      "A$": "AUD"
                    };
                    if (SYMBOL_TO_ISO[val]) {
                      cleanedList.push(new LiteralNodeImpl(SYMBOL_TO_ISO[val]));
                      continue;
                    }
                  }
                }

                // HTML Tag Stripping for description, reviewBody, and headline properties
                const isDescriptionOrBody = cleanLocalKey === "description" || cleanLocalKey === "reviewBody" || cleanLocalKey === "headline";
                if (isDescriptionOrBody) {
                  if (item.type === "Literal" && typeof item.value === 'string') {
                    let val = item.value;
                    if (/<[a-z/][^>]*>/i.test(val)) {
                      val = val.replace(/<[^>]*>/g, '').trim();
                    }
                    cleanedList.push(new LiteralNodeImpl(val));
                    continue;
                  }
                  if (item.type === "ValueObject" && typeof item.value === 'string') {
                    let val = item.value;
                    if (/<[a-z/][^>]*>/i.test(val)) {
                      val = val.replace(/<[^>]*>/g, '').trim();
                    }
                    cleanedList.push(new ValueObjectNodeImpl(val, item.language, item.direction, item.dataType));
                    continue;
                  }
                }

                // Telephone and text field whitespace / trailing space / tab normalization
                if (TEXT_NORMALIZATION_PROPERTIES.has(k)) {
                  if (item.type === "Literal" && typeof item.value === 'string') {
                    const val = item.value.replace(/\s+/g, ' ').trim();
                    cleanedList.push(new LiteralNodeImpl(val));
                    continue;
                  }
                  if (item.type === "ValueObject" && typeof item.value === 'string') {
                    const val = item.value.replace(/\s+/g, ' ').trim();
                    cleanedList.push(new ValueObjectNodeImpl(val, item.language, item.direction, item.dataType));
                    continue;
                  }
                }

                // ISBN Normalization (stripping "ISBN" labels, hyphens, and spaces)
                const isIsbnProp = cleanLocalKey === "isbn" || k === "isbn" || k === "https://schema.org/isbn";
                if (isIsbnProp) {
                  if (item.type === "Literal" && typeof item.value === 'string') {
                    let val = item.value.replace(/isbn/i, '').replace(/[\s-]/g, '').trim();
                    cleanedList.push(new LiteralNodeImpl(val));
                    continue;
                  }
                  if (item.type === "ValueObject" && typeof item.value === 'string') {
                    let val = item.value.replace(/isbn/i, '').replace(/[\s-]/g, '').trim();
                    cleanedList.push(new ValueObjectNodeImpl(val, item.language, item.direction, item.dataType));
                    continue;
                  }
                }

                // DayOfWeek Normalization (mapping abbreviations and lower days to standard Schema enums)
                const isDayOfWeekProp = cleanLocalKey === "dayOfWeek" || k === "dayOfWeek" || k === "https://schema.org/dayOfWeek";
                if (isDayOfWeekProp) {
                  const dayMap: Record<string, string> = {
                    "mon": "https://schema.org/Monday", "monday": "https://schema.org/Monday",
                    "tue": "https://schema.org/Tuesday", "tuesday": "https://schema.org/Tuesday",
                    "wed": "https://schema.org/Wednesday", "wednesday": "https://schema.org/Wednesday",
                    "thu": "https://schema.org/Thursday", "thursday": "https://schema.org/Thursday",
                    "fri": "https://schema.org/Friday", "friday": "https://schema.org/Friday",
                    "sat": "https://schema.org/Saturday", "saturday": "https://schema.org/Saturday",
                    "sun": "https://schema.org/Sunday", "sunday": "https://schema.org/Sunday"
                  };
                  if (item.type === "Literal" && typeof item.value === 'string') {
                    const localVal = item.value.replace("https://schema.org/", "").replace("http://schema.org/", "").trim().toLowerCase();
                    if (dayMap[localVal]) {
                      cleanedList.push(new LiteralNodeImpl(dayMap[localVal]));
                      continue;
                    }
                  }
                  if (item.type === "ValueObject" && typeof item.value === 'string') {
                    const localVal = item.value.replace("https://schema.org/", "").replace("http://schema.org/", "").trim().toLowerCase();
                    if (dayMap[localVal]) {
                      cleanedList.push(new ValueObjectNodeImpl(dayMap[localVal], item.language, item.direction, item.dataType));
                      continue;
                    }
                  }
                }

                // Relative URL Value Expansion & Protocol-relative URL securing using @base
                if (URL_PROPERTIES.has(k)) {
                  const isSameAsProp = k === "sameAs" || k === "https://schema.org/sameAs";

                  if (item.type === "Literal" && typeof item.value === 'string') {
                    let val = item.value.trim();
                    if (val.startsWith("//")) {
                      val = "https:" + val;
                    }
                    if (isSameAsProp && val.startsWith("http://")) {
                      const lower = val.toLowerCase();
                      const domains = ["twitter.com", "x.com", "facebook.com", "instagram.com", "linkedin.com", "youtube.com", "wikipedia.org"];
                      if (domains.some(d => lower.includes("://" + d) || lower.includes("://www." + d))) {
                        val = val.replace(/^http:\/\//i, "https:////").replace("https:////", "https://");
                      }
                    }

                    if (base && !val.includes("://") && !val.startsWith("data:") && !val.startsWith("mailto:") && !val.startsWith("tel:")) {
                      try {
                        val = new URL(val, base).toString();
                      } catch {
                        // fallback
                      }
                    }
                    cleanedList.push(new LiteralNodeImpl(val));
                    continue;
                  }

                  if (item.type === "ValueObject" && typeof item.value === 'string') {
                    let val = item.value.trim();
                    if (val.startsWith("//")) {
                      val = "https:" + val;
                    }
                    if (isSameAsProp && val.startsWith("http://")) {
                      const lower = val.toLowerCase();
                      const domains = ["twitter.com", "x.com", "facebook.com", "instagram.com", "linkedin.com", "youtube.com", "wikipedia.org"];
                      if (domains.some(d => lower.includes("://" + d) || lower.includes("://www." + d))) {
                        val = val.replace(/^http:\/\//i, "https:////").replace("https:////", "https://");
                      }
                    }

                    if (base && !val.includes("://") && !val.startsWith("data:") && !val.startsWith("mailto:") && !val.startsWith("tel:")) {
                      try {
                        val = new URL(val, base).toString();
                      } catch {
                        // fallback
                      }
                    }
                    cleanedList.push(new ValueObjectNodeImpl(val, item.language, item.direction, item.dataType));
                    continue;
                  }
                }

                cleanedList.push(item);
              }

              // Deep Structural Value Deduplication to remove identical duplicated array items
              const deduplicatedList: ASTNode[] = [];
              for (const item of cleanedList) {
                if (!deduplicatedList.some(existing => areNodesEqual(existing, item))) {
                  deduplicatedList.push(item);
                }
              }

              // Only include the property if it is non-empty
              if (deduplicatedList.length > 0) {
                properties[k] = deduplicatedList;
              }
            }

            // Auto-inject missing bestRating/worstRating/ratingCount if ratingValue exists
            if (isRatingType) {
              const ratingValueKey = "ratingValue" in properties ? "ratingValue" : ("https://schema.org/ratingValue" in properties ? "https://schema.org/ratingValue" : "");
              if (ratingValueKey) {
                const bestKey = ratingValueKey.replace(/[a-zA-Z0-9]+$/, "") + "bestRating";
                const worstKey = ratingValueKey.replace(/[a-zA-Z0-9]+$/, "") + "worstRating";
                const hasBest = bestKey in properties || "https://schema.org/bestRating" in properties || "bestRating" in properties;
                const hasWorst = worstKey in properties || "https://schema.org/worstRating" in properties || "worstRating" in properties;

                // Extract ratingValue number for boundaries check
                const ratingValueNode = properties[ratingValueKey] && properties[ratingValueKey][0];
                let ratingValNum: number | null = null;
                if (ratingValueNode) {
                  if (ratingValueNode.type === "Literal" && typeof ratingValueNode.value === 'number') {
                    ratingValNum = ratingValueNode.value;
                  } else if (ratingValueNode.type === "ValueObject" && typeof ratingValueNode.value === 'number') {
                    ratingValNum = ratingValueNode.value;
                  } else if (ratingValueNode.type === "Literal" && typeof ratingValueNode.value === 'string') {
                    ratingValNum = parseFloat(ratingValueNode.value);
                  } else if (ratingValueNode.type === "ValueObject" && typeof ratingValueNode.value === 'string') {
                    ratingValNum = parseFloat(ratingValueNode.value);
                  }
                }

                if (!hasBest) {
                  const defaultBest = (ratingValNum !== null && ratingValNum > 5) ? ratingValNum : 5;
                  properties[bestKey] = [new LiteralNodeImpl(defaultBest)];
                } else if (ratingValNum !== null) {
                  // If bestRating is present but smaller than ratingValue, adjust it to match ratingValue
                  const actualBestKey = bestKey in properties ? bestKey : ("https://schema.org/bestRating" in properties ? "https://schema.org/bestRating" : "bestRating");
                  const bestNode = properties[actualBestKey] && properties[actualBestKey][0];
                  let bestValNum: number | null = null;
                  if (bestNode) {
                    if (bestNode.type === "Literal" && typeof bestNode.value === 'number') {
                      bestValNum = bestNode.value;
                    } else if (bestNode.type === "ValueObject" && typeof bestNode.value === 'number') {
                      bestValNum = bestNode.value;
                    } else if (bestNode.type === "Literal" && typeof bestNode.value === 'string') {
                      bestValNum = parseFloat(bestNode.value);
                    } else if (bestNode.type === "ValueObject" && typeof bestNode.value === 'string') {
                      bestValNum = parseFloat(bestNode.value);
                    }
                  }
                  if (bestValNum !== null && ratingValNum > bestValNum) {
                    properties[actualBestKey] = [new LiteralNodeImpl(ratingValNum)];
                  }
                }

                if (!hasWorst) {
                  const defaultWorst = (ratingValNum !== null && ratingValNum < 1) ? ratingValNum : 1;
                  properties[worstKey] = [new LiteralNodeImpl(defaultWorst)];
                } else if (ratingValNum !== null) {
                  // If worstRating is present but larger than ratingValue, adjust it to match ratingValue
                  const actualWorstKey = worstKey in properties ? worstKey : ("https://schema.org/worstRating" in properties ? "https://schema.org/worstRating" : "worstRating");
                  const worstNode = properties[actualWorstKey] && properties[actualWorstKey][0];
                  let worstValNum: number | null = null;
                  if (worstNode) {
                    if (worstNode.type === "Literal" && typeof worstNode.value === 'number') {
                      worstValNum = worstNode.value;
                    } else if (worstNode.type === "ValueObject" && typeof worstNode.value === 'number') {
                      worstValNum = worstNode.value;
                    } else if (worstNode.type === "Literal" && typeof worstNode.value === 'string') {
                      worstValNum = parseFloat(worstNode.value);
                    } else if (worstNode.type === "ValueObject" && typeof worstNode.value === 'string') {
                      worstValNum = parseFloat(worstNode.value);
                    }
                  }
                  if (worstValNum !== null && ratingValNum < worstValNum) {
                    properties[actualWorstKey] = [new LiteralNodeImpl(ratingValNum)];
                  }
                }

                if (isAggregateRatingType) {
                  const hasRatingCount = "ratingCount" in properties || "https://schema.org/ratingCount" in properties;
                  const hasReviewCount = "reviewCount" in properties || "https://schema.org/reviewCount" in properties;
                  if (!hasRatingCount && !hasReviewCount) {
                    const ratingCountKey = ratingValueKey.replace(/[a-zA-Z0-9]+$/, "") + "ratingCount";
                    properties[ratingCountKey] = [new LiteralNodeImpl(1)];
                  }
                }
              }
            }

            return new NodeObjectNodeImpl(node.id, updatedTypes, properties);
          }
          return node;
        }
      ]
    };
  }
}
