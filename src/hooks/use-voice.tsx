import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { synthesizeSpeech } from "@/lib/tts.functions";

/**
 * Voice AI — تفاعل صوتي مع المساعد الذكي.
 * - التعرّف على الكلام (Speech-to-Text) عبر Web Speech API باللهجة العربية.
 * - قراءة ردود المساعد بصوت طبيعي (Text-to-Speech) عبر بوابة Lovable AI
 *   (نفس جودة صوت شات جي بي تي) وتشغيله في المتصفح.
 */

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export function useSpeechRecognition() {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalRef = useRef<((text: string) => void) | null>(null);
  const supported = typeof window !== "undefined" && !!getRecognitionCtor();

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
    setListening(false);
  }, []);

  const start = useCallback((onFinal: (text: string) => void) => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    onFinalRef.current = onFinal;
    const rec = new Ctor();
    rec.lang = "ar-EG";
    rec.continuous = false;
    rec.interimResults = true;

    let finalText = "";
    rec.onresult = (e: any) => {
      let partial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += chunk;
        else partial += chunk;
      }
      setInterim(partial);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => {
      setListening(false);
      setInterim("");
      const text = finalText.trim();
      if (text) onFinalRef.current?.(text);
    };

    recRef.current = rec;
    setInterim("");
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { supported, listening, interim, start, stop };
}

export function useSpeech() {
  const callTts = useServerFn(synthesizeSpeech);
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== "undefined" && typeof Audio !== "undefined";
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // معرّف الطلب الحالي: أي طلب أقدم يتم تجاهله لو المستخدم بدأ قراءة جديدة أو أوقف.
  const runRef = useRef(0);

  const stopAudio = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      a.onended = null;
      a.onerror = null;
      a.pause();
      a.src = "";
      audioRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    runRef.current += 1; // يُبطل أي طلب صوتي جارٍ
    stopAudio();
    setSpeaking(false);
  }, [stopAudio]);

  // تشغيل قائمة مقاطع MP3 (base64) بالتتابع.
  const playQueue = useCallback(
    (chunks: string[], runId: number) =>
      new Promise<void>((resolve) => {
        let i = 0;
        const next = () => {
          if (runRef.current !== runId || i >= chunks.length) {
            resolve();
            return;
          }
          const a = new Audio(`data:audio/mpeg;base64,${chunks[i]}`);
          audioRef.current = a;
          a.onended = () => {
            i += 1;
            next();
          };
          a.onerror = () => {
            i += 1;
            next();
          };
          a.play().catch(() => {
            i += 1;
            next();
          });
        };
        next();
      }),
    [],
  );

  const speak = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!supported || !content) return;
      cancel();
      const runId = runRef.current;
      setSpeaking(true);
      try {
        const { audio } = await callTts({ data: { text: content } });
        if (runRef.current !== runId) return; // اتلغى أثناء التوليد
        await playQueue(audio, runId);
      } catch {
        /* لو فشل التوليد نتجاهل بهدوء */
      } finally {
        if (runRef.current === runId) setSpeaking(false);
      }
    },
    [supported, cancel, callTts, playQueue],
  );

  useEffect(() => () => cancel(), [cancel]);

  return { supported, speaking, speak, cancel };
}

