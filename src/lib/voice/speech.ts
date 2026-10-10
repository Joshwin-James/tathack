// Web Speech API Voice Recognition & SpeechSynthesis Utilities for Malayalam / English
export interface SpeechRecognitionResultState {
  transcript: string;
  isFinal: boolean;
}

export class VoiceSpeechController {
  private recognition: any = null;
  public isSupported = false;
  public isListening = false;
  public language: "ml-IN" | "en-IN" = "ml-IN";

  constructor() {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.isSupported = !!SpeechRecognition;
    }
  }

  public start(
    onInterim: (text: string) => void,
    onFinal: (text: string) => void,
    onError: (err: string) => void,
    onEnd: () => void
  ) {
    if (!this.isSupported || typeof window === "undefined") {
      onError("Web Speech API is not supported in this browser. Please use keyboard input.");
      return;
    }

    try {
      this.stop();

      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = this.language;

      rec.onstart = () => {
        this.isListening = true;
      };

      rec.onresult = (event: any) => {
        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (interim) onInterim(interim);
        if (final) {
          onFinal(final);
          this.isListening = false;
        }
      };

      rec.onerror = (event: any) => {
        this.isListening = false;
        if (event.error === "no-speech") return;
        onError(event.error || "Speech recognition error");
      };

      rec.onend = () => {
        this.isListening = false;
        onEnd();
      };

      this.recognition = rec;
      rec.start();
    } catch (e: any) {
      this.isListening = false;
      onError(e.message || "Failed to start speech recognition");
    }
  }

  public stop() {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {}
      this.recognition = null;
    }
    this.isListening = false;
  }
}

// Text-to-Speech Player supporting Malayalam & English voices
export function playVoiceReply(spokenMl: string, spokenEn: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

  try {
    window.speechSynthesis.cancel();
    const voices = window.speechSynthesis.getVoices();
    const mlVoice = voices.find(
      (v) => v.lang.toLowerCase().includes("ml") || v.name.toLowerCase().includes("malayalam")
    );

    if (mlVoice && spokenMl) {
      const utterance = new SpeechSynthesisUtterance(spokenMl);
      utterance.voice = mlVoice;
      utterance.lang = "ml-IN";
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } else {
      const enVoice = voices.find(
        (v) => v.lang.toLowerCase().includes("en-in") || v.lang.toLowerCase().includes("en-gb") || v.lang.startsWith("en")
      );
      const utterance = new SpeechSynthesisUtterance(spokenEn || spokenMl);
      if (enVoice) utterance.voice = enVoice;
      utterance.lang = "en-IN";
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  } catch (err) {
    console.warn("SpeechSynthesis error:", err);
  }
}
