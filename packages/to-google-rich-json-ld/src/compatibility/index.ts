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

    const walkAndExtract = (node: ASTNode): ASTNode => {
      if (node.type === "NodeObject") {
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
            // Recursively clean and process properties
            cleanProperties[k] = v.map(walkAndExtract);
          }
        }

        const parentNode = new NodeObjectNodeImpl(node.id, node.types, cleanProperties);

        // Extract and process @included
        if (hasIncluded && includedNode) {
          includedNode.included.forEach(child => {
            hoistedNodes.push(walkAndExtract(child));
          });
        }

        // Extract and process @reverse (translate reverse to forward relationship on the nested child)
        if (hasReverse && reverseNode) {
          for (const [propName, childNodes] of Object.entries(reverseNode.properties)) {
            for (const child of childNodes) {
              if (child.type === "NodeObject") {
                // Build a child node where the forward property points to our parent node
                const childProperties = { ...child.properties };
                childProperties[propName] = [parentNode];
                const updatedChild = new NodeObjectNodeImpl(child.id, child.types, childProperties);
                hoistedNodes.push(walkAndExtract(updatedChild));
              } else {
                hoistedNodes.push(walkAndExtract(child));
              }
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

    // Walk all top-level document body nodes
    for (const item of doc.body) {
      mainNodes.push(walkAndExtract(item));
    }

    if (hoistedNodes.length > 0) {
      // If we have hoisted nodes, group all main and hoisted nodes cleanly into a root-level Set
      // which serializes to a clean, non-corrupted flat JSON-LD array that Google structured data prefers!
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

        // 2. Normalize and Secure Schema.org IRI schemas: http -> https
        (node: ASTNode, config: Config): ASTNode => {
          if (node.type === "Context" && typeof node.value === 'string') {
            if (node.value.startsWith("http://schema.org")) {
              return new ContextNodeImpl(node.value.replace("http://schema.org", "https://schema.org"));
            }
          }
          return node;
        },

        // 3. Strip unknown/experimental keywords & nested features ignored by Google
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
