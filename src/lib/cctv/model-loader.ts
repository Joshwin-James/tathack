// Client-side singleton loader for TensorFlow.js and COCO-SSD

let modelPromise: Promise<any> | null = null;
let cachedModel: any = null;

export async function loadCocoSsdModel(
  onProgress?: (status: string) => void
): Promise<any> {
  if (typeof window === "undefined") return null;
  if (cachedModel) return cachedModel;
  if (modelPromise) return modelPromise;

  modelPromise = (async () => {
    try {
      onProgress?.("Initializing TensorFlow WebGL backend...");
      const tf = await import("@tensorflow/tfjs");
      
      try {
        await tf.setBackend("webgl");
        await tf.ready();
      } catch (backendErr) {
        console.warn("WebGL initialization failed, falling back to CPU backend:", backendErr);
        await tf.setBackend("cpu");
        await tf.ready();
      }

      onProgress?.("Loading MobileNet-V2 Object Detector...");
      const cocoSsd = await import("@tensorflow-models/coco-ssd");
      const model = await cocoSsd.load({
        base: "lite_mobilenet_v2",
      });

      cachedModel = model;
      onProgress?.("AI Vision Ready");
      return model;
    } catch (err) {
      console.error("Failed to load TensorFlow COCO-SSD model:", err);
      modelPromise = null;
      throw err;
    }
  })();

  return modelPromise;
}

export function isModelLoaded(): boolean {
  return cachedModel !== null;
}
