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
        // If the object has a ratingValue, let's validate its boundaries if worstRating/bestRating are defined.
        if (n.properties["ratingValue"] || n.properties["https://schema.org/ratingValue"]) {
          const ratingKey = "ratingValue" in n.properties ? "ratingValue" : "https://schema.org/ratingValue";
          const ratingValNode = n.properties[ratingKey] && n.properties[ratingKey][0];
          let ratingVal: number | null = null;
          if (ratingValNode) {
            if (ratingValNode.type === "Literal" && typeof ratingValNode.value === 'number') ratingVal = ratingValNode.value;
            else if (ratingValNode.type === "ValueObject" && typeof ratingValNode.value === 'number') ratingVal = ratingValNode.value;
            else if (ratingValNode.type === "Literal" && typeof ratingValNode.value === 'string') ratingVal = parseFloat(ratingValNode.value);
            else if (ratingValNode.type === "ValueObject" && typeof ratingValNode.value === 'string') ratingVal = parseFloat(ratingValNode.value);
          }

          if (ratingVal !== null) {
            const bestKey = "bestRating" in n.properties ? "bestRating" : ("https://schema.org/bestRating" in n.properties ? "https://schema.org/bestRating" : "");
            const bestValNode = bestKey ? n.properties[bestKey] && n.properties[bestKey][0] : null;
            let bestVal: number | null = null;
            if (bestValNode) {
              if (bestValNode.type === "Literal" && typeof bestValNode.value === 'number') bestVal = bestValNode.value;
              else if (bestValNode.type === "ValueObject" && typeof bestValNode.value === 'number') bestVal = bestValNode.value;
              else if (bestValNode.type === "Literal" && typeof bestValNode.value === 'string') bestVal = parseFloat(bestValNode.value);
              else if (bestValNode.type === "ValueObject" && typeof bestValNode.value === 'string') bestVal = parseFloat(bestValNode.value);
            }

            const worstKey = "worstRating" in n.properties ? "worstRating" : ("https://schema.org/worstRating" in n.properties ? "https://schema.org/worstRating" : "");
            const worstValNode = worstKey ? n.properties[worstKey] && n.properties[worstKey][0] : null;
            let worstVal: number | null = null;
            if (worstValNode) {
              if (worstValNode.type === "Literal" && typeof worstValNode.value === 'number') worstVal = worstValNode.value;
              else if (worstValNode.type === "ValueObject" && typeof worstValNode.value === 'number') worstVal = worstValNode.value;
              else if (worstValNode.type === "Literal" && typeof worstValNode.value === 'string') worstVal = parseFloat(worstValNode.value);
              else if (worstValNode.type === "ValueObject" && typeof worstValNode.value === 'string') worstVal = parseFloat(worstValNode.value);
            }

            if (bestVal !== null && ratingVal > bestVal) {
              errors.push(`Rating property 'ratingValue' value '${ratingVal}' is greater than 'bestRating' value '${bestVal}'`);
            }
            if (worstVal !== null && ratingVal < worstVal) {
              errors.push(`Rating property 'ratingValue' value '${ratingVal}' is less than 'worstRating' value '${worstVal}'`);
            }
          }
        }

        n.types.forEach(typeIRI => {
          const typeName = typeIRI.replace("https://schema.org/", "");
          if (typeName && !this.types[typeName]) {
            if (typeIRI.startsWith("https://schema.org/") || !typeIRI.includes(":")) {
              errors.push(`Unknown Schema.org type: '${typeIRI}'`);
            }
          } else if (this.types[typeName]) {
            const validProperties = this.getAllPropertiesForType(typeName);
            for (const [propName, propValues] of Object.entries(n.properties)) {
              if (propName.startsWith("@")) continue;
              const propLocalName = propName.replace("https://schema.org/", "").replace("http://schema.org/", "");

              if (!validProperties.has(propLocalName)) {
                if (propName.startsWith("https://schema.org/") || !propName.includes(":")) {
                  errors.push(`Property '${propName}' is not valid for Schema.org type '${typeIRI}'`);
                }
              }

              // Datetime property timezone validation (e.g. for datePublished, dateModified)
              if (propLocalName.toLowerCase().includes("date")) {
                propValues.forEach(valNode => {
                  let strVal: string | null = null;
                  if (valNode.type === "Literal" && typeof valNode.value === 'string') {
                    strVal = valNode.value;
                  } else if (valNode.type === "ValueObject" && typeof valNode.value === 'string') {
                    strVal = valNode.value;
                  }

                  if (strVal && strVal.includes("T")) {
                    // Check if it includes a timezone designator: ends with Z, or matches standard timezone offset regex
                    const hasTimezone = strVal.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(strVal);
                    if (!hasTimezone) {
                      errors.push(`Datetime property '${propLocalName}' is missing a time zone (optional, but highly recommended by Google)`);
                    }
                  }
                });
              }

              // Telephone number E.164 format validation warning
              if (propLocalName === "telephone") {
                propValues.forEach(valNode => {
                  let strVal: string | null = null;
                  if (valNode.type === "Literal" && typeof valNode.value === 'string') {
                    strVal = valNode.value;
                  } else if (valNode.type === "ValueObject" && typeof valNode.value === 'string') {
                    strVal = valNode.value;
                  }

                  if (strVal) {
                    const hasPlus = strVal.trim().startsWith("+");
                    if (!hasPlus) {
                      errors.push(`Telephone property 'telephone' value '${strVal}' is missing a '+' prefix or is not in recommended E.164 format`);
                    }
                  }
                });
              }

              // ISBN format/length validation warning
              if (propLocalName === "isbn") {
                propValues.forEach(valNode => {
                  let strVal: string | null = null;
                  if (valNode.type === "Literal" && typeof valNode.value === 'string') {
                    strVal = valNode.value;
                  } else if (valNode.type === "ValueObject" && typeof valNode.value === 'string') {
                    strVal = valNode.value;
                  }

                  if (strVal) {
                    const cleanIsbn = strVal.replace(/[-\s]/g, "");
                    const isValidIsbn = (cleanIsbn.length === 10 && /^\d{9}[\dX]$/i.test(cleanIsbn)) || (cleanIsbn.length === 13 && /^\d{13}$/.test(cleanIsbn));
                    if (!isValidIsbn) {
                      errors.push(`ISBN property 'isbn' value '${strVal}' is not a valid ISBN-10 or ISBN-13 number`);
                    }
                  }
                });
              }

              // Email format validation warning
              if (propLocalName === "email") {
                propValues.forEach(valNode => {
                  let strVal: string | null = null;
                  if (valNode.type === "Literal" && typeof valNode.value === 'string') {
                    strVal = valNode.value;
                  } else if (valNode.type === "ValueObject" && typeof valNode.value === 'string') {
                    strVal = valNode.value;
                  }

                  if (strVal && !strVal.includes("@")) {
                    errors.push(`Email property 'email' value '${strVal}' is missing an '@' symbol and is not a valid email address`);
                  }
                });
              }

              // Price range validation warning
              if (propLocalName === "price" || propLocalName === "lowPrice" || propLocalName === "highPrice" || propLocalName === "priceMin" || propLocalName === "priceMax") {
                propValues.forEach(valNode => {
                  let numVal: number | null = null;
                  if (valNode.type === "Literal" && typeof valNode.value === 'number') {
                    numVal = valNode.value;
                  } else if (valNode.type === "ValueObject" && typeof valNode.value === 'number') {
                    numVal = valNode.value;
                  } else if (valNode.type === "Literal" && typeof valNode.value === 'string') {
                    numVal = parseFloat(valNode.value);
                  } else if (valNode.type === "ValueObject" && typeof valNode.value === 'string') {
                    numVal = parseFloat(valNode.value);
                  }

                  if (numVal !== null && numVal < 0) {
                    errors.push(`Price property '${propLocalName}' value '${numVal}' cannot be negative`);
                  }
                });
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
