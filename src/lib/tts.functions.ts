import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { enforceRateLimit } from "@/lib/security.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/audio/speech";

// تقسيم النص لقطع قصيرة تحترم حدود النموذج، مع تفضيل حدود الجُمل.
function chunkText(text: string, maxWords = 350): string[] {
  const wordCount = (s: string) => (s.match(/\S+/g) ?? []).length;
  const sentences = text.match(/[^.!?،؛\n]+[.!?،؛\n]*\s*/g) ?? [text];
  const chunks: string[] = [];
  let current = "";
  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };
  for (const sentence of sentences) {
    if (wordCount(sentence) > maxWords) {
      flush();
      const words = sentence.match(/\S+/g) ?? [];
      for (let i = 0; i < words.length; i += maxWords) {
        chunks.push(words.slice(i, i + maxWords).join(" "));
      }
      continue;
    }
    if (current && wordCount(current) + wordCount(sentence) > maxWords) flush();
    current += sentence;
  }
  flush();
  return chunks;
}

/* =========================================================
   تحويل النص إلى كلام بصوت طبيعي (زي شات جي بي تي)
   عبر بوابة Lovable AI — يرجّع مقاطع صوتية MP3 (base64)
   يشغّلها المتصفح بالتتابع.
========================================================= */
export const synthesizeSpeech = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      text: z.string().min(1).max(8000),
      voice: z.string().max(40).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("خدمة الصوت مش مهيّأة حاليًا.");

    // حد المعدل: 40 عملية قراءة كل 5 دقائق لكل مستخدم
    const okRate = await enforceRateLimit(`tts:${context.userId}`, 40, 300);
    if (!okRate) throw new Error("طلبت قراءة صوتية كتير في وقت قصير، استنى شوية.");

    const voice = data.voice || "alloy";
    const chunks = chunkText(data.text);
    const audio: string[] = [];

    for (const chunk of chunks) {
      const res = await fetch(GATEWAY, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini-tts",
          input: chunk,
          voice,
          response_format: "mp3",
          instructions:
            "Speak in warm, natural, friendly Egyptian Arabic like a real human tutor sitting next to the student. Clear and encouraging.",
        }),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        if (res.status === 429) throw new Error("الخدمة مزدحمة دلوقتي، جرّب بعد شوية.");
        if (res.status === 402) throw new Error("الرصيد خلص، كلّم الإدارة.");
        throw new Error(`فشل توليد الصوت [${res.status}] ${errBody.slice(0, 120)}`);
      }

      const buf = await res.arrayBuffer();
      audio.push(Buffer.from(buf).toString("base64"));
    }

    return { audio };
  });
