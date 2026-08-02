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
   * Deeply clone an object/array to maintain strict immutability, with full cycle-detection support.
   */
  private static deepClone(val: any, visited = new Map<any, any>()): any {
    if (val === null || typeof val !== 'object') {
      return val;
    }
    if (visited.has(val)) {
      return visited.get(val);
    }

    if (Array.isArray(val)) {
      const clonedArr: any[] = [];
      visited.set(val, clonedArr);
      for (const item of val) {
        clonedArr.push(Parser.deepClone(item, visited));
      }
      return clonedArr;
    }

    const clonedObj: Record<string, any> = {};
    visited.set(val, clonedObj);
    for (const [k, v] of Object.entries(val)) {
      clonedObj[k] = Parser.deepClone(v, visited);
    }
    return clonedObj;
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
