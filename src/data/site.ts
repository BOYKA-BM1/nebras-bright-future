import teacher1 from "@/assets/teacher-1.jpg";
import teacher2 from "@/assets/teacher-2.jpg";
import teacher3 from "@/assets/teacher-3.jpg";

export const teachers = [
  {
    id: 1,
    name: "أ. أحمد عبد الباسط",
    subject: "الرياضيات",
    image: teacher1,
    courses: 5,
    rating: 4.9,
  },
  {
    id: 2,
    name: "أ. منى بن يوسف",
    subject: "علوم الطبيعة والحياة",
    image: teacher2,
    courses: 4,
    rating: 4.8,
  },
  {
    id: 3,
    name: "أ. كريم الشريف",
    subject: "الفيزياء والكيمياء",
    image: teacher3,
    courses: 6,
    rating: 4.9,
  },
] as const;

export const courses = [
  {
    id: 1,
    title: "المراجعة النهائية — جميع المواد",
    teacher: "أ. أحمد عبد الباسط",
    teacherImage: teacher1,
    lessons: 304,
    videos: 174,
    price: 1200,
    details: "تشمل كل المواد: رياضيات، فيزياء، كيمياء، أحياء، لغة عربية، إنجليزي، فرنسي.",
    badge: "الأكثر طلبًا",
  },
  {
    id: 2,
    title: "المراجعة النهائية — المواد الأساسية",
    teacher: "أ. كريم الشريف",
    teacherImage: teacher3,
    lessons: 227,
    videos: 122,
    price: 850,
    details: "ثلاث مواد علمية أساسية: الرياضيات، الفيزياء، الكيمياء.",
    badge: "علمي",
  },
  {
    id: 3,
    title: "دورة الميكانيكا والديناميكا",
    teacher: "أ. كريم الشريف",
    teacherImage: teacher3,
    lessons: 96,
    videos: 48,
    price: 650,
    details: "شرح مفصّل لوحدة الميكانيكا مع تمارين محلولة وامتحانات.",
    badge: "جديد",
  },
  {
    id: 4,
    title: "دورة الأحياء — المناعة والاتصال العصبي",
    teacher: "أ. منى بن يوسف",
    teacherImage: teacher2,
    lessons: 57,
    videos: 16,
    price: 600,
    details: "وحدة المناعة + وحدة الاتصال العصبي بأسلوب مبسّط.",
    badge: "أحياء",
  },
  {
    id: 5,
    title: "دورة الأعداد المركّبة",
    teacher: "أ. أحمد عبد الباسط",
    teacherImage: teacher1,
    lessons: 25,
    videos: 9,
    price: 400,
    details: "آخر وحدة في المقرر مع نماذج امتحانات سابقة.",
    badge: "مركّز",
  },
  {
    id: 6,
    title: "دورة التحولات الطاقوية",
    teacher: "أ. كريم الشريف",
    teacherImage: teacher3,
    lessons: 36,
    videos: 10,
    price: 500,
    details: "آخر وحدة في مقرر الكيمياء مع شرح كل التفاعلات.",
    badge: "كيمياء",
  },
] as const;

export const faqs = [
  {
    q: "كيف أقدر أسجّل حساب جديد؟",
    a: "اضغط على زر «إنشاء حساب جديد» في أعلى الصفحة، أدخل بياناتك (الاسم، البريد الإلكتروني، رقم الهاتف)، اختر كلمة مرور قوية، ثم فعّل حسابك من خلال الرابط المُرسل إلى بريدك.",
  },
  {
    q: "نسيت كلمة المرور، أعملها إزاي؟",
    a: "من صفحة تسجيل الدخول اضغط «نسيت كلمة المرور؟»، أدخل بريدك الإلكتروني، وستصلك رسالة بها رابط لإعادة تعيين كلمة مرور جديدة بسهولة وأمان.",
  },
  {
    q: "إزاي أتواصل مع الدعم الفني؟",
    a: "فريق الدعم متاح عبر الدردشة المباشرة من 9 صباحًا حتى 6 مساءً، أو عبر البريد الإلكتروني والرد خلال 24 ساعة، أو عن طريق إنشاء تذكرة دعم للمشاكل المعقّدة.",
  },
  {
    q: "هل الدورات متاحة على الموبايل؟",
    a: "نعم، منصة نبراس متجاوبة بالكامل وتعمل على كل الأجهزة، كما يمكنك متابعة دروسك من أي مكان وفي أي وقت.",
  },
] as const;

export const navLinks = [
  { label: "الرئيسية", href: "#home" },
  { label: "عن المنصة", href: "#about" },
  { label: "الدورات", href: "#courses" },
  { label: "المدرسون", href: "#teachers" },
  { label: "المساعدة", href: "#help" },
  { label: "تواصل معنا", href: "#contact" },
];
