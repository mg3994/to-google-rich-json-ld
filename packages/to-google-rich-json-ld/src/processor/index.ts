import {
  ASTNode,
  DocumentNode,
  NodeObjectNode,
  ValueObjectNode,
  ListObjectNode,
  SetObjectNode,
  GraphObjectNode,
  IncludedObjectNode,
  ReverseObjectNode,
  Config
} from '../types/index.js';

import {
  DocumentNodeImpl,
  ContextNodeImpl,
  NodeObjectNodeImpl,
  ValueObjectNodeImpl,
  ListObjectNodeImpl,
  SetObjectNodeImpl,
  GraphObjectNodeImpl,
  IncludedObjectNodeImpl,
  ReverseObjectNodeImpl,
  LiteralNodeImpl
} from '../ast/index.js';

import { ContextLoader } from '../loaders/context-loader.js';

export class SemanticProcessor {
  private contextLoader: ContextLoader;

  constructor(config: Config) {
    this.contextLoader = new ContextLoader(config);
  }

  /**
   * Core Expansion Algorithm
   */
  public async expand(doc: DocumentNode, customCtx?: any): Promise<DocumentNode> {
    const rawContext = customCtx || (doc.context ? doc.context.value : null);
    const resolvedContext = await this.contextLoader.load(rawContext);
    const vocab = resolvedContext['@vocab'] || '';

    const expandIRI = (term: string): string => {
      if (term.startsWith('@')) return term;

      let resolved = term;
      if (resolvedContext[term]) {
        const val = resolvedContext[term];
        if (typeof val === 'string') {
          resolved = val;
        } else if (typeof val === 'object' && val !== null && val['@id']) {
          resolved = val['@id'];
        }
      }

      // Handle prefix expansion (e.g. schema:name or schema:Person)
      if (resolved.includes(':') && !resolved.startsWith('http://') && !resolved.startsWith('https://')) {
        const colonIndex = resolved.indexOf(':');
        const prefix = resolved.substring(0, colonIndex);
        const suffix = resolved.substring(colonIndex + 1);
        if (resolvedContext[prefix]) {
          const prefixVal = resolvedContext[prefix];
          const expandedPrefix = typeof prefixVal === 'string' ? prefixVal : (prefixVal['@id'] || '');
          return expandedPrefix + suffix;
        }
      }

      if (resolved !== term) {
        return resolved;
      }

      if (vocab) {
        return vocab + term;
      }
      return term;
    };

    const expandNode = (node: ASTNode): ASTNode => {
      if (node.type === "NodeObject") {
        const id = node.id ? expandIRI(node.id) : null;
        const types = node.types.map(t => expandIRI(t));
        const properties: Record<string, ASTNode[]> = {};

        for (const [k, v] of Object.entries(node.properties)) {
          const expandedKey = expandIRI(k);
          properties[expandedKey] = v.map(item => expandNode(item));
        }

        return new NodeObjectNodeImpl(id, types, properties);
      }

      if (node.type === "ValueObject") {
        const dataType = node.dataType ? expandIRI(node.dataType) : null;
        return new ValueObjectNodeImpl(node.value, node.language, node.direction, dataType);
      }

      if (node.type === "ListObject") {
        return new ListObjectNodeImpl(node.list.map(item => expandNode(item)));
      }

      if (node.type === "SetObject") {
        return new SetObjectNodeImpl(node.set.map(item => expandNode(item)));
      }

      if (node.type === "GraphObject") {
        const id = node.id ? expandIRI(node.id) : null;
        return new GraphObjectNodeImpl(id, node.graph.map(item => expandNode(item)));
      }

      if (node.type === "IncludedObject") {
        return new IncludedObjectNodeImpl(node.included.map(item => expandNode(item)));
      }

      if (node.type === "ReverseObject") {
        const properties: Record<string, ASTNode[]> = {};
        for (const [k, v] of Object.entries(node.properties)) {
          const expandedKey = expandIRI(k);
          properties[expandedKey] = v.map(item => expandNode(item));
        }
        return new ReverseObjectNodeImpl(properties);
      }

      return node;
    };

    const expandedBody = doc.body.map(item => expandNode(item));
    return new DocumentNodeImpl(null, expandedBody);
  }

  /**
   * Core Compaction Algorithm
   */
  public async compact(doc: DocumentNode, targetCtx: any): Promise<DocumentNode> {
    const resolvedContext = await this.contextLoader.load(targetCtx);
    const vocab = resolvedContext['@vocab'] || '';

    const reverseMappings: Record<string, string> = {};
    for (const [k, v] of Object.entries(resolvedContext)) {
      if (k.startsWith('@')) continue;
      if (typeof v === 'string') {
        reverseMappings[v] = k;
      } else if (typeof v === 'object' && v !== null && v['@id']) {
        reverseMappings[v['@id']] = k;
      }
    }

    const compactIRI = (iri: string): string => {
      if (iri.startsWith('@')) return iri;
      if (reverseMappings[iri]) {
        return reverseMappings[iri];
      }
      if (vocab && iri.startsWith(vocab)) {
        return iri.slice(vocab.length);
      }
      return iri;
    };

    const compactNode = (node: ASTNode): ASTNode => {
      if (node.type === "NodeObject") {
        const id = node.id ? compactIRI(node.id) : null;
        const types = node.types.map(t => compactIRI(t));
        const properties: Record<string, ASTNode[]> = {};

        for (const [k, v] of Object.entries(node.properties)) {
          const compactedKey = compactIRI(k);
          properties[compactedKey] = v.map(item => compactNode(item));
        }

        return new NodeObjectNodeImpl(id, types, properties);
      }

      if (node.type === "ValueObject") {
        const dataType = node.dataType ? compactIRI(node.dataType) : null;
        if (!node.language && !node.direction && !dataType) {
          return new LiteralNodeImpl(node.value);
        }
        return new ValueObjectNodeImpl(node.value, node.language, node.direction, dataType);
      }

      if (node.type === "ListObject") {
        return new ListObjectNodeImpl(node.list.map(item => compactNode(item)));
      }

      if (node.type === "SetObject") {
        return new SetObjectNodeImpl(node.set.map(item => compactNode(item)));
      }

      if (node.type === "GraphObject") {
        const id = node.id ? compactIRI(node.id) : null;
        return new GraphObjectNodeImpl(id, node.graph.map(item => compactNode(item)));
      }

      if (node.type === "IncludedObject") {
        return new IncludedObjectNodeImpl(node.included.map(item => compactNode(item)));
      }

      if (node.type === "ReverseObject") {
        const properties: Record<string, ASTNode[]> = {};
        for (const [k, v] of Object.entries(node.properties)) {
          const compactedKey = compactIRI(k);
          properties[compactedKey] = v.map(item => compactNode(item));
        }
        return new ReverseObjectNodeImpl(properties);
      }

      return node;
    };

    const compactedBody = doc.body.map(item => compactNode(item));
    const contextNode = new ContextNodeImpl(targetCtx);
    return new DocumentNodeImpl(contextNode, compactedBody);
  }

  /**
   * Core Flattening Algorithm
   */
  public flatten(doc: DocumentNode): DocumentNode {
    const flatNodes: Record<string, NodeObjectNode> = {};
    let blankNodeCounter = 0;

    const getNextBlankNodeId = (): string => `_:b${blankNodeCounter++}`;

    const traverseAndFlatten = (node: ASTNode): ASTNode => {
      if (node.type === "NodeObject") {
        const id = node.id || getNextBlankNodeId();
        const types = [...node.types];
        const properties: Record<string, ASTNode[]> = {};

        for (const [k, v] of Object.entries(node.properties)) {
          properties[k] = v.map(item => {
            if (item.type === "NodeObject") {
              const childId = item.id || getNextBlankNodeId();
              const flattenedChild = traverseAndFlatten(item) as NodeObjectNode;
              flatNodes[childId] = flattenedChild;
              return new NodeObjectNodeImpl(childId, [], {});
            }
            return traverseAndFlatten(item);
          });
        }

        const flatNode = new NodeObjectNodeImpl(id, types, properties);
        flatNodes[id] = flatNode;
        return flatNode;
      }

      if (node.type === "ListObject") {
        return new ListObjectNodeImpl(node.list.map(traverseAndFlatten));
      }

      if (node.type === "SetObject") {
        return new SetObjectNodeImpl(node.set.map(traverseAndFlatten));
      }

      if (node.type === "GraphObject") {
        return new GraphObjectNodeImpl(node.id, node.graph.map(traverseAndFlatten));
      }

      if (node.type === "IncludedObject") {
        return new IncludedObjectNodeImpl(node.included.map(traverseAndFlatten));
      }

      return node;
    };

    doc.body.forEach(traverseAndFlatten);

    const graphArray = Object.values(flatNodes);
    const rootGraph = new GraphObjectNodeImpl(null, graphArray);
    return new DocumentNodeImpl(doc.context, [rootGraph]);
  }

  /**
   * Core Framing Algorithm
   */
  public frame(doc: DocumentNode, frameSpec: any): DocumentNode {
    const targetType = frameSpec?.['@type'] || '';
    const matchingNodes: ASTNode[] = [];

    const traverse = (node: ASTNode) => {
      if (node.type === "NodeObject") {
        if (!targetType || node.types.includes(targetType)) {
          matchingNodes.push(node);
        }
        for (const v of Object.values(node.properties)) {
          v.forEach(traverse);
        }
      } else if (node.type === "GraphObject") {
        node.graph.forEach(traverse);
      } else if (node.type === "SetObject") {
        node.set.forEach(traverse);
      }
    };

    doc.body.forEach(traverse);

    return new DocumentNodeImpl(doc.context, matchingNodes);
  }
}
