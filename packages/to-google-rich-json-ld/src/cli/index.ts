#!/usr/bin/env node

import { program } from 'commander';
import fs from 'fs';
import path from 'path';
import { GoogleRichJsonLdEngine } from '../index.js';

program
  .name('to-google-rich-json-ld')
  .description('Transform any JSON-LD document into a Google Rich Results compatible JSON-LD document')
  .version('1.0.0')
  .option('-i, --input <path>', 'path to input JSON-LD file (defaults to stdin)')
  .option('-o, --output <path>', 'path to output JSON-LD file (defaults to stdout)')
  .option('--target <string>', 'target results profile', 'google')
  .option('--no-fetch-remote-contexts', 'disable remote context fetching')
  .option('--no-cache-contexts', 'disable context caching')
  .option('--strict', 'enable strict validation mode', false);

program.parse(process.argv);

const options = program.opts();

async function run() {
  let inputContent = '';

  if (options.input) {
    const resolvedPath = path.resolve(options.input);
    if (!fs.existsSync(resolvedPath)) {
      console.error(`Error: Input file does not exist at ${resolvedPath}`);
      process.exit(1);
    }
    inputContent = fs.readFileSync(resolvedPath, 'utf-8');
  } else {
    // Read from standard input
    inputContent = await new Promise<string>((resolve) => {
      let data = '';
      process.stdin.setEncoding('utf-8');
      process.stdin.on('data', chunk => {
        data += chunk;
      });
      process.stdin.on('end', () => {
        resolve(data);
      });
    });
  }

  if (!inputContent.trim()) {
    console.error('Error: Empty input content.');
    process.exit(1);
  }

  try {
    const engine = new GoogleRichJsonLdEngine();
    const result = await engine.convert(inputContent, {
      target: options.target,
      fetchRemoteContexts: options.fetchRemoteContexts,
      cacheContexts: options.cacheContexts,
      strict: options.strict
    });

    const outputJson = JSON.stringify(result, null, 2);

    if (options.output) {
      fs.writeFileSync(path.resolve(options.output), outputJson, 'utf-8');
      console.log(`Successfully converted and saved to: ${options.output}`);
    } else {
      console.log(outputJson);
    }
  } catch (err: any) {
    console.error('Error processing JSON-LD:', err.message);
    process.exit(1);
  }
}

run();
