import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

/**
 * Voice AI — تفاعل صوتي مع المساعد الذكي.
 * - التعرّف على الكلام (Speech-to-Text) عبر Web Speech API باللهجة العربية.
 * - قراءة ردود المساعد بصوت طبيعي (Text-to-Speech) عبر بوابة Lovable AI
 *   (نفس جودة صوت شات جي بي تي) مع بث فوري: الصوت يبدأ مع ظهور الرد مباشرةً.
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
  const [speaking, setSpeaking] = useState(false);
  const supported =
    typeof window !== "undefined" &&
    (typeof AudioContext !== "undefined" || typeof (window as any).webkitAudioContext !== "undefined");
  // معرّف الطلب الحالي: أي طلب أقدم يتم تجاهله لو المستخدم بدأ قراءة جديدة أو أوقف.
  const runRef = useRef(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // المصادر الصوتية الجارية عشان نوقفها فورًا عند الإلغاء
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // إنشاء/فتح سياق الصوت. لازم يتنفّذ داخل تفاعل مستخدم (ضغطة زر) عشان
  // المتصفح يسمح بتشغيل الصوت (سياسة التشغيل التلقائي)، وإلا يفضل الصوت معطّل.
  const ensureCtx = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    const Ctor: typeof AudioContext | undefined =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return null;
    let ctx = ctxRef.current;
    if (!ctx || ctx.state === "closed") {
      ctx = new Ctor({ sampleRate: 24000 });
      ctxRef.current = ctx;
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }, []);

  // فتح الصوت مبكرًا على ضغطة المستخدم (زر القراءة/المايك) — بتشغيل نبضة صامتة.
  const prime = useCallback(() => {
    const ctx = ensureCtx();
    if (!ctx) return;
    try {
      const b = ctx.createBuffer(1, 1, 24000);
      const s = ctx.createBufferSource();
      s.buffer = b;
      s.connect(ctx.destination);
      s.start(0);
    } catch {
      /* noop */
    }
  }, [ensureCtx]);

  const stopSources = useCallback(() => {
    for (const s of sourcesRef.current) {
      try {
        s.onended = null;
        s.stop();
      } catch {
        /* noop */
      }
    }
    sourcesRef.current.clear();
  }, []);

  const cancel = useCallback(() => {
    runRef.current += 1; // يُبطل أي بث صوتي جارٍ
    abortRef.current?.abort();
    abortRef.current = null;
    stopSources();
    setSpeaking(false);
  }, [stopSources]);

  const speak = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!supported || !content) return;
      cancel();
      const runId = runRef.current;
      setSpeaking(true);

      const ctx = ensureCtx();
      if (!ctx) {
        setSpeaking(false);
        return;
      }
      if (ctx.state === "suspended") await ctx.resume().catch(() => {});

      let playhead = 0;
      let pending = new Uint8Array(0);
      let scheduled = 0; // عدد المقاطع المجدولة للتشغيل
      let ended = false;

      const finish = () => {
        if (runRef.current === runId) setSpeaking(false);
      };

      const schedule = (incoming: Uint8Array) => {
        const bytes = new Uint8Array(pending.length + incoming.length);
        bytes.set(pending);
        bytes.set(incoming, pending.length);
        const usable = bytes.length - (bytes.length % 2);
        pending = bytes.slice(usable);
        if (usable === 0) return;
        const samples = new Int16Array(bytes.buffer, 0, usable / 2);
        const floats = Float32Array.from(samples, (s) => s / 32768);
        const buffer = ctx.createBuffer(1, floats.length, 24000);
        buffer.copyToChannel(floats, 0);
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(ctx.destination);
        if (playhead === 0) playhead = ctx.currentTime + 0.08;
        else playhead = Math.max(playhead, ctx.currentTime);
        scheduled += 1;
        sourcesRef.current.add(src);
        src.onended = () => {
          scheduled -= 1;
          sourcesRef.current.delete(src);
          if (ended && scheduled <= 0) finish();
        };
        src.start(playhead);
        playhead += buffer.duration;
      };

      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token || runRef.current !== runId) {
          finish();
          return;
        }

        const controller = new AbortController();
        abortRef.current = controller;

        const res = await fetch("/api/tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ text: content }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body || runRef.current !== runId) {
          finish();
          return;
        }

        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buf = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done || runRef.current !== runId) break;
          buf += value;
          const parts = buf.split("\n\n");
          buf = parts.pop() ?? "";
          for (const part of parts) {
            const line = part.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            let evt: { type?: string; audio?: string };
            try {
              evt = JSON.parse(payload);
            } catch {
              continue;
            }
            if (evt.type === "speech.audio.delta" && evt.audio) {
              const bin = atob(evt.audio);
              const arr = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
              schedule(arr);
            }
          }
        }
        ended = true;
        // لو خلص البث ومفيش صوت مجدول (أو كله اتشغّل بسرعة) نوقف الحالة.
        if (scheduled <= 0) finish();
      } catch {
        if (runRef.current === runId) setSpeaking(false);
      }
    },
    [supported, cancel, ensureCtx],
  );

  useEffect(() => () => cancel(), [cancel]);

  return { supported, speaking, speak, cancel, prime };
}


