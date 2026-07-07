// منطق نظام التحفيز: المستويات، النقاط اللازمة، والأوسمة.

export type Badge = {
  key: string;
  label: string;
  emoji: string;
  desc: string;
  earned: boolean;
};

/** المستوى يزيد كل 100 نقطة، مع شريط تقدّم داخل المستوى. */
export function levelInfo(xp: number) {
  const per = 100;
  const level = Math.floor(xp / per) + 1;
  const inLevel = xp % per;
  const toNext = per - inLevel;
  const percent = Math.round((inLevel / per) * 100);
  return { level, inLevel, toNext, percent, per };
}

export function levelTitle(level: number): string {
  if (level >= 20) return "أسطورة الأمن السيبراني";
  if (level >= 12) return "خبير أمن محترف";
  if (level >= 7) return "محلّل أمني";
  if (level >= 4) return "هاكر صاعد";
  return "مبتدئ";
}

export function computeBadges(opts: { xp: number; rank: number | null; lessons: number; courses: number }): Badge[] {
  const { xp, rank, lessons, courses } = opts;
  return [
    { key: "beginner", label: "Beginner Hacker", emoji: "🐣", desc: "بدأت رحلتك — أول نقاطك", earned: xp >= 10 },
    { key: "learner", label: "متعلّم نشيط", emoji: "🔥", desc: "أكملت 5 دروس", earned: lessons >= 5 },
    { key: "collector", label: "جامع الدورات", emoji: "📚", desc: "اشتركت في 3 دورات", earned: courses >= 3 },
    { key: "security", label: "Security Expert", emoji: "🛡️", desc: "وصلت إلى 500 نقطة", earned: xp >= 500 },
    { key: "legend", label: "أسطورة", emoji: "⚡", desc: "وصلت إلى 1000 نقطة", earned: xp >= 1000 },
    { key: "top", label: "Top Student", emoji: "👑", desc: "المركز الأول في لوحة المتصدّرين", earned: rank === 1 },
  ];
}
