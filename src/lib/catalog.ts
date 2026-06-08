import type { Database } from "@/integrations/supabase/types";
import teacher1 from "@/assets/teacher-1.jpg";
import teacher2 from "@/assets/teacher-2.jpg";
import teacher3 from "@/assets/teacher-3.jpg";
import teacher4 from "@/assets/teacher-4.jpg";
import teacher5 from "@/assets/teacher-5.jpg";
import teacher6 from "@/assets/teacher-6.jpg";

export type Stage = Database["public"]["Tables"]["stages"]["Row"];
export type Teacher = Database["public"]["Tables"]["teachers"]["Row"];
export type Course = Database["public"]["Tables"]["courses"]["Row"];

export type CourseWithRelations = Course & {
  teacher: Teacher | null;
  stage: Stage | null;
};

/* خريطة الصور المدمجة (للبيانات الأولية) — أي قيمة تبدأ بـ http أو / تُستخدم كما هي */
const BUNDLED_IMAGES: Record<string, string> = {
  "teacher-1": teacher1,
  "teacher-2": teacher2,
  "teacher-3": teacher3,
  "teacher-4": teacher4,
  "teacher-5": teacher5,
  "teacher-6": teacher6,
};

export function resolveImage(url?: string | null): string | null {
  if (!url) return null;
  if (/^(https?:|\/|data:|blob:)/.test(url)) return url;
  return BUNDLED_IMAGES[url] ?? null;
}

export type TrackId = "all" | "science_sci" | "science_math" | "literary";

export const tracks: { id: TrackId; label: string }[] = [
  { id: "all", label: "كل الشُّعب" },
  { id: "science_sci", label: "علمي علوم" },
  { id: "science_math", label: "علمي رياضة" },
  { id: "literary", label: "أدبي" },
];

export const levels: { id: string; label: string }[] = [
  { id: "primary", label: "ابتدائي" },
  { id: "prep", label: "إعدادي" },
  { id: "secondary", label: "ثانوي" },
];

export const courseTypes: { id: string; label: string }[] = [
  { id: "live", label: "مباشر + مسجّل" },
  { id: "recorded", label: "مسجّل بالكامل" },
];

export function trackLabel(id: string): string {
  return tracks.find((t) => t.id === id)?.label ?? id;
}

export function levelLabel(id: string): string {
  return levels.find((l) => l.id === id)?.label ?? id;
}
