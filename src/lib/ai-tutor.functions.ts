import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// نموذج مساعد ذكاء اصطناعي مخصّص لكل مرحلة وكل صف دراسي.
// النبرة والأسلوب والعمق يتغيّروا حسب المرحلة، والمنهج حسب الصف.

const STAGE_PERSONA: Record<string, string> = {
  primary:
    "أنت مدرّس خصوصي لطفل في المرحلة الابتدائية. استخدم لغة بسيطة جدًا وجُمل قصيرة، وأمثلة من الحياة اليومية واللعب، وشجّع الطالب دائمًا. تجنّب المصطلحات الصعبة.",
  prep:
    "أنت مدرّس خصوصي لطالب في المرحلة الإعدادية. اشرح خطوة بخطوة، اربط المعلومة بأمثلة محسوسة، وقدّم تمرينًا صغيرًا بعد كل فكرة للتأكد من الفهم.",
  secondary:
    "أنت مدرّس خصوصي لطالب في المرحلة الثانوية يستعد للامتحانات المصيرية. قدّم شرحًا دقيقًا ومنظّمًا، مع نقاط امتحانية وأخطاء شائعة وطرق حل سريعة، وركّز على أسلوب الامتحان.",
};

const STAGE_LABEL: Record<string, string> = {
  primary: "المرحلة الابتدائية",
  prep: "المرحلة الإعدادية",
  secondary: "المرحلة الثانوية",
};

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

export const askTutor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      stage: z.enum(["primary", "prep", "secondary"]),
      grade: z.string().min(1).max(120),
      messages: z.array(messageSchema).min(1).max(24),
    }),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("لم يتم تهيئة مساعد الذكاء الاصطناعي بعد.");

    const persona = STAGE_PERSONA[data.stage];
    const stageLabel = STAGE_LABEL[data.stage];

    const system = [
      "أنت «مساعد نجم باشا الذكي»، مساعد تعليمي عربي متخصص في المنهج المصري.",
      persona,
      `الطالب الحالي في: ${data.grade} — ${stageLabel}. اجعل كل الشروحات والأمثلة والمسائل مناسبة تمامًا لهذا الصف والمرحلة، وبنفس مستوى صعوبة منهجه.`,
      "أجب دائمًا بالعربية (يمكن استخدام مصطلحات إنجليزية للمواد الأجنبية عند اللزوم).",
      "لو السؤال خارج نطاق الدراسة، وجّه الطالب بلطف للتركيز على مذاكرته.",
      "استخدم تنسيقًا واضحًا: عناوين قصيرة، نقاط، وخطوات مرقّمة عند الحل.",
    ].join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: system }, ...data.messages],
      }),
    });

    if (res.status === 429) throw new Error("الضغط عالي على المساعد دلوقتي، جرّب بعد شوية.");
    if (res.status === 402) throw new Error("انتهى رصيد المساعد الذكي، تواصل مع الإدارة.");
    if (!res.ok) throw new Error("حصل خطأ أثناء الرد، حاول تاني.");

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const reply = json.choices?.[0]?.message?.content?.trim();
    if (!reply) throw new Error("لم يصل رد من المساعد، حاول تاني.");
    return { reply };
  });
