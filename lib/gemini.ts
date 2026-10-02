import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, streamText } from "ai";

// @ai-sdk/google v4 soporta thoughtSignature nativo: ya no hace falta el
// middleware de este archivo (visto en la migración 2026-08-30) que atrapaba
// los turnos rotos después de una tool call en la versión 0.0.x del SDK.
export const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// Modelos Gemini de respaldo si el configurado en el cliente falla (clave
// inválida, cuota, o el propio Google deprecando un modelo de un día para
// otro — lo que tumbó el chat de sb-barberia-studio el 2026-08-28). Se
// intentan en orden hasta que uno responda; todos comparten el mismo
// GEMINI_API_KEY, así que no requiere configurar nada nuevo por cliente.
const FALLBACK_MODELS = ["gemini-3.5-flash-lite", "gemini-2.5-flash", "gemini-flash-latest"];

function candidateModels(primaryModelId: string): string[] {
  return [primaryModelId, ...FALLBACK_MODELS.filter((m) => m !== primaryModelId)];
}

// A diferencia de ai v3, en v7 streamText() ya NUNCA rechaza la promesa por un
// error de la API (404 de modelo muerto incluido) — el error llega DENTRO del
// stream ya iniciado (visto en vivo en la migración 2026-08-30: probar el
// siguiente candidato ahí adentro rompería el streaming a mitad de camino).
// Por eso el candidato se confirma ANTES, con un ping barato de generateText
// (1 token de salida, sin tools) que si falla SÍ rechaza igual que antes.
// Cacheado por instancia serverless: solo paga el ping extra el primer
// request de cada instancia fría, no cada mensaje.
const workingModelCache = new Map<string, string>();

async function resolveWorkingModel(primaryModelId: string): Promise<string> {
  const cached = workingModelCache.get(primaryModelId);
  if (cached) return cached;

  let lastError: unknown;
  for (const modelId of candidateModels(primaryModelId)) {
    try {
      await generateText({ model: google(modelId), prompt: "ping", maxOutputTokens: 1 });
      workingModelCache.set(primaryModelId, modelId);
      return modelId;
    } catch (error) {
      lastError = error;
      console.error(`[gemini] modelo "${modelId}" no disponible, probando siguiente candidato:`, error);
    }
  }
  throw lastError;
}

export async function streamTextWithFallback(
  primaryModelId: string,
  options: Omit<Parameters<typeof streamText>[0], "model">
): Promise<ReturnType<typeof streamText>> {
  const modelId = await resolveWorkingModel(primaryModelId);
  return streamText({ ...options, model: google(modelId) } as Parameters<typeof streamText>[0]);
}

export async function generateTextWithFallback(
  primaryModelId: string,
  options: Omit<Parameters<typeof generateText>[0], "model">
): Promise<ReturnType<typeof generateText>> {
  const modelId = await resolveWorkingModel(primaryModelId);
  return generateText({ ...options, model: google(modelId) } as Parameters<typeof generateText>[0]);
}
