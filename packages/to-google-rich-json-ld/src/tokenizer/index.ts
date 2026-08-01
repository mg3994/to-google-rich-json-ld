export type TokenType =
  | 'BraceOpen'
  | 'BraceClose'
  | 'BracketOpen'
  | 'BracketClose'
  | 'Colon'
  | 'Comma'
  | 'String'
  | 'Number'
  | 'Boolean'
  | 'Null'
  | 'Keyword'
  | 'IRI'
  | 'Identifier';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

export class Tokenizer {
  private input: string;
  private index: number = 0;
  private line: number = 1;
  private column: number = 1;

  constructor(input: string) {
    this.input = input;
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];
    while (this.index < this.input.length) {
      const char = this.input[this.index];

      if (this.isWhitespace(char)) {
        this.consumeWhitespace();
        continue;
      }

      if (char === '{') {
        tokens.push(this.createToken('BraceOpen', '{'));
        this.next();
        continue;
      }
      if (char === '}') {
        tokens.push(this.createToken('BraceClose', '}'));
        this.next();
        continue;
      }
      if (char === '[') {
        tokens.push(this.createToken('BracketOpen', '['));
        this.next();
        continue;
      }
      if (char === ']') {
        tokens.push(this.createToken('BracketClose', ']'));
        this.next();
        continue;
      }
      if (char === ':') {
        tokens.push(this.createToken('Colon', ':'));
        this.next();
        continue;
      }
      if (char === ',') {
        tokens.push(this.createToken('Comma', ','));
        this.next();
        continue;
      }

      if (char === '"') {
        tokens.push(this.tokenizeString());
        continue;
      }

      if (this.isDigit(char) || char === '-') {
        tokens.push(this.tokenizeNumber());
        continue;
      }

      if (this.isAlpha(char) || char === '_' || char === '@') {
        tokens.push(this.tokenizeIdentifierOrKeyword());
        continue;
      }

      this.next();
    }
    return tokens;
  }

  private createToken(type: TokenType, value: string): Token {
    return { type, value, line: this.line, column: this.column };
  }

  private isWhitespace(char: string): boolean {
    return char === ' ' || char === '\t' || char === '\r' || char === '\n';
  }

  private consumeWhitespace() {
    const char = this.input[this.index];
    if (char === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    this.index++;
  }

  private next() {
    this.index++;
    this.column++;
  }

  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  private isAlpha(char: string): boolean {
    return (
      (char >= 'a' && char <= 'z') ||
      (char >= 'A' && char <= 'Z') ||
      char === '/' ||
      char === '.' ||
      char === '#' ||
      char === '?' ||
      char === '&' ||
      char === '=' ||
      char === '-' ||
      char === ':'
    );
  }

  private tokenizeString(): Token {
    const startLine = this.line;
    const startColumn = this.column;
    this.next(); // Consume opening quote
    let value = '';
    while (this.index < this.input.length) {
      const char = this.input[this.index];
      if (char === '"') {
        this.next(); // Consume closing quote
        break;
      }
      value += char;
      this.next();
    }
    const type: TokenType = value.startsWith('@') ? 'Keyword' : (this.isIRI(value) ? 'IRI' : 'String');
    return { type, value, line: startLine, column: startColumn };
  }

  private isIRI(value: string): boolean {
    return value.startsWith('http://') || value.startsWith('https://') || value.includes(':');
  }

  private tokenizeNumber(): Token {
    const startLine = this.line;
    const startColumn = this.column;
    let value = '';
    while (this.index < this.input.length) {
      const char = this.input[this.index];
      if (this.isDigit(char) || char === '.' || char === '-' || char === 'e' || char === 'E') {
        value += char;
        this.next();
      } else {
        break;
      }
    }
    return { type: 'Number', value, line: startLine, column: startColumn };
  }

  private tokenizeIdentifierOrKeyword(): Token {
    const startLine = this.line;
    const startColumn = this.column;
    let value = '';
    while (this.index < this.input.length) {
      const char = this.input[this.index];
      if (this.isAlpha(char) || this.isDigit(char) || char === '_' || char === '@') {
        value += char;
        this.next();
      } else {
        break;
      }
    }
    let type: TokenType = 'Identifier';
    if (value === 'true' || value === 'false') {
      type = 'Boolean';
    } else if (value === 'null') {
      type = 'Null';
    } else if (value.startsWith('@')) {
      type = 'Keyword';
    }
    return { type, value, line: startLine, column: startColumn };
  }
}
