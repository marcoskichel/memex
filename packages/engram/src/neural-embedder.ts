const CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~ ';

export interface NeuralEmbedderOptions {
  vectorDim?: number;
  charEmbedDim?: number;
  hiddenDim?: number;
  maxSeqLen?: number;
}

const DEFAULT_VECTOR_DIM = 128;
const DEFAULT_CHAR_EMBED_DIM = 16;
const DEFAULT_HIDDEN_DIM = 64;
const DEFAULT_MAX_SEQ_LEN = 100;
const WEIGHT_INIT_SCALE = 0.1;

function randomMatrix(rows: number, cols: number): Float32Array {
  const matrix = new Float32Array(rows * cols);
  for (let index = 0; index < matrix.length; index++) {
    matrix[index] = (Math.random() * 2 - 1) * WEIGHT_INIT_SCALE;
  }
  return matrix;
}

function relu(value: number): number {
  return Math.max(0, value);
}

export class NeuralEmbedder {
  private readonly charVocab: Map<string, number>;
  private readonly vocabSize: number;
  readonly vectorDim: number;
  private readonly charEmbedDim: number;
  private readonly hiddenDim: number;
  readonly maxSeqLen: number;

  private readonly embeddingWeights: Float32Array;
  private readonly fc1Weights: Float32Array;
  private readonly fc1Bias: Float32Array;
  private readonly fc2Weights: Float32Array;
  private readonly fc2Bias: Float32Array;

  constructor(options: NeuralEmbedderOptions = {}) {
    this.vectorDim = options.vectorDim ?? DEFAULT_VECTOR_DIM;
    this.charEmbedDim = options.charEmbedDim ?? DEFAULT_CHAR_EMBED_DIM;
    this.hiddenDim = options.hiddenDim ?? DEFAULT_HIDDEN_DIM;
    this.maxSeqLen = options.maxSeqLen ?? DEFAULT_MAX_SEQ_LEN;

    this.charVocab = new Map();
    for (let index = 0; index < CHARS.length; index++) {
      const char = CHARS[index];
      if (char !== undefined) {
        this.charVocab.set(char, index + 1);
      }
    }
    this.vocabSize = this.charVocab.size + 1;

    this.embeddingWeights = randomMatrix(this.vocabSize, this.charEmbedDim);
    this.fc1Weights = randomMatrix(this.charEmbedDim, this.hiddenDim);
    this.fc1Bias = new Float32Array(this.hiddenDim);
    this.fc2Weights = randomMatrix(this.hiddenDim, this.vectorDim);
    this.fc2Bias = new Float32Array(this.vectorDim);
  }

  charIndex(char: string): number {
    return this.charVocab.get(char) ?? 0;
  }

  tokenize(text: string): number[] {
    const lower = text.toLowerCase();
    const indices: number[] = [];
    for (let index = 0; index < this.maxSeqLen; index++) {
      const char = lower[index];
      indices.push(char === undefined ? 0 : this.charIndex(char));
    }
    return indices;
  }

  embed(text: string): Float32Array {
    const indices = this.tokenize(text);

    const pooled = new Float32Array(this.charEmbedDim);
    for (const charIndex of indices) {
      const offset = charIndex * this.charEmbedDim;
      for (let col = 0; col < this.charEmbedDim; col++) {
        pooled[col] = (pooled[col] ?? 0) + (this.embeddingWeights[offset + col] ?? 0);
      }
    }
    for (let col = 0; col < this.charEmbedDim; col++) {
      pooled[col] = (pooled[col] ?? 0) / this.maxSeqLen;
    }

    const hidden = new Float32Array(this.hiddenDim);
    for (let out = 0; out < this.hiddenDim; out++) {
      let sum = this.fc1Bias[out] ?? 0;
      for (let inp = 0; inp < this.charEmbedDim; inp++) {
        sum += (pooled[inp] ?? 0) * (this.fc1Weights[inp * this.hiddenDim + out] ?? 0);
      }
      hidden[out] = relu(sum);
    }

    const output = new Float32Array(this.vectorDim);
    for (let out = 0; out < this.vectorDim; out++) {
      let sum = this.fc2Bias[out] ?? 0;
      for (let inp = 0; inp < this.hiddenDim; inp++) {
        sum += (hidden[inp] ?? 0) * (this.fc2Weights[inp * this.vectorDim + out] ?? 0);
      }
      output[out] = sum;
    }

    return output;
  }
}
