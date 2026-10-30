import { generateTerrainChunk, terrainGenerator } from './terrainPayload.js';

let generator, generationSignature;

self.onmessage = ({ data: { id, signature, config, cx, cz } }) => {
  try {
    if (signature !== generationSignature) {
      generator = terrainGenerator(config);
      generationSignature = signature;
    }
    const chunk = generateTerrainChunk(config, cx, cz, generator);
    self.postMessage({ id, signature, chunk }, [chunk.data.buffer, chunk.surface.buffer, chunk.biomes.buffer]);
  } catch (error) {
    self.postMessage({ id, signature, error: error.message });
  }
};
