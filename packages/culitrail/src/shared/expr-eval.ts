/**
 * A tiny arithmetic expression evaluator: `+ - * /`, `||`, parentheses, and
 * named variables from a scope object.
 *
 * It exists so that a badge formula such as
 * `(prepTime || 0) + (reheatTime || 0) || null` can be evaluated **without
 * `eval`**. A formula lives in `data.json`, which is a file a user edits and a
 * sync service moves around, so it is not a place to hand arbitrary code to
 * the JavaScript engine. A hand-written parser that understands five
 * operators and nothing else cannot reach anything it was not given.
 *
 * Values stay `unknown` until an arithmetic operator forces numeric coercion.
 * That is what lets `||` short-circuit on JavaScript truthiness rather than on
 * a pre-coerced number, so the formula above yields null for a meal that
 * states neither time rather than 0.
 *
 * App-free.
 */

type Scope = Record<string, unknown>;

function toNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value);
}

function isTruthy(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'number') return value !== 0 && !Number.isNaN(value);
  if (typeof value === 'string') return value.length > 0;
  if (typeof value === 'boolean') return value;
  return true;
}

class Parser {
  private position = 0;

  constructor(
    private readonly source: string,
    private readonly scope: Scope
  ) {}

  parse(): unknown {
    const value = this.parseOr();
    this.skipWhitespace();
    if (this.position < this.source.length) {
      throw new SyntaxError(`Unexpected token at ${this.position}`);
    }
    return value;
  }

  private skipWhitespace(): void {
    while (this.position < this.source.length && /\s/.test(this.source[this.position])) {
      this.position++;
    }
  }

  private peek(): string {
    this.skipWhitespace();
    return this.source[this.position] ?? '';
  }

  private consume(character: string): void {
    this.skipWhitespace();
    if (this.source[this.position] !== character) {
      throw new SyntaxError(`Expected '${character}' at ${this.position}`);
    }
    this.position++;
  }

  private peekOr(): boolean {
    this.skipWhitespace();
    return this.source[this.position] === '|' && this.source[this.position + 1] === '|';
  }

  private parseOr(): unknown {
    let value = this.parseAddSub();
    while (this.peekOr()) {
      this.position += 2;
      const right = this.parseAddSub();
      // Short-circuits like JavaScript's own `||`: keep the left value when it
      // is truthy, otherwise take the right, coercing neither.
      value = isTruthy(value) ? value : right;
    }
    return value;
  }

  private parseAddSub(): unknown {
    let value = this.parseMulDiv();
    while (this.peek() === '+' || this.peek() === '-') {
      const operator = this.source[this.position++];
      const right = this.parseMulDiv();
      value =
        operator === '+' ? toNumber(value) + toNumber(right) : toNumber(value) - toNumber(right);
    }
    return value;
  }

  private parseMulDiv(): unknown {
    let value = this.parseUnary();
    while (this.peek() === '*' || this.peek() === '/') {
      const operator = this.source[this.position++];
      const right = this.parseUnary();
      value =
        operator === '*' ? toNumber(value) * toNumber(right) : toNumber(value) / toNumber(right);
    }
    return value;
  }

  private parseUnary(): unknown {
    if (this.peek() === '-') {
      this.position++;
      return -toNumber(this.parsePrimary());
    }
    return this.parsePrimary();
  }

  private parsePrimary(): unknown {
    this.skipWhitespace();
    if (this.peek() === '(') {
      this.consume('(');
      const value = this.parseOr();
      this.consume(')');
      return value;
    }
    if (/[0-9.]/.test(this.peek())) return this.parseNumber();
    if (/[a-zA-Z_]/.test(this.peek())) return this.parseIdentifier();
    throw new SyntaxError(`Unexpected character '${this.peek()}' at ${this.position}`);
  }

  private parseNumber(): number {
    const start = this.position;
    while (this.position < this.source.length && /[0-9.]/.test(this.source[this.position])) {
      this.position++;
    }
    return parseFloat(this.source.slice(start, this.position));
  }

  private parseIdentifier(): unknown {
    const start = this.position;
    while (this.position < this.source.length && /[a-zA-Z0-9_]/.test(this.source[this.position])) {
      this.position++;
    }
    const name = this.source.slice(start, this.position);

    if (name === 'null') return null;
    if (name === 'true') return true;
    if (name === 'false') return false;

    // A property this note simply does not have resolves to null rather than
    // throwing, so `prop || fallback` works for an optional property instead
    // of failing the whole formula. That is the common case, not the edge
    // case: most meals state some of their fields.
    if (!(name in this.scope)) return null;
    return this.scope[name];
  }
}

/** Evaluates an expression, returning null for anything malformed rather than throwing at a render site. */
export function evaluateExpr(expression: string, scope: Record<string, unknown>): unknown {
  try {
    return new Parser(expression, scope).parse() ?? null;
  } catch {
    return null;
  }
}

/**
 * Validates an expression's syntax without needing real data.
 *
 * For the badge editor, so a typo is reported while somebody is typing rather
 * than showing up later as a badge that silently never renders. The proxy
 * scope answers "yes" to every property so that an unknown name is not
 * mistaken for a syntax error.
 */
export function checkExprSyntax(expression: string): string | null {
  try {
    const everything = new Proxy<Scope>({}, { has: () => true, get: () => 0 });
    new Parser(expression, everything).parse();
    return null;
  } catch (error) {
    return (error as Error).message;
  }
}
