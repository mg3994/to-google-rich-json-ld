import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.join(__dirname, '../src/generated');

async function crawlSchemaOrg() {
  console.log("Crawling current Schema.org release...");
  try {
    const res = await fetch("https://schema.org/version/latest/schemaorg-current-https.jsonld", { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const data = (await res.json()) as any;
    console.log("Successfully fetched current Schema.org release. Parsing graph...");

    const types: Record<string, { parent: string | null; properties: string[] }> = {};
    const properties: Record<string, { domain: string[]; range: string[] }> = {};

    const graph = data["@graph"] || [];
    for (const item of graph) {
      const id = item["@id"];
      const type = item["@type"];
      if (!id || !type) continue;

      const name = id.replace("schema:", "");

      if (type === "rdfs:Class" || (Array.isArray(type) && type.includes("rdfs:Class"))) {
        let parentName: string | null = null;
        const subClassOf = item["rdfs:subClassOf"];
        if (subClassOf) {
          const parentId = Array.isArray(subClassOf) ? subClassOf[0]["@id"] : subClassOf["@id"];
          if (parentId) {
            parentName = parentId.replace("schema:", "");
          }
        }
        types[name] = { parent: parentName, properties: [] };
      } else if (type === "rdf:Property" || (Array.isArray(type) && type.includes("rdf:Property"))) {
        const domainIncludes = item["schema:domainIncludes"];
        const rangeIncludes = item["schema:rangeIncludes"];

        const domain: string[] = [];
        if (domainIncludes) {
          const arr = Array.isArray(domainIncludes) ? domainIncludes : [domainIncludes];
          for (const d of arr) {
            if (d["@id"]) domain.push(d["@id"].replace("schema:", ""));
          }
        }

        const range: string[] = [];
        if (rangeIncludes) {
          const arr = Array.isArray(rangeIncludes) ? rangeIncludes : [rangeIncludes];
          for (const r of arr) {
            if (r["@id"]) range.push(r["@id"].replace("schema:", ""));
          }
        }

        properties[name] = { domain, range };
      }
    }

    // Populate properties into classes
    for (const [propName, propData] of Object.entries(properties)) {
      for (const dom of propData.domain) {
        if (types[dom]) {
          types[dom].properties.push(propName);
        }
      }
    }

    return { types, properties };
  } catch (err: any) {
    console.warn("Could not crawl official Schema.org jsonld file (likely offline). Falling back to static values.", err.message);
    return null;
  }
}

async function run() {
  const crawledSchema = await crawlSchemaOrg();
  if (crawledSchema) {
    const schemaPath = path.join(outDir, 'schema.json');
    let existing: any = {};
    if (fs.existsSync(schemaPath)) {
      try {
        existing = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
      } catch {}
    }
    const mergedSchema = {
      version: existing.version || "crawled",
      types: { ...existing.types, ...crawledSchema.types },
      properties: { ...existing.properties, ...crawledSchema.properties },
      superseded: existing.superseded || {}
    };
    fs.writeFileSync(schemaPath, JSON.stringify(mergedSchema, null, 2));
    console.log("Schema registry updated successfully from live crawling.");
  } else {
    console.log("Using static pre-packaged Schema.org schema.");
  }
}

run().catch(console.error);
