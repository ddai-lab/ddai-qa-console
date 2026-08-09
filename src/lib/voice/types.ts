// Beatrice · Capa de voz (abstracción de proveedor).
//
// Igual que la capa de IA, la voz NO se casa con un proveedor. Hoy usa la Web Speech API
// del navegador (sin costo, sin API key). Mañana se puede reemplazar el reconocimiento por
// Whisper (STT) y la síntesis por ElevenLabs implementando estas mismas interfaces, sin
// tocar el cockpit.

export interface RecognizerHandlers {
  onResult: (text: string, isFinal: boolean) => void;
  onEnd: () => void;
  onError: (message: string) => void;
}

export interface VoiceRecognizer {
  readonly name: string; // ej "web-speech" → queda en el log de auditoría
  supported(): boolean;
  start(handlers: RecognizerHandlers): void;
  stop(): void;
}

export interface VoiceSpeaker {
  readonly name: string;
  supported(): boolean;
  speak(text: string): void;
  cancel(): void;
}
