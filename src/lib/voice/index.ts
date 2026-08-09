// Beatrice · Selección de proveedor de voz.
// Un único punto donde se decide qué motor de voz usa el cockpit. Hoy: Web Speech API.
// Para enchufar Whisper/ElevenLabs, implementar VoiceRecognizer/VoiceSpeaker y devolverlos aquí.
"use client";
import type { VoiceRecognizer, VoiceSpeaker } from "./types";
import { WebSpeechRecognizer, WebSpeechSpeaker } from "./webspeech";

let _rec: VoiceRecognizer | null = null;
let _spk: VoiceSpeaker | null = null;

export function getRecognizer(): VoiceRecognizer {
  return (_rec ??= new WebSpeechRecognizer());
}
export function getSpeaker(): VoiceSpeaker {
  return (_spk ??= new WebSpeechSpeaker());
}

export * from "./types";
