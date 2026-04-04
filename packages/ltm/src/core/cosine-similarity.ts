export function cosineSimilarity(first: Float32Array, second: Float32Array): number {
  if (first.length !== second.length) {
    return 0;
  }
  let dot = 0;
  let normFirst = 0;
  let normSecond = 0;
  for (const [index, value] of first.entries()) {
    const secondValue = second[index] ?? 0;
    dot += value * secondValue;
    normFirst += value * value;
    normSecond += secondValue * secondValue;
  }
  const denom = Math.sqrt(normFirst) * Math.sqrt(normSecond);
  if (denom === 0) {
    return 0;
  }
  return dot / denom;
}
