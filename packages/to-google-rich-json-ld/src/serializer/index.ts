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
  ExtensionNode
} from '../types/index.js';

export class ASTSerializer implements ASTVisitor<any> {
  public serialize(node: ASTNode): any {
    return node.accept(this);
  }

  visitDocument(node: DocumentNode): any {
    const result: Record<string, any> = {};
    if (node.context) {
      result["@context"] = this.serialize(node.context);
    }

    if (node.body.length === 1) {
      const bodySerialized = this.serialize(node.body[0]);
      if (typeof bodySerialized === 'object' && bodySerialized !== null && !Array.isArray(bodySerialized)) {
        return { ...result, ...bodySerialized };
      }
      if (Array.isArray(bodySerialized)) {
        // If it's a plain array (e.g. from SetObject), return the array directly or merge context
        if (node.context) {
          // Standard JSON-LD array can't have root keys easily unless we wrap each or map.
          // Usually, if we have context and an array body, we can return the array where the first item contains context,
          // or return the array itself. Returning the array itself is standard.
          return bodySerialized.map((item, idx) => {
            if (idx === 0 && typeof item === 'object' && item !== null) {
              return { "@context": result["@context"], ...item };
            }
            return item;
          });
        }
        return bodySerialized;
      }
      return bodySerialized;
    }

    const bodies = node.body.map(item => this.serialize(item));
    return bodies;
  }

  visitContext(node: ContextNode): any {
    return node.value;
  }

  visitNodeObject(node: NodeObjectNode): any {
    const result: Record<string, any> = {};
    if (node.id) {
      result["@id"] = node.id;
    }
    if (node.types && node.types.length > 0) {
      result["@type"] = node.types.length === 1 ? node.types[0] : node.types;
    }
    for (const [k, v] of Object.entries(node.properties)) {
      if (v.length === 1) {
        result[k] = this.serialize(v[0]);
      } else {
        result[k] = v.map(item => this.serialize(item));
      }
    }
    return result;
  }

  visitValueObject(node: ValueObjectNode): any {
    const result: Record<string, any> = {
      "@value": node.value
    };
    if (node.language) {
      result["@language"] = node.language;
    }
    if (node.direction) {
      result["@direction"] = node.direction;
    }
    if (node.dataType) {
      result["@type"] = node.dataType;
    }
    return result;
  }

  visitListObject(node: ListObjectNode): any {
    return {
      "@list": node.list.map(item => this.serialize(item))
    };
  }

  visitSetObject(node: SetObjectNode): any {
    // Return a raw array for cleaner structured representation, especially for Google Rich Results compatibility
    return node.set.map(item => this.serialize(item));
  }

  visitGraphObject(node: GraphObjectNode): any {
    const result: Record<string, any> = {
      "@graph": node.graph.map(item => this.serialize(item))
    };
    if (node.id) {
      result["@id"] = node.id;
    }
    return result;
  }

  visitIncludedObject(node: IncludedObjectNode): any {
    return {
      "@included": node.included.map(item => this.serialize(item))
    };
  }

  visitReverseObject(node: ReverseObjectNode): any {
    const propertiesSerialized: Record<string, any> = {};
    for (const [k, v] of Object.entries(node.properties)) {
      if (v.length === 1) {
        propertiesSerialized[k] = this.serialize(v[0]);
      } else {
        propertiesSerialized[k] = v.map(item => this.serialize(item));
      }
    }
    return {
      "@reverse": propertiesSerialized
    };
  }

  visitLanguageMap(node: LanguageMapNode): any {
    return node.map;
  }

  visitIndexMap(node: IndexMapNode): any {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(node.map)) {
      result[k] = this.serialize(v);
    }
    return result;
  }

  visitIdMap(node: IdMapNode): any {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(node.map)) {
      result[k] = this.serialize(v);
    }
    return result;
  }

  visitTypeMap(node: TypeMapNode): any {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(node.map)) {
      result[k] = this.serialize(v);
    }
    return result;
  }

  visitLiteral(node: LiteralNode): any {
    return node.value;
  }

  visitIRI(node: IRINode): any {
    return node.value;
  }

  visitBlankNode(node: BlankNode): any {
    return node.value;
  }

  visitKeyword(node: KeywordNode): any {
    return node.value;
  }

  visitUnknownKeyword(node: UnknownKeywordNode): any {
    return node.associatedValue;
  }

  visitExtension(node: ExtensionNode): any {
    return node.value;
  }
}
