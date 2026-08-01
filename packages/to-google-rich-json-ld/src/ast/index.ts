import {
  ASTNode,
  ASTVisitor,
  DocumentNode,
  ContextNode,
  NodeObjectNode,
  ValueObjectNode,
  ListObjectNode,
  SetObjectNode,
  GraphObjectNode,
  IncludedObjectNode,
  ReverseObjectNode,
  LanguageMapNode,
  IndexMapNode,
  IdMapNode,
  TypeMapNode,
  LiteralNode,
  IRINode,
  BlankNode,
  KeywordNode,
  UnknownKeywordNode,
  ExtensionNode,
  RawDocument
} from '../types/index.js';

import keywordsJson from '../generated/keywords.json' with { type: 'json' };

const KNOWN_KEYWORDS = new Set(keywordsJson.map(k => k.keyword));

// Concrete AST node implementations
export class DocumentNodeImpl implements DocumentNode {
  type: "Document" = "Document";
  constructor(public context: ContextNode | null, public body: ASTNode[]) {}
  accept<T>(visitor: ASTVisitor<T>): T { return visitor.visitDocument(this); }
}

export class ContextNodeImpl implements ContextNode {
  type: "Context" = "Context";
  constructor(public value: any) {}
  accept<T>(visitor: ASTVisitor<T>): T { return visitor.visitContext(this); }
}

export class NodeObjectNodeImpl implements NodeObjectNode {
  type: "NodeObject" = "NodeObject";
  constructor(
    public id: string | null,
    public types: string[],
    public properties: Record<string, ASTNode[]>
  ) {}
  accept<T>(visitor: ASTVisitor<T>): T { return visitor.visitNodeObject(this); }
}

export class ValueObjectNodeImpl implements ValueObjectNode {
  type: "ValueObject" = "ValueObject";
  constructor(
    public value: any,
    public language: string | null = null,
    public direction: string | null = null,
    public dataType: string | null = null
  ) {}
  accept<T>(visitor: ASTVisitor<T>): T { return visitor.visitValueObject(this); }
}

export class ListObjectNodeImpl implements ListObjectNode {
  type: "ListObject" = "ListObject";
  constructor(public list: ASTNode[]) {}
  accept<T>(visitor: ASTVisitor<T>): T { return visitor.visitListObject(this); }
}

export class SetObjectNodeImpl implements SetObjectNode {
  type: "SetObject" = "SetObject";
  constructor(public set: ASTNode[]) {}
  accept<T>(visitor: ASTVisitor<T>): T { return visitor.visitSetObject(this); }
}

export class GraphObjectNodeImpl implements GraphObjectNode {
  type: "GraphObject" = "GraphObject";
  constructor(public id: string | null, public graph: ASTNode[]) {}
  accept<T>(visitor: ASTVisitor<T>): T { return visitor.visitGraphObject(this); }
}

export class IncludedObjectNodeImpl implements IncludedObjectNode {
  type: "IncludedObject" = "IncludedObject";
  constructor(public included: ASTNode[]) {}
  accept<T>(visitor: ASTVisitor<T>): T { return visitor.visitIncludedObject(this); }
}

export class ReverseObjectNodeImpl implements ReverseObjectNode {
  type: "ReverseObject" = "ReverseObject";
  constructor(public properties: Record<string, ASTNode[]>) {}
  accept<T>(visitor: ASTVisitor<T>): T { return visitor.visitReverseObject(this); }
}

export class LanguageMapNodeImpl implements LanguageMapNode {
  type: "LanguageMap" = "LanguageMap";
  constructor(public map: Record<string, string[]>) {}
  accept<T>(visitor: ASTVisitor<T>): T { return visitor.visitLanguageMap(this); }
}

export class IndexMapNodeImpl implements IndexMapNode {
  type: "IndexMap" = "IndexMap";
  constructor(public map: Record<string, ASTNode>) {}
  accept<T>(visitor: ASTVisitor<T>): T { return visitor.visitIndexMap(this); }
}

export class IdMapNodeImpl implements IdMapNode {
  type: "IdMap" = "IdMap";
  constructor(public map: Record<string, ASTNode>) {}
  accept<T>(visitor: ASTVisitor<T>): T { return visitor.visitIdMap(this); }
}

export class TypeMapNodeImpl implements TypeMapNode {
  type: "TypeMap" = "TypeMap";
  constructor(public map: Record<string, ASTNode>) {}
  accept<T>(visitor: ASTVisitor<T>): T { return visitor.visitTypeMap(this); }
}

export class LiteralNodeImpl implements LiteralNode {
  type: "Literal" = "Literal";
  constructor(public value: string | number | boolean | null) {}
  accept<T>(visitor: ASTVisitor<T>): T { return visitor.visitLiteral(this); }
}

export class IRINodeImpl implements IRINode {
  type: "IRI" = "IRI";
  constructor(public value: string) {}
  accept<T>(visitor: ASTVisitor<T>): T { return visitor.visitIRI(this); }
}

export class BlankNodeImpl implements BlankNode {
  type: "BlankNode" = "BlankNode";
  constructor(public value: string) {}
  accept<T>(visitor: ASTVisitor<T>): T { return visitor.visitBlankNode(this); }
}

export class KeywordNodeImpl implements KeywordNode {
  type: "Keyword" = "Keyword";
  constructor(public value: string) {}
  accept<T>(visitor: ASTVisitor<T>): T { return visitor.visitKeyword(this); }
}

export class UnknownKeywordNodeImpl implements UnknownKeywordNode {
  type: "UnknownKeyword" = "UnknownKeyword";
  constructor(public value: string, public associatedValue: any) {}
  accept<T>(visitor: ASTVisitor<T>): T { return visitor.visitUnknownKeyword(this); }
}

export class ExtensionNodeImpl implements ExtensionNode {
  type: "Extension" = "Extension";
  constructor(public name: string, public value: any) {}
  accept<T>(visitor: ASTVisitor<T>): T { return visitor.visitExtension(this); }
}

export class ASTBuilder {
  /**
   * Build an AST DocumentNode from a RawDocument.
   */
  public build(doc: RawDocument): DocumentNode {
    if (!doc) {
      return new DocumentNodeImpl(null, []);
    }

    let contextNode: ContextNode | null = null;
    const body: ASTNode[] = [];

    // Extract root-level context if present in object
    if (typeof doc === 'object' && doc !== null && !Array.isArray(doc)) {
      if ('@context' in doc) {
        contextNode = new ContextNodeImpl(doc['@context']);
      }
      body.push(this.parseNode(doc));
    } else if (Array.isArray(doc)) {
      for (const item of doc) {
        body.push(this.parseNode(item));
      }
    } else {
      body.push(this.parseNode(doc));
    }

    return new DocumentNodeImpl(contextNode, body);
  }

  private parseNode(val: any): ASTNode {
    if (val === null || typeof val !== 'object') {
      return new LiteralNodeImpl(val);
    }

    if (Array.isArray(val)) {
      // Unordered set/array mapping
      return new SetObjectNodeImpl(val.map(item => this.parseNode(item)));
    }

    // Check if it's a Value Object (has @value)
    if ('@value' in val) {
      return new ValueObjectNodeImpl(
        val['@value'],
        val['@language'] || null,
        val['@direction'] || null,
        val['@type'] || null
      );
    }

    // Check if it's a List Object (has @list)
    if ('@list' in val) {
      const items = Array.isArray(val['@list']) ? val['@list'] : [val['@list']];
      return new ListObjectNodeImpl(items.map(item => this.parseNode(item)));
    }

    // Check if it's a Graph Object (has @graph)
    if ('@graph' in val) {
      const items = Array.isArray(val['@graph']) ? val['@graph'] : [val['@graph']];
      return new GraphObjectNodeImpl(
        val['@id'] || null,
        items.map(item => this.parseNode(item))
      );
    }

    // Build NodeObject
    const id = typeof val['@id'] === 'string' ? val['@id'] : null;

    let types: string[] = [];
    if ('@type' in val) {
      if (Array.isArray(val['@type'])) {
        types = val['@type'].map((t: any) => String(t));
      } else if (typeof val['@type'] === 'string') {
        types = [val['@type']];
      }
    }

    const properties: Record<string, ASTNode[]> = {};

    for (const [k, v] of Object.entries(val)) {
      if (k === '@context' || k === '@id' || k === '@type') {
        continue;
      }

      // Check if keyword is unknown
      if (k.startsWith('@')) {
        if (!KNOWN_KEYWORDS.has(k)) {
          properties[k] = [new UnknownKeywordNodeImpl(k, v)];
          continue;
        }

        // Support @reverse keyword as a child property
        if (k === '@reverse' && v && typeof v === 'object') {
          const revProperties: Record<string, ASTNode[]> = {};
          for (const [revK, revV] of Object.entries(v)) {
            const arr = Array.isArray(revV) ? revV : [revV];
            revProperties[revK] = arr.map(item => this.parseNode(item));
          }
          properties[k] = [new ReverseObjectNodeImpl(revProperties)];
          continue;
        }

        // Support @included keyword as a child property
        if (k === '@included') {
          const items = Array.isArray(v) ? v : [v];
          properties[k] = [new IncludedObjectNodeImpl(items.map(item => this.parseNode(item)))];
          continue;
        }
      }

      const arr = Array.isArray(v) ? v : [v];
      properties[k] = arr.map(item => this.parseNode(item));
    }

    return new NodeObjectNodeImpl(id, types, properties);
  }
}
