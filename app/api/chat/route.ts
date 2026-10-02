import { convertToModelMessages, stepCountIs, type UIMessage } from "ai";
import { streamTextWithFallback } from "@/lib/gemini";
import { clientConfig } from "@/config/client.config";
import { buildSystemPrompt } from "@/lib/assistant-prompt";
import { buildAgendaTools } from "@/lib/chat-tools";
import { buildLeadTools } from "@/lib/lead-tools";
import { buildStoreTools } from "@/lib/store-tools";
import { buildMandagroupTools } from "@/lib/mandagroup-tools";
import { logChat } from "@/lib/chat-log";
import { checkRateLimit } from "@/lib/rate-limit";

// nodejs (no edge): las tools de la agenda escriben en el mismo store en
// memoria (globalThis) que usan /api/agenda y el panel — edge usa otro isolate
// y las reservas creadas por el chat no se verían.
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return new Response(
      JSON.stringify({ error: "El chat no está configurado todavía (falta GEMINI_API_KEY)." }),
      { status: 501, headers: { "Content-Type": "application/json" } }
    );
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const { allowed, retryAfterSeconds } = checkRateLimit(ip);

  if (!allowed) {
    return new Response(
      JSON.stringify({ error: "Demasiadas solicitudes. Intenta de nuevo en unos minutos." }),
      {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": String(retryAfterSeconds) },
      }
    );
  }

  const { messages }: { messages: UIMessage[] } = await req.json();
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const userText = lastUser?.parts.find((p) => p.type === "text")?.text;

  try {
    const result = await streamTextWithFallback(clientConfig.chat.model, {
      system: buildSystemPrompt(),
      messages: await convertToModelMessages(messages),
      maxOutputTokens: clientConfig.chat.maxTokensPerReply,
      // Tools conversacionales según módulos activos: agenda (reservar), leads
      // inmobiliarios (registrar interesado) y tienda (pedido + link Webpay).
      tools: { ...buildAgendaTools(), ...buildLeadTools(), ...buildStoreTools(), ...buildMandagroupTools("web", userText) },
      stopWhen: stepCountIs(5),
      // Registro para el resumen diario al dueño (/api/resumen).
      onFinish({ text }) {
        if (userText && text) {
          logChat({ canal: "web", userText, assistantText: text });
        }
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (err) {
    console.error("Chat error:", err);
    return new Response(
      JSON.stringify({
        error: `El chat no está disponible en este momento. Escríbenos por WhatsApp${
          clientConfig.contact.whatsapp ? ` al ${clientConfig.contact.whatsapp}` : ""
        }.`,
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}
