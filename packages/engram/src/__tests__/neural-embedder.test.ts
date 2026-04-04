import { describe, expect, it } from 'vitest';

import { NeuralEmbedder } from '../neural-embedder.js';

describe('NeuralEmbedder', () => {
  it('maps a known character to a positive index', () => {
    const embedder = new NeuralEmbedder();
    expect(embedder.charIndex('a')).toBeGreaterThan(0);
    expect(embedder.charIndex('0')).toBeGreaterThan(0);
    expect(embedder.charIndex(' ')).toBeGreaterThan(0);
  });

  it('maps unknown character to padding index 0', () => {
    const embedder = new NeuralEmbedder();
    expect(embedder.charIndex('\u0000')).toBe(0);
    expect(embedder.charIndex('Ä')).toBe(0);
  });

  it('pads short text to maxSeqLen', () => {
    const embedder = new NeuralEmbedder({ maxSeqLen: 10 });
    const tokens = embedder.tokenize('hi');
    expect(tokens).toHaveLength(10);
    expect(tokens[2]).toBe(0);
    expect(tokens[9]).toBe(0);
  });

  it('truncates long text to maxSeqLen', () => {
    const embedder = new NeuralEmbedder({ maxSeqLen: 5 });
    const tokens = embedder.tokenize('abcdefghij');
    expect(tokens).toHaveLength(5);
  });

  it('produces embedding of correct dimension', () => {
    const embedder = new NeuralEmbedder({ vectorDim: 32 });
    const result = embedder.embed('hello world');
    expect(result).toHaveLength(32);
  });

  it('produces same embedding for same input (deterministic weights)', () => {
    const embedder = new NeuralEmbedder({ vectorDim: 16 });
    const first = embedder.embed('test input');
    const second = embedder.embed('test input');
    expect(first).toEqual(second);
  });

  it('defaults produce 128-dim embedding', () => {
    const embedder = new NeuralEmbedder();
    expect(embedder.embed('any text')).toHaveLength(128);
  });
});
