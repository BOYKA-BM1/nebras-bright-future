import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

// نبرة النموذج تتغيّر حسب المرحلة، والمحتوى حسب صف الطالب.
const STAGE_PERSONA: Record<string, string> = {
  primary:
    "أنت مدرّس خصوصي لطفل في المرحلة الابتدائية. استخدم لغة بسيطة جدًا وجُمل قصيرة وأمثلة من اللعب والحياة اليومية، وشجّع الطالب دائمًا.",
  prep:
    "أنت مدرّس خصوصي لطالب في المرحلة الإعدادية. اشرح خطوة بخطوة واربط المعلومة بأمثلة محسوسة، وقدّم تمرينًا صغيرًا بعد كل فكرة.",
  secondary:
    "أنت مدرّس خصوصي لطالب في المرحلة الثانوية يستعد للامتحانات. قدّم شرحًا دقيقًا ومنظّمًا مع نقاط امتحانية وأخطاء شائعة وطرق حل سريعة.",
};

const STAGE_LABEL: Record<string, string> = {
  primary: "المرحلة الابتدائية",
  prep: "المرحلة الإعدادية",
  secondary: "المرحلة الثانوية",
};

function levelFromGrade(grade?: string | null): "primary" | "prep" | "secondary" {
  if (!grade) return "secondary";
  if (grade.includes("الابتدائي")) return "primary";
  if (grade.includes("الإعدادي")) return "prep";
  return "secondary";
}

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(100000),
});

/* =========================================================
   مساعد مبني على محاضرات ومذكرات المدرّسين فقط (RAG)
   - يحدّد المرحلة والصف تلقائيًا من ملف الطالب
   - يجيب فقط من نصوص المحاضرات (transcript) والوصف/المذكرات
========================================================= */
export const askTutor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      messages: z.array(messageSchema).min(1).max(24),
    }),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("لم يتم تهيئة المساعد الذكي بعد.");

    // سجل المدرّس له الأولوية لو المستخدم مدرّس (لأنه ممكن يكون عنده ملف طالب قديم)
    const { data: teacher } = await context.supabase
      .from("teachers")
      .select("grade, stage")
      .eq("user_id", context.userId)
      .maybeSingle();

    let grade = "";
    let levelValue = "";

    if (teacher?.grade) {
      grade = teacher.grade.trim();
      levelValue = teacher.stage ?? "";
    } else {
      // طالب عادي: نأخذ المرحلة والصف من ملفه
      const { data: profile } = await context.supabase
        .from("profiles")
        .select("grade, level")
        .eq("id", context.userId)
        .maybeSingle();
      grade = profile?.grade?.trim() || "";
      levelValue = profile?.level ?? "";
    }

    if (!grade) {
      return {
        reply:
          "قبل ما نبدأ، محتاج تكمّل بياناتك وتختار مرحلتك وصفّك الدراسي من صفحة حسابك، وبعدها هقدر أساعدك على قد منهجك بالظبط. ✨",
      };
    }

    const stage = ["primary", "prep", "secondary"].includes(levelValue)
      ? (levelValue as "primary" | "prep" | "secondary")
      : levelFromGrade(grade);

    // قاعدة المعرفة: محاضرات ومذكرات الطالب المتاحة له فقط (RLS)
    const { data: lessons } = await context.supabase
      .from("lessons")
      .select("title, description, transcript, courses(title, subject)")
      .or("transcript.not.is.null,description.not.is.null")
      .limit(120);

    const blocks: string[] = [];
    let budget = 42000;
    for (const l of lessons ?? []) {
      const course = (l as { courses?: { title?: string; subject?: string } }).courses;
      const body = (l.transcript?.trim() || l.description?.trim() || "").slice(0, 8000);
      if (!body) continue;
      const block = `### محاضرة: ${l.title}${course?.subject ? ` — ${course.subject}` : ""}${course?.title ? ` (${course.title})` : ""}\n${body}`;
      if (block.length > budget) break;
      budget -= block.length;
      blocks.push(block);
    }

    const knowledge = blocks.join("\n\n");

    if (!knowledge) {
      return {
        reply:
          "مفيش محاضرات أو مذكرات متاحة في حسابك لحد دلوقتي، فمقدرش أجاوب من غيرها. اشترك في دوراتك أو استنى مدرّسك يرفع المحاضرات وارجعلي تاني. 📚",
      };
    }

    const system = [
      "أنت «مساعد نجم باشا الذكي»، مساعد تعليمي عربي.",
      STAGE_PERSONA[stage],
      `الطالب في: ${grade} — ${STAGE_LABEL[stage]}.`,
      "قاعدة صارمة: تجاوب فقط من محتوى المحاضرات والمذكرات المرفقة تحت. ممنوع تمامًا تستخدم أي معلومة من خارجها.",
      "لو الإجابة مش موجودة في المحاضرات المرفقة، قل بالحرف: «المعلومة دي مش موجودة في محاضراتك المتاحة، ذاكر الدرس كويس أو اسأل مدرّسك.» ولا تخترع إجابة.",
      "أجب بالعربية بأسلوب منظّم: عناوين قصيرة ونقاط وخطوات مرقّمة عند الحل.",
      "",
      "===== محاضرات ومذكرات الطالب =====",
      knowledge,
      "===== نهاية المحاضرات =====",
    ].join("\n");

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: system }, ...data.messages],
      }),
    });

    if (res.status === 429) throw new Error("الضغط عالي على المساعد دلوقتي، جرّب بعد شوية.");
    if (res.status === 402) throw new Error("انتهى رصيد المساعد الذكي، تواصل مع الإدارة.");
    if (!res.ok) throw new Error("حصل خطأ أثناء الرد، حاول تاني.");

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const reply = json.choices?.[0]?.message?.content?.trim();
    if (!reply) throw new Error("لم يصل رد من المساعد، حاول تاني.");
    return { reply };
  });

/* =========================================================
   تفريغ فيديو المحاضرة إلى نص (للمدرّس/الأدمن/المونتاج)
========================================================= */
const MAX_BYTES = 20 * 1024 * 1024; // حد التفريغ المباشر

export const transcribeVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ url: z.string().url() }))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("لم يتم تهيئة خدمة التفريغ بعد.");

    // صلاحيات: مدرّس أو أدمن أو مونتاج فقط
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const allowed = (roles ?? []).some((r) => ["teacher", "admin", "montage"].includes(r.role));
    if (!allowed) throw new Error("غير مصرّح لك بتفريغ الفيديو.");

    // حماية من SSRF: لازم يكون رابط تخزين المحاضرات الخاص بنا
    const base = process.env.SUPABASE_URL ?? "";
    if (!base || !data.url.startsWith(`${base}/storage/`) || !data.url.includes("/lesson-videos/")) {
      throw new Error("رابط الفيديو غير صالح.");
    }

    const videoRes = await fetch(data.url);
    if (!videoRes.ok) throw new Error("تعذّر تحميل الفيديو للتفريغ.");

    const len = Number(videoRes.headers.get("content-length") || 0);
    if (len && len > MAX_BYTES) {
      throw new Error("الفيديو كبير على التفريغ التلقائي (الحد 20 ميجا). ممكن تكتب ملخص المحاضرة يدويًا في خانة الوصف/المذكرة.");
    }

    const buf = new Uint8Array(await videoRes.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) {
      throw new Error("الفيديو كبير على التفريغ التلقائي (الحد 20 ميجا). ممكن تكتب ملخص المحاضرة يدويًا في خانة الوصف/المذكرة.");
    }

    const contentType = videoRes.headers.get("content-type") || "video/mp4";
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
                text: "أنت مفرّغ صوتي محترف. فرّغ كل الكلام المنطوق في هذا الفيديو التعليمي إلى نص عربي مكتوب كامل ومنظّم في فقرات، بدون أي إضافات أو تعليقات من عندك، فقط النص المنطوق كما هو.",
              },
              { type: "image_url", image_url: { url: `data:${contentType};base64,${base64}` } },
            ],
          },
        ],
      }),
    });

    if (res.status === 429) throw new Error("الضغط عالي على خدمة التفريغ، جرّب بعد شوية.");
    if (res.status === 402) throw new Error("انتهى رصيد خدمة التفريغ، تواصل مع الإدارة.");
    if (!res.ok) throw new Error("تعذّر تفريغ الفيديو، حاول تاني.");

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const transcript = json.choices?.[0]?.message?.content?.trim();
    if (!transcript) throw new Error("لم ينتج نص من الفيديو، حاول تاني.");
    return { transcript };
  });
