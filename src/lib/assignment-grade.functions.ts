import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { enforceRateLimit } from "@/lib/security.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

/**
 * يصحّح تسليم الطالب بمقارنته بنموذج إجابة المدرّس عبر الذكاء الاصطناعي.
 * يحدّث الدرجة والملاحظات فورًا في assignment_submissions.
 */
export const gradeSubmissionWithAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        submissionId: z.string().uuid(),
        assignmentId: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const okRate = await enforceRateLimit(`grade-ai:${context.userId}`, 15, 300);
    if (!okRate) throw new Error("محاولات كثيرة — انتظر قليلًا ثم أعد المحاولة.");

    const { data: sub } = await supabaseAdmin
      .from("assignment_submissions")
      .select("id, student_id, note, file_url, assignment_id")
      .eq("id", data.submissionId)
      .maybeSingle();
    if (!sub) throw new Error("التسليم غير موجود");
    if (sub.student_id !== context.userId) {
      // المدرّس/أدمن يمكنهم طلب إعادة التصحيح
      const { data: roles } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId);
      const rs = (roles ?? []).map((r) => r.role);
      const isStaff = rs.includes("admin") || rs.includes("admin_secondary") || rs.includes("teacher");
      if (!isStaff) throw new Error("غير مصرّح");
    }

    const { data: assignment } = await supabaseAdmin
      .from("assignments")
      .select("id, title, description, max_score, answer_key_text, kind, course_id")
      .eq("id", data.assignmentId)
      .maybeSingle();
    if (!assignment) throw new Error("الواجب غير موجود");

    const answerKey = (assignment.answer_key_text || "").trim();
    const studentAnswer = (sub.note || "").trim();
    if (!answerKey) {
      throw new Error("المدرّس لم يرفع نموذج إجابة بعد — التصحيح الآلي غير متاح.");
    }
    if (!studentAnswer) {
      throw new Error("اكتب إجابتك نصًا في خانة الملاحظات حتى يتم التصحيح الآلي.");
    }

    const maxScore = Number(assignment.max_score) || 100;
    const kindLabel = assignment.kind === "exam" ? "امتحان" : "واجب";

    const system = `أنت مصحّح تعليمي صارم ودقيق للمنصة العربية Edu Mindly.
قارن إجابة الطالب بنموذج إجابة المدرّس فقط.
أرجع JSON فقط بدون أي نص خارجي بالشكل:
{"score": number, "percent": number, "summary": string, "errors": string[], "strengths": string[]}
- score من 0 إلى ${maxScore}
- percent من 0 إلى 100
- summary بالعربية جملة أو جملتين
- errors قائمة أخطاء واضحة بالعربية
- strengths نقاط قوة مختصرة
لا تخترع محتوى غير موجود في الإجابتين.`;

    const userMsg = `نوع التقييم: ${kindLabel}
عنوان: ${assignment.title}
وصف الواجب: ${assignment.description || "—"}

=== نموذج إجابة المدرّس ===
${answerKey}

=== إجابة الطالب ===
${studentAnswer}
`;

    const apiKey = process.env.LOVABLE_API_KEY || process.env.OPENAI_API_KEY || "";
    let score = Math.round(maxScore * 0.5);
    let feedback = "تم استلام التسليم. تعذّر الاتصال بمحرّك التصحيح الآن.";

    if (apiKey) {
      try {
        const res = await fetch(GATEWAY, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: system },
              { role: "user", content: userMsg },
            ],
            temperature: 0.2,
          }),
        });
        if (res.ok) {
          const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
          const content = json.choices?.[0]?.message?.content ?? "";
          const match = content.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]) as {
              score?: number;
              percent?: number;
              summary?: string;
              errors?: string[];
              strengths?: string[];
            };
            score = Math.max(0, Math.min(maxScore, Number(parsed.score) || 0));
            const errs = (parsed.errors ?? []).filter(Boolean);
            const strengths = (parsed.strengths ?? []).filter(Boolean);
            feedback = [
              parsed.summary || "تم التصحيح.",
              strengths.length ? `نقاط قوة: ${strengths.join("؛ ")}` : "",
              errs.length ? `أخطاء وملاحظات: ${errs.join("؛ ")}` : "لا توجد أخطاء جوهرية مسجّلة.",
            ]
              .filter(Boolean)
              .join("\n");
          }
        }
      } catch {
        /* fallback heuristic below */
      }
    }

    if (!apiKey || feedback.startsWith("تم استلام التسليم")) {
      // تصحيح تقريبي محلي عند غياب المفتاح
      const keyTokens = new Set(
        answerKey
          .toLowerCase()
          .split(/[\s،,.؛;:]+/)
          .filter((t) => t.length > 2),
      );
      const ansTokens = studentAnswer
        .toLowerCase()
        .split(/[\s،,.؛;:]+/)
        .filter((t) => t.length > 2);
      const hit = ansTokens.filter((t) => keyTokens.has(t)).length;
      const ratio = keyTokens.size ? hit / keyTokens.size : 0;
      score = Math.round(Math.min(1, ratio * 1.2) * maxScore);
      feedback = `تصحيح تلقائي تقريبي (بدون نموذج سحابي): تغطية تقريبية ${Math.round(ratio * 100)}% من كلمات نموذج الإجابة. راجع المدرّس للتدقيق النهائي.`;
    }

    const { error } = await supabaseAdmin
      .from("assignment_submissions")
      .update({
        score,
        feedback,
        status: "graded",
        graded_at: new Date().toISOString(),
        graded_by: null,
      })
      .eq("id", data.submissionId);
    if (error) throw new Error(error.message || "تعذّر حفظ نتيجة التصحيح");

    return { ok: true as const, score, feedback, maxScore };
  });
