import {MiniMaple} from './miniMaple.js';

document.addEventListener('DOMContentLoaded', setup);

function setup() {
    document.getElementById('runBtn').onclick = run;
}

function run() {
    const expr = document.getElementById('expr').value.trim();
    const variable = document.getElementById('var').value.trim();
    const result = document.getElementById('result');
    result.classList.remove('error');

    if (!expr || !variable) {
        result.textContent = 'Please provide both an expression and a variable.';
        result.classList.add('error');
        return;
    }

    try {
        const maple = new MiniMaple();
        const derivative = maple.diff(expr, variable);
        result.textContent = derivative;
    } catch (e) {
        result.textContent = `Error: ${e.message}`;
        result.classList.add('error');
    }
}