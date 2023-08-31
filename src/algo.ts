import adler32 from "adler-32";
import crypto from "crypto";
import fs from "node:fs";

// Divide buffer into fixed size chunks
export const divideToChunks = (file: Buffer, chunkSizeBytes: number): Buffer[] => {
  const chunks: Buffer[] = [];
  for (let i = 0; i < file.length; i += chunkSizeBytes) {
    chunks.push(file.subarray(i, i + chunkSizeBytes));
  }
  return chunks;
};

// Calculate weak checksum (Adler-32)
const calculateWeakBlockChecksum = (buffer: Buffer): number => {
  return adler32.buf(buffer);
};

// Calculate strong checksum (SHA-1)
const calculateStrongBlockChecksum = (buffer: Buffer): string => {
  const hash = crypto.createHash("sha1");
  hash.update(buffer);
  return hash.digest("hex");
};

export const findDifferingChunks = (originalData: Buffer, targetData: Buffer, chunkSizeBytes: number): Buffer[] => {
  const originalChunks = divideToChunks(originalData, chunkSizeBytes);
  const checksumMap = new Map<number, { index: number; strong: string }>();

  // Calculate weak and strong checksums for original chunks and put them in a map
  originalChunks.forEach((chunk, index) => {
    const weak = calculateWeakBlockChecksum(chunk);
    const strong = calculateStrongBlockChecksum(chunk);
    checksumMap.set(weak, { index, strong });
  });

  const differingChunks: Buffer[] = [];
  let targetPosition = 0;
  let windowBuffer = targetData.subarray(targetPosition, targetPosition + chunkSizeBytes);

  // Sliding window through the target data
  while (targetPosition <= targetData.length - chunkSizeBytes) {
    const weak = calculateWeakBlockChecksum(windowBuffer);
    const strong = calculateStrongBlockChecksum(windowBuffer);

    if (checksumMap.has(weak)) {
      const originalChecksum = checksumMap.get(weak)!;
      if (originalChecksum.strong === strong) {
        // Chunk matches, so move the window forward by the chunk size
        targetPosition += chunkSizeBytes;
        windowBuffer = targetData.subarray(targetPosition, targetPosition + chunkSizeBytes);
        continue;
      }
    }

    // Chunk differs, so add it to differingChunks and move window forward by 1 byte
    differingChunks.push(windowBuffer.subarray(0, chunkSizeBytes));
    targetPosition += 1;
    windowBuffer = targetData.subarray(targetPosition, targetPosition + chunkSizeBytes);
  }

  return differingChunks;
};

export const generateInstructions = (
  originalData: Buffer,
  targetData: Buffer,
  chunkSizeBytes: number
): (Buffer | number)[] => {
  const originalChunks = divideToChunks(originalData, chunkSizeBytes);
  const checksumMap = new Map<number, { index: number; strong: string }>();
  const instructions: (Buffer | number)[] = [];

  originalChunks.forEach((chunk, index) => {
    const weak = calculateWeakBlockChecksum(chunk);
    const strong = calculateStrongBlockChecksum(chunk);
    checksumMap.set(weak, { index, strong });
  });

  let targetPosition = 0;
  let differingBuffer: Buffer[] = [];

  while (targetPosition < targetData.length) {
    if (targetPosition <= targetData.length - chunkSizeBytes) {
      const windowBuffer = targetData.subarray(targetPosition, targetPosition + chunkSizeBytes);
      const weak = calculateWeakBlockChecksum(windowBuffer);
      const strong = calculateStrongBlockChecksum(windowBuffer);

      if (checksumMap.has(weak)) {
        const originalChecksum = checksumMap.get(weak)!;
        if (originalChecksum.strong === strong) {
          // If there are any differing bytes, add them first
          if (differingBuffer.length > 0) {
            instructions.push(Buffer.concat(differingBuffer));
            differingBuffer = [];
          }

          // Add index of the original chunk to instructions
          instructions.push(originalChecksum.index);

          // Move the window forward by the chunk size
          targetPosition += chunkSizeBytes;
          continue;
        }
      }
    }

    // Add differing byte to differingBuffer
    differingBuffer.push(targetData.subarray(targetPosition, targetPosition + 1));

    // Move window forward by 1 byte
    targetPosition += 1;
  }

  // Add any remaining differing bytes
  if (differingBuffer.length > 0) {
    instructions.push(Buffer.concat(differingBuffer));
  }

  console.log("Instructions:", instructions);
  return instructions;
};

export const rebuildTargetFromOriginal = (
  originalData: Buffer,
  instructions: (Buffer | number)[],
  chunkSizeBytes: number
): Buffer => {
  const rebuiltChunks: Buffer[] = [];
  const originalChunks = divideToChunks(originalData, chunkSizeBytes);

  instructions.forEach((instruction) => {
    if (typeof instruction === "number") {
      rebuiltChunks.push(originalChunks[instruction]);
    } else {
      rebuiltChunks.push(instruction);
    }
  });

  return Buffer.concat(rebuiltChunks);
};
