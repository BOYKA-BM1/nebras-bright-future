import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/audio/speech";

// نقطة بث الصوت: تتحقق من هوية الطالب ثم تمرّر بث SSE (PCM) من بوابة الذكاء
// الاصطناعي مباشرةً للمتصفح عشان الصوت يبدأ فورًا مع ظهور الرد.
export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        const apiKey = process.env.LOVABLE_API_KEY;

        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !apiKey) {
          return new Response("Service not configured", { status: 500 });
        }

        // التحقق من الجلسة عبر التوكن
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: claims, error } = await supabase.auth.getClaims(token);
        if (error || !claims?.claims?.sub) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: { text?: string; voice?: string };
        try {
          body = (await request.json()) as { text?: string; voice?: string };
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const text = (body.text ?? "").trim().slice(0, 5000);
        if (!text) return new Response("Empty text", { status: 400 });
        const voice = (body.voice ?? "alloy").slice(0, 40);

        const upstream = await fetch(GATEWAY, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openai/gpt-4o-mini-tts",
            input: text,
            voice,
            stream_format: "sse",
            response_format: "pcm",
            instructions:
              "Speak in warm, natural, friendly Egyptian Arabic like a real human tutor sitting next to the student. Clear, expressive and encouraging.",
          }),
        });

        if (!upstream.ok || !upstream.body) {
          const errBody = await upstream.text().catch(() => "");
          return new Response(errBody || "TTS failed", { status: upstream.status || 502 });
        }

        return new Response(upstream.body, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
          },
        });
      },
    },
  },
});
