/**
 * Shuffles an array using the Fisher-Yates algorithm.
 * Returns a new shuffled array.
 */
export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

/**
 * Generates a Fair Rotation Sequence for a list of participant IDs using a Randomized Latin Square algorithm.
 * Guarantees that every participant occupies every queue position exactly once per macro-round,
 * with zero predictable patterns.
 * 
 * @param participantIds Array of participant ID strings
 * @returns Flattened 1D array of participant IDs of length N * N
 */
export function generateFairRotationSequence(participantIds: string[]): string[] {
  const N = participantIds.length;
  if (N === 0) {
    return [];
  }
  if (N === 1) {
    return [participantIds[0]];
  }

  // Step A: Base Matrix (linear shift: row i is shifted left by i places)
  const baseMatrix: string[][] = [];
  for (let i = 0; i < N; i++) {
    const row: string[] = [];
    for (let j = 0; j < N; j++) {
      row.push(participantIds[(i + j) % N]);
    }
    baseMatrix.push(row);
  }

  // Step B: Column Shuffling (same column permutation across all rows)
  const colIndices = shuffle(Array.from({ length: N }, (_, idx) => idx));
  const colShuffledMatrix: string[][] = baseMatrix.map(row =>
    colIndices.map(colIdx => row[colIdx])
  );

  // Step C: Row Shuffling
  const finalMatrix = shuffle(colShuffledMatrix);

  // Step D: Flattening to a 1D array of length N * N
  const flatSequence: string[] = [];
  for (const row of finalMatrix) {
    flatSequence.push(...row);
  }

  return flatSequence;
}
