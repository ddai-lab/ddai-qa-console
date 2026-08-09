// Beatrice · Implementación de voz con Web Speech API (navegador).
"use client";
import type { RecognizerHandlers, VoiceRecognizer, VoiceSpeaker } from "./types";

const LANG = "es-CL";

export class WebSpeechRecognizer implements VoiceRecognizer {
  readonly name = "web-speech";
  private rec: any = null;

  supported() {
    if (typeof window === "undefined") return false;
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  start(h: RecognizerHandlers) {
    if (!this.supported()) { h.onError("El navegador no soporta reconocimiento de voz."); return; }
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new Ctor();
    this.rec = rec;
    rec.lang = LANG;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    rec.onresult = (e: any) => {
      let interim = "", final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t; else interim += t;
      }
      if (final) h.onResult(final.trim(), true);
      else if (interim) h.onResult(interim.trim(), false);
    };
    rec.onerror = (e: any) => h.onError(e?.error || "error de reconocimiento");
    rec.onend = () => h.onEnd();
    rec.start();
  }

  stop() { try { this.rec?.stop(); } catch { /* noop */ } }
}

export class WebSpeechSpeaker implements VoiceSpeaker {
  readonly name = "web-speech";

  supported() {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  private pickVoice(): SpeechSynthesisVoice | undefined {
    const voices = window.speechSynthesis.getVoices();
    return (
      voices.find((v) => v.lang === LANG) ||
      voices.find((v) => v.lang?.startsWith("es")) ||
      voices[0]
    );
  }

  speak(text: string) {
    if (!this.supported() || !text) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = LANG;
    u.rate = 1.05;
    u.pitch = 1;
    const v = this.pickVoice();
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  }

  cancel() { if (this.supported()) window.speechSynthesis.cancel(); }
}
