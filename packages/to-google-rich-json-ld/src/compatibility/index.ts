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
  ContextNode
} from '../types/index.js';

import {
  DocumentNodeImpl,
  ContextNodeImpl,
  NodeObjectNodeImpl,
  ValueObjectNodeImpl,
  GraphObjectNodeImpl,
  SetObjectNodeImpl,
  LiteralNodeImpl
} from '../ast/index.js';

import keywordsMetadata from '../generated/keywords.json' with { type: 'json' };
import schemaMetadata from '../generated/schema.json' with { type: 'json' };

export class CompatibilityEngine {
  private plugins: Plugin[] = [];
  private config: Config;

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

    // Run plug-in transform pipelines
    for (const plugin of this.plugins) {
      if (plugin.transforms) {
        for (const transformFn of plugin.transforms) {
          transformedDoc = this.transformDocumentWithFn(transformedDoc, transformFn);
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
    fn: (node: ASTNode, config: Config) => ASTNode
  ): DocumentNode {
    const transformNode = (node: ASTNode): ASTNode => {
      let updatedNode = fn(node, this.config);

      if (updatedNode.type === "NodeObject") {
        const properties: Record<string, ASTNode[]> = {};
        for (const [k, v] of Object.entries(updatedNode.properties)) {
          properties[k] = v.map(transformNode);
        }
        return new NodeObjectNodeImpl(updatedNode.id, updatedNode.types, properties);
      }

      if (updatedNode.type === "GraphObject") {
        return new GraphObjectNodeImpl(updatedNode.id, updatedNode.graph.map(transformNode));
      }

      if (updatedNode.type === "SetObject") {
        return new SetObjectNodeImpl(updatedNode.set.map(transformNode));
      }

      if (updatedNode.type === "Document") {
        const body = updatedNode.body.map(transformNode);
        const context = updatedNode.context ? transformNode(updatedNode.context) as ContextNode : null;
        return new DocumentNodeImpl(context, body);
      }

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
      if (node.type === "NodeObject") {
        const nodeId = node.id || getNextBlankNodeId();
        const nodeWithId = new NodeObjectNodeImpl(nodeId, node.types, node.properties);

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

        const parentNode = new NodeObjectNodeImpl(nodeId, node.types, cleanProperties);

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
            if (parentNode.types.length === 0) {
              isSemanticallyValid = true; // allow if parent type is unknown
            } else {
              for (const parentTypeIRI of parentNode.types) {
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

                  // Retain name and identifier on parent reference to avoid semantic data loss while removing heavy nesting
                  const parentRefProps: Record<string, ASTNode[]> = {};
                  if (parentNode.properties["name"]) {
                    parentRefProps["name"] = parentNode.properties["name"];
                  }
                  if (parentNode.properties["https://schema.org/name"]) {
                    parentRefProps["https://schema.org/name"] = parentNode.properties["https://schema.org/name"];
                  }
                  if (parentNode.properties["http://schema.org/name"]) {
                    parentRefProps["http://schema.org/name"] = parentNode.properties["http://schema.org/name"];
                  }

                  const parentReference = new NodeObjectNodeImpl(parentNode.id, parentNode.types, parentRefProps);
                  childProperties[propName] = [parentReference];

                  const updatedChild = new NodeObjectNodeImpl(child.id, child.types, childProperties);
                  hoistedNodes.push(walkAndExtract(updatedChild));
                } else {
                  hoistedNodes.push(walkAndExtract(child));
                }
              }
            } else {
              console.warn(`Pruned semantically invalid reverse relationship: parent of type(s) [${parentNode.types.join(", ")}] cannot be assigned to property '${propName}' (expects ranges: [${allowedRanges.join(", ")}])`);
            }
          }
        }

        return parentNode;
      }

      if (node.type === "GraphObject") {
        return new GraphObjectNodeImpl(node.id, node.graph.map(walkAndExtract));
      }

      if (node.type === "SetObject") {
        return new SetObjectNodeImpl(node.set.map(walkAndExtract));
      }

      return node;
    };

    for (const item of doc.body) {
      mainNodes.push(walkAndExtract(item));
    }

    if (hoistedNodes.length > 0) {
      const allNodes = [...mainNodes, ...hoistedNodes];
      return new DocumentNodeImpl(doc.context, [new SetObjectNodeImpl(allNodes)]);
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
            const supersededRecord = schemaMetadata.superseded as Record<string, string>;
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

        // 2. Normalize and Secure Schema.org IRI schemas & Enum URLs: http -> https
        (node: ASTNode, config: Config): ASTNode => {
          if (node.type === "Context" && typeof node.value === 'string') {
            if (node.value.startsWith("http://schema.org")) {
              return new ContextNodeImpl(node.value.replace("http://schema.org", "https://schema.org"));
            }
          }

          if (config.target === "google") {
            // Secure types and IDs in NodeObjects
            if (node.type === "NodeObject") {
              const types = node.types.map(t => t.startsWith("http://schema.org") ? t.replace("http://schema.org", "https://schema.org") : t);
              const id = node.id && node.id.startsWith("http://schema.org") ? node.id.replace("http://schema.org", "https://schema.org") : node.id;
              return new NodeObjectNodeImpl(id, types, node.properties);
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
        }
      ]
    };
  }
}
