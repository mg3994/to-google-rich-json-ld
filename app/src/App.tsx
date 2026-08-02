import { useState } from 'react';
import {
  convert,
  detectVersion,
  validate,
  analyze
} from 'to-google-rich-json-ld';

const DEFAULT_TEMPLATE = `{
  "@context": "http://schema.org",
  "@type": "Product",
  "name": "Ultimate Gaming Laptop",
  "recipeIngredient": "Salt",
  "offers": {
    "@type": "Offer",
    "price": "1499.00",
    "availability": "InStock"
  },
  "@reverse": {
    "author": {
      "@type": "Book",
      "name": "User Guide"
    }
  },
  "@future_keyword": "experimental-config"
}`;

export default function App() {
  const [inputCode, setInputCode] = useState(DEFAULT_TEMPLATE);
  const [outputCode, setOutputCode] = useState('');
  const [isProcessing, setIsLoading] = useState(false);
  const [detectedVer, setDetectedVer] = useState('');
  const [analysis, setAnalysis] = useState<{
    keywordsUsed: string[];
    unknownKeywords: string[];
    schemaTypes: string[];
    contextUrls: string[];
  } | null>(null);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    errors: string[];
  } | null>(null);

  const handleConvert = async () => {
    setIsLoading(true);
    try {
      // 1. Detect JSON-LD version
      const ver = await detectVersion(inputCode);
      setDetectedVer(ver);

      // 2. Analyze Document
      const info = await analyze(inputCode);
      setAnalysis({
        keywordsUsed: info.keywordsUsed,
        unknownKeywords: info.unknownKeywords,
        schemaTypes: info.schemaTypes,
        contextUrls: info.contextUrls
      });

      // 3. Validate
      const val = await validate(inputCode);
      setValidationResult(val);

      // 4. Perform conversion using to-google-rich-json-ld
      const result = await convert(inputCode);
      setOutputCode(JSON.stringify(result, null, 2));
    } catch (err: any) {
      setOutputCode(`Error converting JSON-LD:\n${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadSample = (type: string) => {
    if (type === 'product') {
      setInputCode(DEFAULT_TEMPLATE);
    } else if (type === 'recipe') {
      setInputCode(`{
  "@context": "http://schema.org/",
  "@type": "Recipe",
  "recipeYields": "4 servings",
  "recipeIngredient": [
    "1 cup flour",
    "2 eggs"
  ],
  "recipeInstructions": "Mix and bake."
}`);
    } else if (type === 'article') {
      setInputCode(`{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "A great day for Linked Data",
  "datePublished": "2026-08-01"
}`);
    } else if (type === 'corrections') {
      setInputCode(`{
  "@context": "http://schema.org",
  "@type": "Product",
  "name": "Super Gaming Gear",
  "PriceCurrency": "USD",
  "price_currency": "EUR",
  "price-currency": "GBP",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": 9.5,
    "bestRating": 5,
    "worstRating": 10
  },
  "offers": {
    "price": "$1,499.00"
  }
}`);
    } else if (type === 'warnings') {
      setInputCode(`{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Greens & Grocer",
  "telephone": "1-800-555-0199",
  "email": "notanemail.com",
  "datePublished": "2026-02-29",
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 95.0,
    "longitude": -190.0
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": 12.5,
    "bestRating": 10,
    "worstRating": 12
  },
  "offers": {
    "@type": "Offer",
    "price": -19.99
  }
}`);
    }
    setOutputCode('');
    setDetectedVer('');
    setAnalysis(null);
    setValidationResult(null);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '16px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', color: '#fff' }}>Google Rich Results Normalization Playground</h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#888' }}>
            Transform, clean, and validate any JSON-LD document natively for Google Rich Results compatibility.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button onClick={() => handleLoadSample('product')} style={btnStyleSecondary}>Load Product Sample</button>
          <button onClick={() => handleLoadSample('recipe')} style={btnStyleSecondary}>Load Recipe Sample</button>
          <button onClick={() => handleLoadSample('article')} style={btnStyleSecondary}>Load Article Sample</button>
          <button onClick={() => handleLoadSample('corrections')} style={{ ...btnStyleSecondary, borderColor: '#10b981', color: '#10b981' }}>Load Corrections Sample</button>
          <button onClick={() => handleLoadSample('warnings')} style={{ ...btnStyleSecondary, borderColor: '#ef4444', color: '#ef4444' }}>Load Warnings Sample</button>
        </div>
      </header>

      {/* Side-by-side Editors */}
      <div style={{ display: 'flex', gap: '20px', position: 'relative', height: '550px' }}>
        {/* Left Editor */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={labelStyle}>Input JSON-LD</span>
            <span style={{ fontSize: '12px', color: '#666' }}>Paste your raw structured data</span>
          </div>
          <textarea
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value)}
            style={editorStyle}
            spellCheck="false"
            placeholder="Paste JSON-LD here..."
          />
        </div>

        {/* Play/Convert Button in Center */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <button
            onClick={handleConvert}
            disabled={isProcessing}
            style={playButtonStyle}
            title="Convert and Normalise for Google Rich Results"
          >
            {isProcessing ? (
              <span className="spinner" style={spinnerStyle}></span>
            ) : (
              <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
        </div>

        {/* Right Editor */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={labelStyle}>Google Rich Results Optimized Output</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(outputCode);
                alert('Copied to clipboard!');
              }}
              disabled={!outputCode}
              style={{ ...btnStyleSecondary, padding: '4px 10px', fontSize: '12px' }}
            >
              Copy
            </button>
          </div>
          <textarea
            value={outputCode}
            readOnly
            style={{ ...editorStyle, backgroundColor: '#111', color: '#10b981' }}
            spellCheck="false"
            placeholder="Optimized Google Rich compatible JSON-LD will appear here..."
          />
        </div>
      </div>

      {/* Metadata & Validation Drawer */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '24px', backgroundColor: '#151515', borderRadius: '8px', padding: '20px', border: '1px solid #222' }}>
        {/* Analysis & Detection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#fff', borderBottom: '1px solid #222', paddingBottom: '8px' }}>Metadata Inspector</h3>

          <div>
            <div style={metaKeyStyle}>Detected Version:</div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: detectedVer ? '#10b981' : '#666' }}>
              {detectedVer ? `JSON-LD ${detectedVer}` : 'Not analyzed yet'}
            </div>
          </div>

          {analysis && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={metaKeyStyle}>Standard Keywords Used:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                  {analysis.keywordsUsed.map(k => (
                    <span key={k} style={tagStyle}>{k}</span>
                  ))}
                </div>
              </div>

              {analysis.unknownKeywords.length > 0 && (
                <div>
                  <div style={{ ...metaKeyStyle, color: '#f59e0b' }}>Unknown/Experimental Keywords:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                    {analysis.unknownKeywords.map(k => (
                      <span key={k} style={{ ...tagStyle, backgroundColor: '#78350f', color: '#f59e0b' }}>{k}</span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div style={metaKeyStyle}>Schema.org Entity Types:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                  {analysis.schemaTypes.map(t => (
                    <span key={t} style={{ ...tagStyle, backgroundColor: '#1e3a8a', color: '#3b82f6' }}>{t}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Validation Errors & Conformance */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#fff', borderBottom: '1px solid #222', paddingBottom: '8px' }}>Google Structured Data & Schema Conformance</h3>

          {!validationResult ? (
            <div style={{ color: '#666', fontSize: '14px', fontStyle: 'italic' }}>
              Run conversion to validate Google structured data guidelines and Schema.org domains/ranges.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  display: 'inline-block',
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: validationResult.valid ? '#10b981' : '#ef4444'
                }}></span>
                <span style={{ fontSize: '16px', fontWeight: 'bold' }}>
                  {validationResult.valid ? 'Valid Google structured data document' : 'Warnings / Validation errors found'}
                </span>
              </div>

              {validationResult.errors.length > 0 && (
                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #ef444455', borderRadius: '4px', backgroundColor: '#7f1d1d22', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {validationResult.errors.map((err, idx) => (
                    <div key={idx} style={{ fontSize: '13px', color: '#fca5a5', display: 'flex', gap: '6px' }}>
                      <span>•</span>
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              )}

              {validationResult.valid && (
                <div style={{ fontSize: '14px', color: '#10b981', backgroundColor: '#065f4622', border: '1px solid #04785755', borderRadius: '4px', padding: '12px' }}>
                  No warnings or errors detected. This document is fully structured-data compliant!
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Styling Constants
const btnStyleSecondary = {
  backgroundColor: '#2d2d2d',
  color: '#ccc',
  border: '1px solid #444',
  borderRadius: '4px',
  padding: '8px 16px',
  cursor: 'pointer',
  fontSize: '14px',
  transition: 'all 0.2s'
};

const labelStyle = {
  fontSize: '14px',
  fontWeight: 'bold',
  color: '#aaa',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em'
};

const editorStyle = {
  width: '100%',
  height: '100%',
  backgroundColor: '#1a1a1a',
  color: '#e0e0e0',
  border: '1px solid #333',
  borderRadius: '6px',
  padding: '16px',
  fontSize: '13px',
  fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
  lineHeight: '1.5',
  resize: 'none' as const,
  boxSizing: 'border-box' as const,
  outline: 'none'
};

const playButtonStyle = {
  backgroundColor: '#3b82f6',
  color: '#fff',
  border: 'none',
  borderRadius: '50%',
  width: '64px',
  height: '64px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)',
  transition: 'transform 0.2s, background-color 0.2s',
  outline: 'none'
};

const metaKeyStyle = {
  fontSize: '12px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  color: '#666',
  marginBottom: '2px'
};

const tagStyle = {
  fontSize: '12px',
  padding: '3px 8px',
  backgroundColor: '#2d2d2d',
  color: '#aaa',
  borderRadius: '4px',
  fontFamily: 'monospace'
};

const spinnerStyle = {
  display: 'inline-block',
  width: '24px',
  height: '24px',
  border: '3px solid rgba(255,255,255,0.3)',
  borderRadius: '50%',
  borderTopColor: '#fff',
  animation: 'spin 1s ease-in-out infinite'
};
