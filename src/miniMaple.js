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
        while (
            this.current &&
            this.current.type === 'op' &&
            (this.current.value === '+' || this.current.value === '-')
        ) {
            const op = this.current.value;
            this.advance();
            const right = this.parseTerm();
            left = new BinOp(op, left, right);
        }
        return left;
    }

    parseTerm() {
        let left = this.parseUnary();
        while (this.current && this.current.type === 'op' && this.current.value === '*') {
            this.advance();
            const right = this.parseUnary();
            left = new BinOp('*', left, right);
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
        return this.parsePower();
    }

    parsePower() {
        let left = this.parsePrimary();
        if (this.current && this.current.type === 'op' && this.current.value === '^') {
            this.advance();
            const right = this.parseUnary();
            left = new BinOp('^', left, right);
        }
        return left;
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
    constructor(value) {
        this.value = value;
    }

    derivative() {
        return new Num(0);
    }

    simplify() {
        return this;
    }

    getPrecedence() {
        return 5;
    }

    toString() {
        return String(this.value);
    }
}

class Var {
    constructor(name) {
        this.name = name;
    }

    derivative(v) {
        return this.name === v ? new Num(1) : new Num(0);
    }

    simplify() {
        return this;
    }

    getPrecedence() {
        return 5;
    }

    toString() {
        return this.name;
    }
}

class Neg {
    constructor(inner) {
        this.inner = inner;
    }

    derivative(v) {
        return new Neg(this.inner.derivative(v));
    }

    simplify() {
        const s = this.inner.simplify();

        if (s instanceof Num) return new Num(-s.value);
        if (s instanceof Neg) return s.inner;

        if (s instanceof BinOp && s.op === '*') {
            return new BinOp('*', new Num(-1), s).simplify();
        }

        return new Neg(s);
    }

    getPrecedence() {
        return 3;
    }

    toString() {
        const inner = formatNode(this.inner, this.getPrecedence(), false, 'neg');
        return `-${inner}`;
    }
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
            return new BinOp(
                '+',
                new BinOp('*', left.derivative(v), right),
                new BinOp('*', left, right.derivative(v))
            );
        }

        if (op === '^') {
            const exp = right.simplify();

            if (!(exp instanceof Num) || !Number.isInteger(exp.value)) {
                throw new Error('Only integer constant exponents are supported');
            }

            const n = exp.value;
            if (n === 0) return new Num(0);

            const nMinus1 = new Num(n - 1);

            return new BinOp(
                '*',
                new BinOp(
                    '*',
                    new Num(n),
                    new BinOp('^', left, nMinus1)
                ),
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

            if (r instanceof Neg) return new BinOp('-', l, r.inner).simplify();
            if (l instanceof Neg) return new BinOp('-', r, l.inner).simplify();

            const lb = BinOp._coefBase(l);
            const rb = BinOp._coefBase(r);

            if (lb.base && rb.base && BinOp._same(lb.base, rb.base)) {
                const c = lb.coef + rb.coef;
                if (c === 0) return new Num(0);
                if (c === 1) return lb.base;
                if (c === -1) return new Neg(lb.base).simplify();
                return new BinOp('*', new Num(c), lb.base).simplify();
            }

            return new BinOp('+', l, r);
        }

        if (op === '-') {
            if (lNum && rNum) return new Num(l.value - r.value);
            if (rNum && r.value === 0) return l;
            if (lNum && l.value === 0) return new Neg(r).simplify();

            if (r instanceof Neg) return new BinOp('+', l, r.inner).simplify();

            const lb = BinOp._coefBase(l);
            const rb = BinOp._coefBase(r);

            if (lb.base && rb.base && BinOp._same(lb.base, rb.base)) {
                const c = lb.coef - rb.coef;
                if (c === 0) return new Num(0);
                if (c === 1) return lb.base;
                if (c === -1) return new Neg(lb.base).simplify();
                return new BinOp('*', new Num(c), lb.base).simplify();
            }

            return new BinOp('-', l, r);
        }

        if (op === '*') {
            if (lNum && rNum) return new Num(l.value * r.value);
            if ((lNum && l.value === 0) || (rNum && r.value === 0)) return new Num(0);
            if (lNum && l.value === 1) return r;
            if (rNum && r.value === 1) return l;

            const flat = BinOp._flattenMul(l, r);

            if (flat.coef === 0) return new Num(0);
            if (flat.rest.length === 0) return new Num(flat.coef);

            const restExpr = flat.rest.reduce(
                (acc, cur) => (acc === null ? cur : new BinOp('*', acc, cur)),
                null
            );

            if (flat.coef === 1) return restExpr;
            if (flat.coef === -1) return new Neg(restExpr);
            return new BinOp('*', new Num(flat.coef), restExpr);
        }

        if (op === '^') {
            if (lNum && rNum) return new Num(Math.pow(l.value, r.value));
            if (rNum && r.value === 0) return new Num(1);
            if (rNum && r.value === 1) return l;
            return new BinOp('^', l, r);
        }

        throw new Error(`Unsupported operator: ${op}`);
    }

    getPrecedence() {
        return {
            '+': 1,
            '-': 1,
            '*': 2,
            '^': 4
        }[this.op];
    }

    toString() {
        const prec = this.getPrecedence();
        const left = formatNode(this.left, prec, false, this.op);
        const right = formatNode(this.right, prec, true, this.op);
        return `${left}${this.op}${right}`;
    }

    static _same(a, b) {
        return a.toString() === b.toString();
    }

    static _coefBase(node) {
        if (node instanceof Num) {
            return {coef: node.value, base: null};
        }

        if (node instanceof Neg) {
            const cb = BinOp._coefBase(node.inner);
            return {coef: -cb.coef, base: cb.base};
        }

        if (node instanceof BinOp && node.op === '*') {
            if (node.left instanceof Num) {
                return {coef: node.left.value, base: node.right};
            }
            if (node.right instanceof Num) {
                return {coef: node.right.value, base: node.left};
            }
        }

        return {coef: 1, base: node};
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

function formatNode(node, parentPrec, isRight, parentOp) {
    const nodePrec = node.getPrecedence ? node.getPrecedence() : 5;
    let needParen = false;

    if (nodePrec < parentPrec) {
        needParen = true;
    } else if (nodePrec === parentPrec) {
        if (parentOp === '-' && isRight) {
            needParen = true;
        } else if (parentOp === '^' && !isRight) {
            needParen = true;
        }
    }

    // x^-2 можно печатать без скобок
    if (node instanceof Neg && parentOp === '^' && isRight) {
        needParen = false;
    }

    const str = node.toString();
    return needParen ? `(${str})` : str;
}

export {MiniMaple};