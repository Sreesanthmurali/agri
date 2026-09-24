import { pipeline, env, RawImage } from '@huggingface/transformers';

// Disallow local models so it fetches directly from HuggingFace Hub and caches in browser
env.allowLocalModels = false;

let segmenterInstance = null;
let isInitializing = false;
let initWaiters = [];

/**
 * Initialize RMBG-1.4 model pipeline with WebGPU acceleration (or WASM fallback).
 */
export async function initMattingEngine(onProgress = null) {
  if (segmenterInstance) return segmenterInstance;
  if (isInitializing) {
    return new Promise((resolve, reject) => {
      initWaiters.push({ resolve, reject });
    });
  }

  isInitializing = true;
  try {
    try {
      segmenterInstance = await pipeline('image-segmentation', 'briaai/RMBG-1.4', {
        device: 'webgpu',
        progress_callback: onProgress,
      });
      console.log('[MIT ID Studio] AI Matting initialized with WebGPU acceleration.');
    } catch (gpuErr) {
      console.warn('[MIT ID Studio] WebGPU fallback to WebAssembly (WASM):', gpuErr);
      segmenterInstance = await pipeline('image-segmentation', 'briaai/RMBG-1.4', {
        device: 'wasm',
        progress_callback: onProgress,
      });
      console.log('[MIT ID Studio] AI Matting initialized with WebAssembly.');
    }

    initWaiters.forEach(({ resolve }) => resolve(segmenterInstance));
    initWaiters = [];
    return segmenterInstance;
  } catch (err) {
    initWaiters.forEach(({ reject }) => reject(err));
    initWaiters = [];
    isInitializing = false;
    throw err;
  }
}

/**
 * Perform background removal on a File or Blob.
 * Returns an HTMLCanvasElement containing the full uncropped RGBA cutout.
 */
export async function removeBackgroundClient(imageFile, onProgress = null) {
  const segmenter = await initMattingEngine(onProgress);
  const rawImage = await RawImage.fromBlob(imageFile);
  const output = await segmenter(rawImage);
  const cutout = Array.isArray(output) ? output[0] : output;
  return cutout.toCanvas();
}
