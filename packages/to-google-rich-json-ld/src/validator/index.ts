import { ASTNode } from '../types/index.js';
import schemaMetadata from '../generated/schema.json' with { type: 'json' };

export class SchemaValidator {
  private types: Record<string, { parent: string | null; properties: string[] }>;
  private properties: Record<string, { domain: string[]; range: string[] }>;

  constructor() {
    this.types = schemaMetadata.types as Record<string, { parent: string | null; properties: string[] }>;
    this.properties = schemaMetadata.properties as Record<string, { domain: string[]; range: string[] }>;
  }

  /**
   * Helper to collect all valid properties for a given Schema.org type (including parent classes).
   */
  private getAllPropertiesForType(typeName: string): Set<string> {
    const validProps = new Set<string>();
    let current: string | null = typeName;
    const visited = new Set<string>();

    while (current && !visited.has(current)) {
      visited.add(current);
      const typeDef: { parent: string | null; properties: string[] } | undefined = this.types[current];
      if (typeDef) {
        if (typeDef.properties) {
          typeDef.properties.forEach((p: string) => validProps.add(p));
        }
        current = typeDef.parent;
      } else {
        break;
      }
    }

    return validProps;
  }

  /**
   * Performs structured schema and keyword validation on the AST.
   */
  public validate(node: ASTNode): string[] {
    const errors: string[] = [];

    const traverse = (n: ASTNode) => {
      if (n.type === "NodeObject") {
        n.types.forEach(typeIRI => {
          const typeName = typeIRI.replace("https://schema.org/", "");
          if (typeName && !this.types[typeName]) {
            if (typeIRI.startsWith("https://schema.org/") || !typeIRI.includes(":")) {
              errors.push(`Unknown Schema.org type: '${typeIRI}'`);
            }
          } else if (this.types[typeName]) {
            const validProperties = this.getAllPropertiesForType(typeName);
            for (const propName of Object.keys(n.properties)) {
              if (propName.startsWith("@")) continue;
              const propLocalName = propName.replace("https://schema.org/", "");

              if (!validProperties.has(propLocalName)) {
                if (propName.startsWith("https://schema.org/") || !propName.includes(":")) {
                  errors.push(`Property '${propName}' is not valid for Schema.org type '${typeIRI}'`);
                }
              }
            }
          }
        });

        for (const val of Object.values(n.properties)) {
          val.forEach(traverse);
        }
      } else if (n.type === "Document") {
        n.body.forEach(traverse);
      } else if (n.type === "GraphObject") {
        n.graph.forEach(traverse);
      } else if (n.type === "SetObject") {
        n.set.forEach(traverse);
      } else if (n.type === "ListObject") {
        n.list.forEach(traverse);
      }
    };

    traverse(node);
    return errors;
  }
}
