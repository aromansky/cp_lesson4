import {MiniMaple} from "../src/miniMaple";

describe('MiniMaple.diff', () => {
    let m;
    beforeEach(() => { m = new MiniMaple(); });

    test('power rule with coefficient', () => {
        expect(m.diff('4*x^3', 'x')).toBe('12*x^2');
    });

    test('different variable -> 0', () => {
        expect(m.diff('4*x^3', 'y')).toBe('0');
    });

    test('polynomial with subtraction', () => {
        expect(m.diff('4*x^3-x^2', 'x')).toBe('12*x^2-2*x');
    });

    // === Constants and identity ===
    test('constant -> 0', () => {
        expect(m.diff('5', 'x')).toBe('0');
    });

    test('x -> 1', () => {
        expect(m.diff('x', 'x')).toBe('1');
    });

    test('y -> 0 (w.r.t x)', () => {
        expect(m.diff('y', 'x')).toBe('0');
    });

    test('coefficient * variable', () => {
        expect(m.diff('3*x', 'x')).toBe('3');
    });

    test('product rule: x*x -> 2*x', () => {
        expect(m.diff('x*x', 'x')).toBe('2*x');
    });

    test('product rule: x^2*x^3 -> 5*x^4', () => {
        expect(m.diff('x^2*x^3', 'x')).toBe('5*x^4');
    });

    test('sum of two terms', () => {
        expect(m.diff('x^2+x', 'x')).toBe('2*x+1');
    });

    test('x^2*y -> 2*x*y', () => {
        expect(m.diff('x^2*y', 'x')).toBe('2*x*y');
    });

    test('unsupported operator /', () => {
        expect(() => m.diff('x/y', 'x')).toThrow();
    });

    test('unsupported function sin(x)', () => {
        expect(() => m.diff('sin(x)', 'x')).toThrow();
    });

    test('invalid character', () => {
        expect(() => m.diff('x@y', 'x')).toThrow();
    });
});