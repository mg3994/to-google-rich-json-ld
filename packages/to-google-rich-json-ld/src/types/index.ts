import { Readable } from 'stream';

export type RawDocument = any; // Representing parsed JSON object or array of objects

export interface Config {
  target: "google" | string;
  schemaVersion: string;
  jsonldVersion: "auto" | "1.0" | "1.1" | "1.2" | string;
  preserveUnknownKeywords: boolean;
  removeUnsupportedFeatures: boolean;
  normalizeIRIs: boolean;
  fetchRemoteContexts: boolean;
  cacheContexts: boolean;
  strict: boolean;
}

export type ConvertInput = string | Buffer | object | Readable;

export interface KeywordMetadata {
  keyword: string;
  introducedVersion: string;
  deprecatedVersion: string | null;
  removedVersion: string | null;
  processingAlgorithm: string;
  aliases: string[];
  allowedValues: string[];
  containerSupport: string[];
  requiresExpansion: boolean;
  googleSupport: "supported" | "ignored" | "transformed" | "unsupported" | string;
  schemaSupport: boolean;
}

export interface SchemaMetadata {
  version: string;
  types: Record<string, { parent: string | null; properties: string[] }>;
  properties: Record<string, { domain: string[]; range: string[] }>;
  superseded: Record<string, string>;
}

export interface ContextData {
  known: Record<string, { secure: boolean; type: string }>;
  mappings: Record<string, string>;
}

// AST definitions
export type ASTNode =
  | DocumentNode
  | ContextNode
  | NodeObjectNode
  | ValueObjectNode
  | ListObjectNode
  | SetObjectNode
  | GraphObjectNode
  | IncludedObjectNode
  | ReverseObjectNode
  | LanguageMapNode
  | IndexMapNode
  | IdMapNode
  | TypeMapNode
  | LiteralNode
  | IRINode
  | BlankNode
  | KeywordNode
  | UnknownKeywordNode
  | ExtensionNode;

export interface BaseASTNode {
  type: string;
  accept<T>(visitor: ASTVisitor<T>): T;
}

export interface DocumentNode extends BaseASTNode {
  type: "Document";
  context: ContextNode | null;
  body: ASTNode[];
}

export interface ContextNode extends BaseASTNode {
  type: "Context";
  value: any; // Raw or normalized context mapping/array
}

export interface NodeObjectNode extends BaseASTNode {
  type: "NodeObject";
  id: string | null;
  types: string[];
  properties: Record<string, ASTNode[]>;
}

export interface ValueObjectNode extends BaseASTNode {
  type: "ValueObject";
  value: any;
  language: string | null;
  direction: string | null;
  dataType: string | null;
}

export interface ListObjectNode extends BaseASTNode {
  type: "ListObject";
  list: ASTNode[];
}

export interface SetObjectNode extends BaseASTNode {
  type: "SetObject";
  set: ASTNode[];
}

export interface GraphObjectNode extends BaseASTNode {
  type: "GraphObject";
  id: string | null;
  graph: ASTNode[];
}

export interface IncludedObjectNode extends BaseASTNode {
  type: "IncludedObject";
  included: ASTNode[];
}

export interface ReverseObjectNode extends BaseASTNode {
  type: "ReverseObject";
  properties: Record<string, ASTNode[]>;
}

export interface LanguageMapNode extends BaseASTNode {
  type: "LanguageMap";
  map: Record<string, string[]>;
}

export interface IndexMapNode extends BaseASTNode {
  type: "IndexMap";
  map: Record<string, ASTNode>;
}

export interface IdMapNode extends BaseASTNode {
  type: "IdMap";
  map: Record<string, ASTNode>;
}

export interface TypeMapNode extends BaseASTNode {
  type: "TypeMap";
  map: Record<string, ASTNode>;
}

export interface LiteralNode extends BaseASTNode {
  type: "Literal";
  value: string | number | boolean | null;
}

export interface IRINode extends BaseASTNode {
  type: "IRI";
  value: string;
}

export interface BlankNode extends BaseASTNode {
  type: "BlankNode";
  value: string;
}

export interface KeywordNode extends BaseASTNode {
  type: "Keyword";
  value: string;
}

export interface UnknownKeywordNode extends BaseASTNode {
  type: "UnknownKeyword";
  value: string;
  associatedValue: any;
}

export interface ExtensionNode extends BaseASTNode {
  type: "Extension";
  name: string;
  value: any;
}

export interface ASTVisitor<T> {
  visitDocument(node: DocumentNode): T;
  visitContext(node: ContextNode): T;
  visitNodeObject(node: NodeObjectNode): T;
  visitValueObject(node: ValueObjectNode): T;
  visitListObject(node: ListObjectNode): T;
  visitSetObject(node: SetObjectNode): T;
  visitGraphObject(node: GraphObjectNode): T;
  visitIncludedObject(node: IncludedObjectNode): T;
  visitReverseObject(node: ReverseObjectNode): T;
  visitLanguageMap(node: LanguageMapNode): T;
  visitIndexMap(node: IndexMapNode): T;
  visitIdMap(node: IdMapNode): T;
  visitTypeMap(node: TypeMapNode): T;
  visitLiteral(node: LiteralNode): T;
  visitIRI(node: IRINode): T;
  visitBlankNode(node: BlankNode): T;
  visitKeyword(node: KeywordNode): T;
  visitUnknownKeyword(node: UnknownKeywordNode): T;
  visitExtension(node: ExtensionNode): T;
}

// Plugin Architecture
export interface Plugin {
  name: string;
  transforms?: Array<(node: ASTNode, config: Config) => ASTNode>;
  overrideCompatibility?: (keyword: string, currentStatus: string) => string | undefined;
  validate?: (node: ASTNode) => string[];
}

// Public API signatures
export interface SemanticEngine {
  convert(document: ConvertInput, options?: Partial<Config>): Promise<RawDocument>;
  detectVersion(document: ConvertInput): Promise<string>;
  normalize(document: ConvertInput, options?: Partial<Config>): Promise<RawDocument>;
  validate(document: ConvertInput): Promise<{ valid: boolean; errors: string[] }>;
  expand(document: ConvertInput, options?: Partial<Config>): Promise<RawDocument>;
  compact(document: ConvertInput, context: any, options?: Partial<Config>): Promise<RawDocument>;
  flatten(document: ConvertInput, options?: Partial<Config>): Promise<RawDocument>;
  frame(document: ConvertInput, frameSpec: any, options?: Partial<Config>): Promise<RawDocument>;
  analyze(document: ConvertInput): Promise<{
    version: string;
    keywordsUsed: string[];
    unknownKeywords: string[];
    schemaTypes: string[];
    contextUrls: string[];
  }>;
}
