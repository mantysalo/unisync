import { describe, it, expect } from "vitest";
import {
  calculatePatchSize,
  divideToChunks,
  findDifferingChunks,
  generateInstructions,
  rebuildTargetFromOriginal,
} from "./algo.js";

import crypto from "node:crypto";
describe("algo", () => {
  describe("chunk split", () => {
    it("should split buffer into chunks", () => {
      const chunks = divideToChunks(Buffer.from("1234567890"), 3);
      expect(chunks).toEqual([Buffer.from("123"), Buffer.from("456"), Buffer.from("789"), Buffer.from("0")]);
    });
  });

  describe("chunk matching", () => {
    it("should return empty array if no chunks differ", () => {
      const original = Buffer.from("1234567890");
      const target = Buffer.from("1234567890");
      const differingChunks = findDifferingChunks(original, target, 1);
      expect(differingChunks).toEqual([]);
    });
    it("should return differing chunks", () => {
      const original = Buffer.from("1234567890");
      const target = Buffer.from("123456789XYZ");
      const differingChunks = findDifferingChunks(original, target, 1);
      expect(differingChunks).toEqual([Buffer.from("X"), Buffer.from("Y"), Buffer.from("Z")]);
    });
  });

  describe("patch generation", () => {
    it("should generate a patch, that when applied, results in the target data", () => {
      const generateRandomBuffer = (size: number): Buffer => {
        return crypto.randomBytes(size);
      };

      const generateLargeBuffers = (bufferSize: number, diffSize: number): [Buffer, Buffer] => {
        // Generate the original buffer
        const originalBuffer = generateRandomBuffer(bufferSize);

        // Generate a small differing buffer
        const diffBuffer = generateRandomBuffer(diffSize);

        // Choose a random position to insert the differing section
        const position = Math.floor(Math.random() * (bufferSize - diffSize));

        // Create the modified buffer by replacing bytes at the random position
        const modifiedBuffer = Buffer.from(originalBuffer);
        diffBuffer.copy(modifiedBuffer, position);

        return [originalBuffer, modifiedBuffer];
      };

      const calculatePatchSize = (instructions: (Buffer | number)[]): number => {
        let totalSize = 0;

        for (const instruction of instructions) {
          if (typeof instruction === "number") {
            // It's an index, so add 1 byte for index and 1 byte to indicate it's an index
            totalSize += 2;
          } else if (Buffer.isBuffer(instruction)) {
            // It's a Buffer, so add its length
            totalSize += instruction.length;
          }
        }

        return totalSize;
      };

      const [originalData, modifiedData] = generateLargeBuffers(1000000, 100);

      const chunkSizeBytes = 64; // You can experiment with different chunk sizes

      const instructions = generateInstructions(originalData, modifiedData, chunkSizeBytes);
      const rebuiltData = rebuildTargetFromOriginal(originalData, instructions, chunkSizeBytes);

      const patchSize = calculatePatchSize(instructions);

      expect(patchSize).toBeLessThan(modifiedData.length);

      expect(rebuiltData).toEqual(modifiedData);
    });
  });
});
