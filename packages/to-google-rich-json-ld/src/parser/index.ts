import { Readable } from 'stream';
import { RawDocument, ConvertInput } from '../types/index.js';

export class Parser {
  /**
   * Helper to determine if an input is a Node.js Readable stream or similar stream-like object.
   */
  private static isStream(input: any): input is Readable {
    return (
      input !== null &&
      typeof input === 'object' &&
      typeof input.on === 'function' &&
      typeof input.pipe === 'function'
    );
  }

  /**
   * Deeply clone an object/array to maintain strict immutability.
   */
  private static deepClone(val: any): any {
    if (val === null || typeof val !== 'object') {
      return val;
    }
    if (Array.isArray(val)) {
      return val.map((item) => Parser.deepClone(item));
    }
    const cloned: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      cloned[k] = Parser.deepClone(v);
    }
    return cloned;
  }

  /**
   * Parses various raw input types into a RawDocument (parsed JS object structure).
   */
  public async parse(input: ConvertInput): Promise<RawDocument> {
    if (input === undefined || input === null) {
      throw new Error("Input cannot be null or undefined");
    }

    if (Parser.isStream(input)) {
      const chunks: any[] = [];
      for await (const chunk of input) {
        chunks.push(chunk);
      }
      if (chunks.some(c => typeof c === 'string')) {
        const str = chunks.join('');
        return JSON.parse(str);
      } else {
        if (typeof Buffer !== 'undefined') {
          const buffer = Buffer.concat(chunks);
          const str = buffer.toString('utf-8');
          return JSON.parse(str);
        } else {
          throw new Error("Buffer is not supported in this environment.");
        }
      }
    }

    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(input)) {
      const str = input.toString('utf-8');
      return JSON.parse(str);
    }

    if (typeof input === 'string') {
      return JSON.parse(input);
    }

    if (typeof input === 'object') {
      return Parser.deepClone(input);
    }

    throw new Error(`Unsupported input type: ${typeof input}`);
  }
}
