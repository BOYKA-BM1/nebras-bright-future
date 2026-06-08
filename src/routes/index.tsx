import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/site/Navbar";
import { Hero } from "@/components/site/Hero";
import { About } from "@/components/site/About";
import { Stages } from "@/components/site/Stages";
import { Courses } from "@/components/site/Courses";
import { Lectures } from "@/components/site/Lectures";
import { Teachers } from "@/components/site/Teachers";
import { HelpCenter } from "@/components/site/HelpCenter";
import { Footer } from "@/components/site/Footer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "نبراس | أقوى منصة تعليمية في مصر" },
      {
        name: "description",
        content:
          "نبراس منصة تعليمية متطورة تجمع أفضل المدرسين في مصر، دروس وفيديوهات تفاعلية لكل المراحل الدراسية لتحقيق التفوق.",
      },
      { property: "og:title", content: "نبراس | أقوى منصة تعليمية في مصر" },
      {
        property: "og:description",
        content: "أفضل المدرسين وأحدث التقنيات لتعليم الطلاب في كل مصر مع منصة نبراس.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />
        <Stages />
        <About />
        <Courses />
        <Lectures />
        <Teachers />
        <HelpCenter />
      </main>
      <Footer />
    </div>
  );
}
