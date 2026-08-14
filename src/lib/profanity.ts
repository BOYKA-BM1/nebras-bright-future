/**
 * فلتر الألفاظ للدردشة الصفّية.
 * - يمنع إرسال الرسائل اللي فيها سباب أو ألفاظ خارجة
 * - يتعامل مع التطويل (اااا) والتشكيل والحروف المكرّرة والفواصل بين الحروف
 */

const BANNED = [
  // عربي
  "كلب","كلبه","حمار","حماره","خول","خوال","معتوه","غبي","غبيه","اهبل","هبله","متخلف","متخلفه",
  "زفت","قذر","قذره","حقير","حقيره","وسخ","وسخه","نجس","تافه","تافهه","بهيمه","خرا","زباله",
  "شرموط","شرموطه","قحبه","عرص","معرص","منيك","متناك","متناكه","نيك","زبر","زب","طيز","كس",
  "لعنه","يلعن","العن","انعل","خرب","سافل","سافله","حيوان","حيوانه","بقره","خنزير","علق",
  "يخرب","ملعون","ملعونه","عاهره","فاجر","فاجره","سكس","جنس ممنوع",
  // إنجليزي
  "fuck","fucker","fucking","shit","bitch","bastard","asshole","dick","pussy","whore","slut",
  "cunt","motherfucker","nigga","nigger","porn","sex",
];

const AR_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;

function normalize(text: string) {
  let s = text.toLowerCase();
  s = s.replace(AR_DIACRITICS, "");
  s = s
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ىئي]/g, "ي")
    .replace(/[ؤو]/g, "و")
    .replace(/ة/g, "ه")
    .replace(/گ/g, "ك")
    .replace(/[0@]/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/\$/g, "s")
    .replace(/3/g, "e");
  // شيل أي رمز/مسافة بين الحروف لمنع التمويه (ك.ل.ب)
  s = s.replace(/[^\p{L}\p{N}]+/gu, "");
  // قلّل الحروف المكرّرة (كلللب -> كلب)
  s = s.replace(/(.)\1{1,}/gu, "$1");
  return s;
}

const NORMALIZED_BANNED = [...new Set(BANNED.map((w) => normalize(w)).filter((w) => w.length >= 2))];

/** يرجّع الكلمة الممنوعة الأولى الموجودة في النص، أو null لو النص نظيف */
export function findProfanity(text: string): string | null {
  const s = normalize(text);
  if (!s) return null;
  for (let i = 0; i < NORMALIZED_BANNED.length; i++) {
    const w = NORMALIZED_BANNED[i]!;
    if (s.includes(w)) return BANNED[NORMALIZED_BANNED.indexOf(w)] ?? w;
  }
  return null;
}

export function isClean(text: string) {
  return findProfanity(text) === null;
}

export const PROFANITY_MESSAGE =
  "الرسالة فيها ألفاظ غير لائقة — من فضلك اتكلم باحترام مع زمايلك.";
