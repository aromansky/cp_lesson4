class MiniMaple {
    diff(expression, variable) {
        if (typeof expression !== 'string' || typeof variable !== 'string') {
            throw new Error('Expression and variable must be strings');
        }
        if (/[^0-9a-zA-Z+\-*^()\s]/.test(expression)) {
            throw new Error(`Unsupported character in expression: ${expression}`);
        }
        if (!/^[a-zA-Z]+$/.test(variable)) {
            throw new Error(`Invalid variable name: ${variable}`);
        }

        const parser = new Parser(expression, variable);
        const node = parser.parse();

        parser.expectEnd();

        return node.derivative(variable).simplify().toString();
    }
}


class Tokenizer {
    constructor(input, variable) {
        this.input = input;
        this.variable = variable;
        this.pos = 0;
    }

    peek() {
        this._skipWhitespace();
        if (this.pos >= this.input.length) return null;
        return this.input[this.pos];
    }

    next() {
        this._skipWhitespace();
        if (this.pos >= this.input.length) return null;
        const ch = this.input[this.pos];

        if (/[0-9]/.test(ch)) {
            let num = '';
            while (this.pos < this.input.length && /[0-9]/.test(this.input[this.pos])) {
                num += this.input[this.pos++];
            }
            return {type: 'num', value: parseInt(num, 10)};
        }

        if (/[a-zA-Z]/.test(ch)) {
            let name = '';
            while (this.pos < this.input.length && /[a-zA-Z]/.test(this.input[this.pos])) {
                name += this.input[this.pos++];
            }
            if (name.length > 1) {
                throw new Error(`Unsupported function or identifier: ${name}`);
            }
            return {type: 'var', value: name};
        }

        if ('+-*^()'.includes(ch)) {
            this.pos++;
            return {type: 'op', value: ch};
        }

        throw new Error(`Unexpected character: ${ch}`);
    }

    _skipWhitespace() {
        while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
            this.pos++;
        }
    }
}

class Parser {
    constructor(input, variable) {
        this.tok = new Tokenizer(input, variable);
        this.variable = variable;
        this.current = this.tok.next();
    }

    parse() {
        if (this.current === null) {
            throw new Error('Empty expression');
        }
        return this.parseExpr();
    }

    expectEnd() {
        if (this.current !== null) {
            throw new Error(`Unexpected token: ${JSON.stringify(this.current)}`);
        }
    }

    parseExpr() {
        let left = this.parseTerm();
        while (this.current && this.current.type === 'op'
               && (this.current.value === '+' || this.current.value === '-')) {
            const op = this.current.value;
            this.advance();
            const right = this.parseTerm();
            left = new BinOp(op, left, right);
        }
        return left;
    }

    parseTerm() {
        let left = this.parsePower();
        while (this.current && this.current.type === 'op' && this.current.value === '*') {
            this.advance();
            const right = this.parsePower();
            left = new BinOp('*', left, right);
        }
        return left;
    }

    parsePower() {
        let left = this.parseUnary();
        while (this.current && this.current.type === 'op' && this.current.value === '^') {
            this.advance();
            const right = this.parseUnary();
            left = new BinOp('^', left, right);
        }
        return left;
    }

    parseUnary() {
        if (this.current && this.current.type === 'op' && this.current.value === '-') {
            this.advance();
            return new Neg(this.parseUnary());
        }
        if (this.current && this.current.type === 'op' && this.current.value === '+') {
            this.advance();
            return this.parseUnary();
        }
        return this.parsePrimary();
    }

    parsePrimary() {
        if (this.current === null) {
            throw new Error('Unexpected end of expression');
        }
        if (this.current.type === 'num') {
            const v = this.current.value;
            this.advance();
            return new Num(v);
        }
        if (this.current.type === 'var') {
            const v = this.current.value;
            this.advance();
            return new Var(v);
        }
        if (this.current.type === 'op' && this.current.value === '(') {
            this.advance();
            const inner = this.parseExpr();
            if (!(this.current && this.current.type === 'op' && this.current.value === ')')) {
                throw new Error('Expected closing parenthesis');
            }
            this.advance();
            return inner;
        }
        throw new Error(`Unexpected token: ${JSON.stringify(this.current)}`);
    }

    advance() {
        this.current = this.tok.next();
    }
}

class Num {
    constructor(value) { this.value = value; }
    derivative() { return new Num(0); }
    simplify() { return this; }
    toString() { return String(this.value); }
}

class Var {
    constructor(name) { this.name = name; }
    derivative(v) {
        return this.name === v ? new Num(1) : new Num(0);
    }
    simplify() { return this; }
    toString() { return this.name; }
}

class Neg {
    constructor(inner) { this.inner = inner; }
    derivative(v) { return new Neg(this.inner.derivative(v)); }
    simplify() {
        const s = this.inner.simplify();
        if (s instanceof Num) return new Num(-s.value);
        if (s instanceof Neg) return s.inner;
        return new Neg(s);
    }
    toString() { return `-${this.inner}`; }
}

class BinOp {
    constructor(op, left, right) {
        this.op = op;
        this.left = left;
        this.right = right;
    }

    derivative(v) {
        const {op, left, right} = this;

        if (op === '+' || op === '-') {
            return new BinOp(op, left.derivative(v), right.derivative(v));
        }

        if (op === '*') {
            // (uv)' = u'v + uv'
            return new BinOp(
                '+',
                new BinOp('*', left.derivative(v), right),
                new BinOp('*', left, right.derivative(v))
            );
        }

        if (op === '^') {
            if (!(right instanceof Num)) {
                throw new Error('Only integer constant exponents are supported');
            }
            const n = right.value;
            if (!Number.isInteger(n)) {
                throw new Error('Exponent must be an integer');
            }
            if (n === 0) return new Num(0);
            const nMinus1 = new Num(n - 1);
            return new BinOp(
                '*',
                new BinOp('*', new Num(n),
                    new BinOp('^', left, nMinus1)),
                left.derivative(v)
            );
        }

        throw new Error(`Unsupported operator: ${op}`);
    }

    simplify() {
        const l = this.left.simplify();
        const r = this.right.simplify();
        const {op} = this;

        const lNum = l instanceof Num;
        const rNum = r instanceof Num;

        if (op === '+') {
            if (lNum && rNum) return new Num(l.value + r.value);
            if (lNum && l.value === 0) return r;
            if (rNum && r.value === 0) return l;
            return new BinOp('+', l, r);
        }

        if (op === '-') {
            if (lNum && rNum) return new Num(l.value - r.value);
            if (rNum && r.value === 0) return l;
            if (lNum && l.value === 0) return new Neg(r);
            return new BinOp('-', l, r);
        }

        if (op === '*') {
            if (lNum && rNum) return new Num(l.value * r.value);
            if ((lNum && l.value === 0) || (rNum && r.value === 0)) return new Num(0);
            if (lNum && l.value === 1) return r;
            if (rNum && r.value === 1) return l;

            const flat = BinOp._flattenMul(l, r);
            if (flat.coef !== 1) {
                if (flat.coef === 0) return new Num(0);
                if (flat.rest.length === 0) return new Num(flat.coef);

                const restExpr = flat.rest.reduce(
                    (acc, cur) => (acc === null ? cur : new BinOp('*', acc, cur)),
                    null
                );
                if (flat.coef === 1) return restExpr;
                return new BinOp('*', new Num(flat.coef), restExpr);
            }
            if (flat.rest.length === 0) return new Num(1);
            const restExpr = flat.rest.reduce(
                (acc, cur) => (acc === null ? cur : new BinOp('*', acc, cur)),
                null
            );
            return restExpr;
        }

        if (op === '^') {
            if (lNum && rNum) return new Num(Math.pow(l.value, r.value));
            if (rNum && r.value === 0) return new Num(1);
            if (rNum && r.value === 1) return l;
            // x^n^n is left-assoc; keep as-is
            return new BinOp('^', l, r);
        }

        throw new Error(`Unsupported operator: ${op}`);
    }

    toString() {
        return `${this.left}${this.op}${this.right}`;
    }

    static _flattenMul(left, right) {
        const collect = (node, out) => {
            if (node instanceof BinOp && node.op === '*') {
                collect(node.left, out);
                collect(node.right, out);
            } else {
                out.push(node);
            }
        };
        const nodes = [];
        collect(left, nodes);
        collect(right, nodes);

        let coef = 1;
        const rest = [];
        for (const n of nodes) {
            if (n instanceof Num) {
                coef *= n.value;
            } else if (n instanceof Neg) {
                coef *= -1;
                rest.push(n.inner);
            } else {
                rest.push(n);
            }
        }
        return {coef, rest};
    }
}

export {MiniMaple};