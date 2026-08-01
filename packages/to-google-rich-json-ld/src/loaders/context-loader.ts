import { Config } from '../types/index.js';

export class ContextLoader {
  private cache: Map<string, any> = new Map();
  private config: Config;

  // Full set of authoritative prefixes and semantic web vocabulary mappings
  private static readonly STANDARD_PREFIXES: Record<string, string> = {
    "bibo": "http://purl.org/ontology/bibo/",
    "brick": "https://brickschema.org/schema/Brick#",
    "cmns-cls": "https://www.omg.org/spec/Commons/Classifiers/",
    "cmns-col": "https://www.omg.org/spec/Commons/Collections/",
    "cmns-dt": "https://www.omg.org/spec/Commons/DatesAndTimes/",
    "cmns-ge": "https://www.omg.org/spec/Commons/GeopoliticalEntities/",
    "cmns-id": "https://www.omg.org/spec/Commons/Identifiers/",
    "cmns-loc": "https://www.omg.org/spec/Commons/Locations/",
    "cmns-q": "https://www.omg.org/spec/Commons/Quantities/",
    "cmns-txt": "https://www.omg.org/spec/Commons/Text/",
    "csvw": "http://www.w3.org/ns/csvw#",
    "dc": "http://purl.org/dc/elements/1.1/",
    "dcam": "http://purl.org/dc/dcam/",
    "dcat": "http://www.w3.org/ns/dcat#",
    "dct": "http://purl.org/dc/terms/",
    "dctype": "http://purl.org/dc/dcmitype/",
    "doap": "http://usefulinc.com/ns/doap#",
    "eli": "http://data.europa.eu/eli/ontology#",
    "fibo-be-corp-corp": "https://spec.edmcouncil.org/fibo/ontology/BE/Corporations/Corporations/",
    "fibo-be-ge-ge": "https://spec.edmcouncil.org/fibo/ontology/BE/GovernmentEntities/GovernmentEntities/",
    "fibo-be-le-cb": "https://spec.edmcouncil.org/fibo/ontology/BE/LegalEntities/CorporateBodies/",
    "fibo-be-le-lp": "https://spec.edmcouncil.org/fibo/ontology/BE/LegalEntities/LegalPersons/",
    "fibo-be-nfp-nfp": "https://spec.edmcouncil.org/fibo/ontology/BE/NotForProfitOrganizations/NotForProfitOrganizations/",
    "fibo-be-oac-cctl": "https://spec.edmcouncil.org/fibo/ontology/BE/OwnershipAndControl/CorporateControl/",
    "fibo-fbc-dae-dbt": "https://spec.edmcouncil.org/fibo/ontology/FBC/DebtAndEquities/Debt/",
    "fibo-fbc-pas-fpas": "https://spec.edmcouncil.org/fibo/ontology/FBC/ProductsAndServices/FinancialProductsAndServices/",
    "fibo-fnd-acc-cur": "https://spec.edmcouncil.org/fibo/ontology/FND/Accounting/CurrencyAmount/",
    "fibo-fnd-agr-ctr": "https://spec.edmcouncil.org/fibo/ontology/FND/Agreements/Contracts/",
    "fibo-fnd-arr-doc": "https://spec.edmcouncil.org/fibo/ontology/FND/Arrangements/Documents/",
    "fibo-fnd-arr-lif": "https://spec.edmcouncil.org/fibo/ontology/FND/Arrangements/Lifecycles/",
    "fibo-fnd-dt-oc": "https://spec.edmcouncil.org/fibo/ontology/FND/DatesAndTimes/Occurrences/",
    "fibo-fnd-org-org": "https://spec.edmcouncil.org/fibo/ontology/FND/Organizations/Organizations/",
    "fibo-fnd-pas-pas": "https://spec.edmcouncil.org/fibo/ontology/FND/ProductsAndServices/ProductsAndServices/",
    "fibo-fnd-plc-adr": "https://spec.edmcouncil.org/fibo/ontology/FND/Places/Addresses/",
    "fibo-fnd-plc-fac": "https://spec.edmcouncil.org/fibo/ontology/FND/Places/Facilities/",
    "fibo-fnd-plc-loc": "https://spec.edmcouncil.org/fibo/ontology/FND/Places/Locations/",
    "fibo-fnd-pty-pty": "https://spec.edmcouncil.org/fibo/ontology/FND/Parties/Parties/",
    "fibo-fnd-rel-rel": "https://spec.edmcouncil.org/fibo/ontology/FND/Relations/Relations/",
    "fibo-pay-ps-ps": "https://spec.edmcouncil.org/fibo/ontology/PAY/PaymentServices/PaymentServices/",
    "foaf": "http://xmlns.com/foaf/0.1/",
    "geo": "http://www.opengis.net/ont/geosparql#",
    "gleif-L1": "https://www.gleif.org/ontology/L1/",
    "gs1": "https://ref.gs1.org/voc/",
    "hydra": "http://www.w3.org/ns/hydra/core#",
    "lcc-3166-1": "https://www.omg.org/spec/LCC/Countries/ISO3166-1-CountryCodes/",
    "lcc-4217": "https://www.omg.org/spec/LCC/Countries/ISO4217-CurrencyCodes/",
    "lcc-cr": "https://www.omg.org/spec/LCC/Countries/CountryRepresentation/",
    "lcc-lr": "https://www.omg.org/spec/LCC/Languages/LanguageRepresentation/",
    "lrmoo": "http://iflastandards.info/ns/lrm/lrmoo/",
    "mo": "http://purl.org/ontology/mo/",
    "odrl": "http://www.w3.org/ns/odrl/2/",
    "og": "http://ogp.me/ns#",
    "org": "http://www.w3.org/ns/org#",
    "owl": "http://www.w3.org/2002/07/owl#",
    "prof": "http://www.w3.org/ns/dx/prof/",
    "prov": "http://www.w3.org/ns/prov#",
    "qb": "http://purl.org/linked-data/cube#",
    "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
    "sarif": "http://sarif.info/",
    "schema": "https://schema.org/",
    "sh": "http://www.w3.org/ns/shacl#",
    "skos": "http://www.w3.org/2004/02/skos/core#",
    "snomed": "http://purl.bioontology.org/ontology/SNOMEDCT/",
    "sosa": "http://www.w3.org/ns/sosa/",
    "ssn": "http://www.w3.org/ns/ssn/",
    "time": "http://www.w3.org/2006/time#",
    "unece": "http://unece.org/vocab#",
    "vann": "http://purl.org/vocab/vann/",
    "vcard": "http://www.w3.org/2006/vcard/ns#",
    "void": "http://rdfs.org/ns/void#",
    "wgs": "https://www.w3.org/2003/01/geo/wgs84_pos#",
    "xsd": "http://www.w3.org/2001/XMLSchema#"
  };

  constructor(config: Config) {
    this.config = config;

    // Core Schema.org context definition
    const schemaOrgContext = {
      "@vocab": "https://schema.org/",
      "schema": "https://schema.org/",
      ...ContextLoader.STANDARD_PREFIXES
    };

    this.cache.set("https://schema.org", schemaOrgContext);
    this.cache.set("http://schema.org", schemaOrgContext);
    this.cache.set("https://schema.org/", schemaOrgContext);
    this.cache.set("http://schema.org/", schemaOrgContext);
  }

  /**
   * Resolves a context value (which could be a string URL, a local object, or an array of both).
   * Returns a flattened/merged single context object containing all standard prefix mappings.
   */
  public async load(contextValue: any): Promise<Record<string, any>> {
    const baseContext = { ...ContextLoader.STANDARD_PREFIXES };

    if (!contextValue) {
      return baseContext;
    }

    if (Array.isArray(contextValue)) {
      let merged: Record<string, any> = { ...baseContext };
      for (const item of contextValue) {
        const resolved = await this.load(item);
        merged = { ...merged, ...resolved };
      }
      return merged;
    }

    if (typeof contextValue === 'string') {
      const remoteResolved = await this.loadRemote(contextValue);
      return { ...baseContext, ...remoteResolved };
    }

    if (typeof contextValue === 'object' && contextValue !== null) {
      let localCtx = { ...contextValue };
      if ('@context' in localCtx) {
        localCtx = localCtx['@context'];
      }
      if ('@import' in localCtx && typeof localCtx['@import'] === 'string') {
        const imported = await this.loadRemote(localCtx['@import'] as string);
        localCtx = { ...imported, ...localCtx };
        delete localCtx['@import'];
      }
      return { ...baseContext, ...localCtx };
    }

    return baseContext;
  }

  /**
   * Fetches a remote context and caches it if configured.
   */
  private async loadRemote(url: string): Promise<Record<string, any>> {
    if (!this.config.fetchRemoteContexts) {
      return this.cache.get(url) || {};
    }

    if (this.config.cacheContexts && this.cache.has(url)) {
      return this.cache.get(url);
    }

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) {
        throw new Error(`Failed to fetch context: ${res.statusText}`);
      }
      const data = await res.json() as any;
      const parsed = data['@context'] || data;

      if (this.config.cacheContexts) {
        this.cache.set(url, parsed);
      }
      return parsed;
    } catch (err: any) {
      const normalizedUrl = url.replace(/\/$/, "");
      if (normalizedUrl.includes("schema.org")) {
        return this.cache.get("https://schema.org");
      }
      console.warn(`Could not load remote context from: ${url}. Error: ${err.message}`);
      return {};
    }
  }
}
