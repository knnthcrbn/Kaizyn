"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Minimal typing for the browser Speech Recognition API (Chrome, Edge, Safari).
interface SpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}
interface Recognizer {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

function getRecognizer(): Recognizer | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => Recognizer;
    webkitSpeechRecognition?: new () => Recognizer;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

/**
 * Live speech-to-text in the browser. `finalText` is what's been confirmed,
 * `interim` is the words still being recognised.
 */
export function useSpeech(onFinal?: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognizer | null>(null);
  const wantOn = useRef(false);
  const onFinalRef = useRef(onFinal);
  useEffect(() => {
    onFinalRef.current = onFinal;
  });

  useEffect(() => {
    // Feature detection has to wait for the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(getRecognizer() !== null);
  }, []);

  const start = useCallback(() => {
    const r = getRecognizer();
    if (!r) return;
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";
    r.onresult = (e) => {
      let fin = "";
      let mid = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) fin += res[0].transcript;
        else mid += res[0].transcript;
      }
      if (fin) {
        // With a callback, each confirmed phrase is handed over instead of kept here.
        if (onFinalRef.current) onFinalRef.current(fin.trim());
        else setFinalText((t) => (t ? `${t} ${fin.trim()}` : fin.trim()));
      }
      setInterim(mid);
    };
    r.onerror = (e) => {
      if (e.error !== "no-speech" && e.error !== "aborted") setError(e.error);
    };
    // Browsers stop after a pause; keep going until the user hits stop.
    r.onend = () => {
      if (wantOn.current) {
        try {
          r.start();
        } catch {
          setListening(false);
        }
      } else setListening(false);
    };
    rec.current = r;
    wantOn.current = true;
    setError(null);
    setListening(true);
    r.start();
  }, []);

  const stop = useCallback(() => {
    wantOn.current = false;
    rec.current?.stop();
    setInterim("");
    setListening(false);
  }, []);

  const reset = useCallback(() => {
    setFinalText("");
    setInterim("");
  }, []);

  useEffect(() => () => {
    wantOn.current = false;
    rec.current?.stop();
  }, []);

  return { supported, listening, finalText, interim, error, start, stop, reset, setFinalText };
}
