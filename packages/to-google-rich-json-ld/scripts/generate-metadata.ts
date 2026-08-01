import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.join(__dirname, '../src/generated');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 1. keywords.json definition
const keywords = [
  // 1.0 Core
  {
    keyword: "@context",
    introducedVersion: "1.0",
    deprecatedVersion: null,
    removedVersion: null,
    processingAlgorithm: "Context Processing",
    aliases: [],
    allowedValues: ["string", "object", "array"],
    containerSupport: [],
    requiresExpansion: true,
    googleSupport: "supported",
    schemaSupport: true
  },
  {
    keyword: "@id",
    introducedVersion: "1.0",
    deprecatedVersion: null,
    removedVersion: null,
    processingAlgorithm: "IRI Expansion",
    aliases: [],
    allowedValues: ["string"],
    containerSupport: [],
    requiresExpansion: true,
    googleSupport: "supported",
    schemaSupport: true
  },
  {
    keyword: "@type",
    introducedVersion: "1.0",
    deprecatedVersion: null,
    removedVersion: null,
    processingAlgorithm: "Value Expansion",
    aliases: [],
    allowedValues: ["string", "array"],
    containerSupport: ["@set", "@sort"],
    requiresExpansion: true,
    googleSupport: "supported",
    schemaSupport: true
  },
  {
    keyword: "@value",
    introducedVersion: "1.0",
    deprecatedVersion: null,
    removedVersion: null,
    processingAlgorithm: "Value Expansion",
    aliases: [],
    allowedValues: ["string", "number", "boolean", "null"],
    containerSupport: [],
    requiresExpansion: true,
    googleSupport: "supported",
    schemaSupport: true
  },
  {
    keyword: "@language",
    introducedVersion: "1.0",
    deprecatedVersion: null,
    removedVersion: null,
    processingAlgorithm: "Value Expansion",
    aliases: [],
    allowedValues: ["string"],
    containerSupport: [],
    requiresExpansion: true,
    googleSupport: "supported",
    schemaSupport: true
  },
  {
    keyword: "@graph",
    introducedVersion: "1.0",
    deprecatedVersion: null,
    removedVersion: null,
    processingAlgorithm: "Flattening / Expansion",
    aliases: [],
    allowedValues: ["object", "array"],
    containerSupport: [],
    requiresExpansion: true,
    googleSupport: "supported",
    schemaSupport: true
  },
  {
    keyword: "@list",
    introducedVersion: "1.0",
    deprecatedVersion: null,
    removedVersion: null,
    processingAlgorithm: "List Processing",
    aliases: [],
    allowedValues: ["array"],
    containerSupport: [],
    requiresExpansion: true,
    googleSupport: "supported",
    schemaSupport: true
  },
  {
    keyword: "@set",
    introducedVersion: "1.0",
    deprecatedVersion: null,
    removedVersion: null,
    processingAlgorithm: "Set Processing",
    aliases: [],
    allowedValues: ["array"],
    containerSupport: [],
    requiresExpansion: true,
    googleSupport: "supported",
    schemaSupport: true
  },
  {
    keyword: "@reverse",
    introducedVersion: "1.0",
    deprecatedVersion: null,
    removedVersion: null,
    processingAlgorithm: "Reverse Property Processing",
    aliases: [],
    allowedValues: ["object"],
    containerSupport: [],
    requiresExpansion: true,
    googleSupport: "transformed",
    schemaSupport: true
  },
  {
    keyword: "@index",
    introducedVersion: "1.0",
    deprecatedVersion: null,
    removedVersion: null,
    processingAlgorithm: "Value Expansion",
    aliases: [],
    allowedValues: ["string"],
    containerSupport: [],
    requiresExpansion: true,
    googleSupport: "ignored",
    schemaSupport: true
  },
  {
    keyword: "@base",
    introducedVersion: "1.0",
    deprecatedVersion: null,
    removedVersion: null,
    processingAlgorithm: "IRI Expansion",
    aliases: [],
    allowedValues: ["string", "null"],
    containerSupport: [],
    requiresExpansion: true,
    googleSupport: "ignored",
    schemaSupport: true
  },
  {
    keyword: "@vocab",
    introducedVersion: "1.0",
    deprecatedVersion: null,
    removedVersion: null,
    processingAlgorithm: "IRI Expansion",
    aliases: [],
    allowedValues: ["string", "null"],
    containerSupport: [],
    requiresExpansion: true,
    googleSupport: "ignored",
    schemaSupport: true
  },
  {
    keyword: "@container",
    introducedVersion: "1.0",
    deprecatedVersion: null,
    removedVersion: null,
    processingAlgorithm: "Context Processing",
    aliases: [],
    allowedValues: ["string", "array"],
    containerSupport: [],
    requiresExpansion: false,
    googleSupport: "ignored",
    schemaSupport: true
  },
  // 1.1 Additions
  {
    keyword: "@version",
    introducedVersion: "1.1",
    deprecatedVersion: null,
    removedVersion: null,
    processingAlgorithm: "Context Processing",
    aliases: [],
    allowedValues: ["number", "string"],
    containerSupport: [],
    requiresExpansion: false,
    googleSupport: "ignored",
    schemaSupport: true
  },
  {
    keyword: "@direction",
    introducedVersion: "1.1",
    deprecatedVersion: null,
    removedVersion: null,
    processingAlgorithm: "Value Expansion",
    aliases: [],
    allowedValues: ["string"],
    containerSupport: [],
    requiresExpansion: true,
    googleSupport: "ignored",
    schemaSupport: true
  },
  {
    keyword: "@import",
    introducedVersion: "1.1",
    deprecatedVersion: null,
    removedVersion: null,
    processingAlgorithm: "Context Processing",
    aliases: [],
    allowedValues: ["string"],
    containerSupport: [],
    requiresExpansion: false,
    googleSupport: "transformed",
    schemaSupport: true
  },
  {
    keyword: "@included",
    introducedVersion: "1.1",
    deprecatedVersion: null,
    removedVersion: null,
    processingAlgorithm: "Included Processing",
    aliases: [],
    allowedValues: ["array", "object"],
    containerSupport: [],
    requiresExpansion: true,
    googleSupport: "transformed",
    schemaSupport: true
  },
  {
    keyword: "@json",
    introducedVersion: "1.1",
    deprecatedVersion: null,
    removedVersion: null,
    processingAlgorithm: "Value Expansion",
    aliases: [],
    allowedValues: ["any"],
    containerSupport: [],
    requiresExpansion: true,
    googleSupport: "ignored",
    schemaSupport: true
  },
  {
    keyword: "@nest",
    introducedVersion: "1.1",
    deprecatedVersion: null,
    removedVersion: null,
    processingAlgorithm: "Nested Property Processing",
    aliases: [],
    allowedValues: ["object", "array"],
    containerSupport: [],
    requiresExpansion: true,
    googleSupport: "transformed",
    schemaSupport: true
  },
  {
    keyword: "@none",
    introducedVersion: "1.1",
    deprecatedVersion: null,
    removedVersion: null,
    processingAlgorithm: "Value Expansion",
    aliases: [],
    allowedValues: ["string"],
    containerSupport: [],
    requiresExpansion: true,
    googleSupport: "ignored",
    schemaSupport: true
  },
  {
    keyword: "@prefix",
    introducedVersion: "1.1",
    deprecatedVersion: null,
    removedVersion: null,
    processingAlgorithm: "Context Processing",
    aliases: [],
    allowedValues: ["boolean"],
    containerSupport: [],
    requiresExpansion: false,
    googleSupport: "ignored",
    schemaSupport: true
  },
  {
    keyword: "@propagate",
    introducedVersion: "1.1",
    deprecatedVersion: null,
    removedVersion: null,
    processingAlgorithm: "Context Processing",
    aliases: [],
    allowedValues: ["boolean"],
    containerSupport: [],
    requiresExpansion: false,
    googleSupport: "ignored",
    schemaSupport: true
  },
  {
    keyword: "@protected",
    introducedVersion: "1.1",
    deprecatedVersion: null,
    removedVersion: null,
    processingAlgorithm: "Context Processing",
    aliases: [],
    allowedValues: ["boolean"],
    containerSupport: [],
    requiresExpansion: false,
    googleSupport: "ignored",
    schemaSupport: true
  },
  // Framing
  {
    keyword: "@default",
    introducedVersion: "1.0",
    deprecatedVersion: null,
    removedVersion: null,
    processingAlgorithm: "Framing",
    aliases: [],
    allowedValues: ["any"],
    containerSupport: [],
    requiresExpansion: false,
    googleSupport: "unsupported",
    schemaSupport: false
  },
  {
    keyword: "@embed",
    introducedVersion: "1.0",
    deprecatedVersion: null,
    removedVersion: null,
    processingAlgorithm: "Framing",
    aliases: [],
    allowedValues: ["string"],
    containerSupport: [],
    requiresExpansion: false,
    googleSupport: "unsupported",
    schemaSupport: false
  },
  {
    keyword: "@explicit",
    introducedVersion: "1.0",
    deprecatedVersion: null,
    removedVersion: null,
    processingAlgorithm: "Framing",
    aliases: [],
    allowedValues: ["boolean"],
    containerSupport: [],
    requiresExpansion: false,
    googleSupport: "unsupported",
    schemaSupport: false
  },
  {
    keyword: "@omitDefault",
    introducedVersion: "1.0",
    deprecatedVersion: null,
    removedVersion: null,
    processingAlgorithm: "Framing",
    aliases: [],
    allowedValues: ["boolean"],
    containerSupport: [],
    requiresExpansion: false,
    googleSupport: "unsupported",
    schemaSupport: false
  },
  {
    keyword: "@requireAll",
    introducedVersion: "1.0",
    deprecatedVersion: null,
    removedVersion: null,
    processingAlgorithm: "Framing",
    aliases: [],
    allowedValues: ["boolean"],
    containerSupport: [],
    requiresExpansion: false,
    googleSupport: "unsupported",
    schemaSupport: false
  }
];

// 2. schema.json definition
const schemaOrgMetadata = {
  version: "26.0",
  types: {
    "Thing": { parent: null, properties: ["name", "url", "image", "description", "sameAs", "identifier", "alternateName"] },
    "Product": { parent: "Thing", properties: ["offers", "brand", "review", "aggregateRating", "sku", "gtin", "mpn", "color"] },
    "Offer": { parent: "Thing", properties: ["price", "priceCurrency", "availability", "itemCondition", "seller", "validFrom"] },
    "AggregateRating": { parent: "Thing", properties: ["ratingValue", "bestRating", "worstRating", "ratingCount", "reviewCount"] },
    "Review": { parent: "Thing", properties: ["reviewRating", "author", "itemReviewed", "reviewBody", "publisher"] },
    "Organization": { parent: "Thing", properties: ["logo", "address", "telephone", "member", "founder", "email"] },
    "Person": { parent: "Thing", properties: ["givenName", "familyName", "address", "telephone", "email", "jobTitle", "worksFor"] },
    "Place": { parent: "Thing", properties: ["address", "geo", "telephone"] },
    "PostalAddress": { parent: "ContactPoint", properties: ["streetAddress", "addressLocality", "addressRegion", "postalCode", "addressCountry"] },
    "ContactPoint": { parent: "Thing", properties: ["telephone", "contactType", "email", "areaServed"] },
    "BreadcrumbList": { parent: "ItemList", properties: ["itemListElement"] },
    "ItemList": { parent: "Thing", properties: ["itemListElement", "numberOfItems", "itemListOrder"] },
    "ListItem": { parent: "Thing", properties: ["item", "position", "nextItem", "previousItem"] },
    "Article": { parent: "CreativeWork", properties: ["headline", "articleBody", "author", "datePublished", "dateModified", "publisher"] },
    "CreativeWork": { parent: "Thing", properties: ["headline", "author", "publisher", "datePublished", "dateModified", "about"] },
    "Recipe": { parent: "HowTo", properties: ["recipeIngredient", "recipeInstructions", "cookTime", "prepTime", "nutrition", "yield"] },
    "HowTo": { parent: "CreativeWork", properties: ["steps", "estimatedCost", "tool", "supply"] },
    "LocalBusiness": { parent: "Organization", properties: ["openingHours", "priceRange", "geo", "currenciesAccepted"] },
    "FAQPage": { parent: "CreativeWork", properties: ["mainEntity"] },
    "Question": { parent: "Thing", properties: ["name", "acceptedAnswer", "suggestedAnswer"] },
    "Answer": { parent: "Thing", properties: ["text", "upvoteCount"] }
  },
  properties: {
    "name": { domain: ["Thing"], range: ["Text"] },
    "url": { domain: ["Thing"], range: ["URL"] },
    "image": { domain: ["Thing"], range: ["URL", "ImageObject"] },
    "description": { domain: ["Thing"], range: ["Text"] },
    "sameAs": { domain: ["Thing"], range: ["URL"] },
    "identifier": { domain: ["Thing"], range: ["PropertyValue", "Text", "URL"] },
    "alternateName": { domain: ["Thing"], range: ["Text"] },
    "offers": { domain: ["Product"], range: ["Offer", "AggregateOffer"] },
    "brand": { domain: ["Product"], range: ["Brand", "Organization"] },
    "review": { domain: ["Product"], range: ["Review"] },
    "aggregateRating": { domain: ["Product", "LocalBusiness"], range: ["AggregateRating"] },
    "sku": { domain: ["Product"], range: ["Text"] },
    "price": { domain: ["Offer"], range: ["Number", "Text"] },
    "priceCurrency": { domain: ["Offer"], range: ["Text"] },
    "ratingValue": { domain: ["AggregateRating", "Rating"], range: ["Number", "Text"] },
    "ratingCount": { domain: ["AggregateRating"], range: ["Integer"] },
    "itemListElement": { domain: ["ItemList"], range: ["ListItem", "Thing", "Text"] },
    "item": { domain: ["ListItem"], range: ["Thing"] },
    "position": { domain: ["ListItem"], range: ["Integer", "Text"] },
    "recipeIngredient": { domain: ["Recipe"], range: ["Text"] },
    "recipeInstructions": { domain: ["Recipe"], range: ["CreativeWork", "ItemList", "Text"] },
    "mainEntity": { domain: ["FAQPage"], range: ["Question"] },
    "acceptedAnswer": { domain: ["Question"], range: ["Answer"] },
    "text": { domain: ["Answer"], range: ["Text"] }
  },
  superseded: {
    "recipeYields": "yield",
    "seller": "vendor"
  }
};

// 3. algorithms.json definition
const algorithms = {
  "Expansion": {
    description: "Recursively expands all context terms into absolute IRIs and wraps values in value objects.",
    parameters: ["document", "context", "options"],
    googleStatus: "supported"
  },
  "Compaction": {
    description: "Transforms an expanded document into a more compact form using a specific context.",
    parameters: ["document", "context", "options"],
    googleStatus: "supported"
  },
  "Flattening": {
    description: "Flattens nested JSON-LD trees into a single-level array of node objects with forward references.",
    parameters: ["document", "context", "options"],
    googleStatus: "supported"
  },
  "Framing": {
    description: "Structures a JSON-LD document based on a template or 'frame'.",
    parameters: ["document", "frame", "options"],
    googleStatus: "ignored"
  },
  "Context Processing": {
    description: "Parses, merges, and dereferences @context values.",
    parameters: ["activeContext", "localContext", "remoteContexts"],
    googleStatus: "supported"
  }
};

// 4. containers.json definition
const containers = {
  "@list": { support: "supported", googleAction: "retained" },
  "@set": { support: "supported", googleAction: "retained" },
  "@language": { support: "supported", googleAction: "retained" },
  "@index": { support: "ignored", googleAction: "pruned" },
  "@id": { support: "supported", googleAction: "retained" },
  "@type": { support: "supported", googleAction: "retained" }
};

// 5. contexts.json definition
const contexts = {
  known: {
    "https://schema.org": { secure: true, type: "Schema.org" },
    "http://schema.org": { secure: false, type: "Schema.org" },
    "https://schema.org/": { secure: true, type: "Schema.org" },
    "http://schema.org/": { secure: false, type: "Schema.org" }
  },
  mappings: {
    "http://schema.org": "https://schema.org",
    "http://schema.org/": "https://schema.org"
  }
};

// 6. versions.json definition
const versions = {
  "1.0": {
    specUrl: "https://www.w3.org/TR/json-ld/",
    status: "W3C Recommendation"
  },
  "1.1": {
    specUrl: "https://www.w3.org/TR/json-ld11/",
    status: "W3C Recommendation"
  },
  "1.2": {
    specUrl: "https://json-ld.org/spec/latest/json-ld-syntax/",
    status: "Editor Draft"
  }
};

// 7. compatibility.json definition
const compatibility = {
  matrix: {
    "@graph": { Google: "supported", Schema: "supported", JSONLD: "supported" },
    "@reverse": { Google: "transformed", Schema: "supported", JSONLD: "supported" },
    "@included": { Google: "transformed", Schema: "supported", JSONLD: "supported" },
    "@nest": { Google: "ignored", Schema: "ignored", JSONLD: "supported" },
    "@index": { Google: "ignored", Schema: "ignored", JSONLD: "supported" },
    "@protected": { Google: "ignored", Schema: "ignored", JSONLD: "supported" }
  }
};

// 8. google.json definition
const googleRichResults = {
  target: "google",
  supportedRichResults: [
    "Product", "BreadcrumbList", "FAQPage", "Recipe", "Article", "LocalBusiness", "Organization"
  ],
  rules: {
    simplifySingleNodeGraph: true,
    flattenReverseProperties: true,
    hoistIncludedNodes: true,
    stripIgnoredKeywords: true,
    canonicalizeSchemaOrgIri: true
  }
};

fs.writeFileSync(path.join(outDir, 'keywords.json'), JSON.stringify(keywords, null, 2));
fs.writeFileSync(path.join(outDir, 'schema.json'), JSON.stringify(schemaOrgMetadata, null, 2));
fs.writeFileSync(path.join(outDir, 'algorithms.json'), JSON.stringify(algorithms, null, 2));
fs.writeFileSync(path.join(outDir, 'containers.json'), JSON.stringify(containers, null, 2));
fs.writeFileSync(path.join(outDir, 'contexts.json'), JSON.stringify(contexts, null, 2));
fs.writeFileSync(path.join(outDir, 'versions.json'), JSON.stringify(versions, null, 2));
fs.writeFileSync(path.join(outDir, 'compatibility.json'), JSON.stringify(compatibility, null, 2));
fs.writeFileSync(path.join(outDir, 'google.json'), JSON.stringify(googleRichResults, null, 2));

console.log("Metadata and schema registries successfully generated in:", outDir);
