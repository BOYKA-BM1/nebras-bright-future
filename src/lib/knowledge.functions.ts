import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

/* =========================================================
   استخراج نص كتاب/مذكرة PDF لاستخدامه في قاعدة معرفة الذكاء
   - للأدمن فقط
   - الرابط لازم يكون من تخزين المنصة (lesson-pdfs)
========================================================= */
export const extractDocText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ url: z.string().url() }))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("لم يتم تهيئة خدمة الاستخراج بعد.");

    // صلاحية الأدمن فقط
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    if (!isAdmin) throw new Error("غير مصرّح لك.");

    // حماية من SSRF: لازم يكون رابط تخزين المنصة
    const base = process.env.SUPABASE_URL ?? "";
    if (!base || !data.url.startsWith(`${base}/storage/`) || !data.url.includes("/lesson-pdfs/")) {
      throw new Error("رابط الملف غير صالح.");
    }

    const fileRes = await fetch(data.url);
    if (!fileRes.ok) throw new Error("تعذّر تحميل الملف.");

    const buf = new Uint8Array(await fileRes.arrayBuffer());
    const contentType = fileRes.headers.get("content-type") || "application/pdf";
    const base64 = Buffer.from(buf).toString("base64");

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "استخرج كل النص المكتوب في هذا الملف التعليمي (كتاب/مذكرة) إلى نص عربي منظّم في فقرات وعناوين، بدون أي إضافات أو تعليقات من عندك، فقط المحتوى كما هو.",
              },
              { type: "image_url", image_url: { url: `data:${contentType};base64,${base64}` } },
            ],
          },
        ],
      }),
    });

    if (res.status === 429) throw new Error("الضغط عالي على الخدمة، جرّب بعد شوية.");
    if (res.status === 402) throw new Error("انتهى رصيد الخدمة، تواصل مع الإدارة.");
    if (!res.ok) throw new Error("تعذّر استخراج النص من الملف، حاول تاني أو الصق النص يدويًا.");

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("لم ينتج نص من الملف، حاول تاني.");
    return { text };
  });
