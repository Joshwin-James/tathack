// Operator Voice Command Bar Component for /twin and global AppShell
import { useState, useEffect, useRef } from "react";
import { useRouter } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Send,
  Sparkles,
  Volume2,
  AlertTriangle,
  History,
  X,
  Radio,
  CheckCircle2,
  Clock,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VoiceSpeechController, playVoiceReply } from "./speech";
import { voiceBus, type CommandHistoryItem } from "./voice-bus";
import { parseCommand } from "./parse-command";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const EXAMPLE_CHIPS = [
  { label: "Edappally signal green aakku", text: "Edappally signal green aakku" },
  { label: "Green corridor on aakku", text: "Green corridor on aakku" },
  { label: "ആംബുലൻസ് അയക്കൂ", text: "ആംബുലൻസ് അയക്കൂ" },
  { label: "Camera chase aakku", text: "Camera chase aakku" },
  { label: "Status para", text: "Status para" },
];

export function VoiceCommandBar({
  variant = "embedded",
  onClose,
}: {
  variant?: "embedded" | "floating" | "modal";
  onClose?: () => void;
}) {
  const router = useRouter();

  const [language, setLanguage] = useState<"ml-IN" | "en-IN">("ml-IN");
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [typedInput, setTypedInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<CommandHistoryItem[]>([]);

  const controllerRef = useRef<VoiceSpeechController | null>(null);

  useEffect(() => {
    controllerRef.current = new VoiceSpeechController();
    controllerRef.current.language = language;

    const unsubHistory = voiceBus.subscribeHistory((h) => setHistory(h));
    return () => {
      if (controllerRef.current) controllerRef.current.stop();
      unsubHistory();
    };
  }, [language]);

  const handleLanguageToggle = () => {
    const nextLang = language === "ml-IN" ? "en-IN" : "ml-IN";
    setLanguage(nextLang);
    if (controllerRef.current) {
      controllerRef.current.language = nextLang;
    }
    toast.info(`Voice recognition set to ${nextLang === "ml-IN" ? "Malayalam / Manglish (ml-IN)" : "English (en-IN)"}`);
  };

  const handleToggleListening = () => {
    if (!controllerRef.current?.isSupported) {
      toast.error("Speech recognition is not supported in this browser. Please type your command below.");
      return;
    }

    if (isListening) {
      controllerRef.current.stop();
      setIsListening(false);
    } else {
      setLiveTranscript("");
      controllerRef.current.start(
        (interim) => setLiveTranscript(interim),
        (final) => {
          setLiveTranscript(final);
          setIsListening(false);
          handleProcessCommand(final);
        },
        (err) => {
          setIsListening(false);
          toast.error(`Voice error: ${err}`);
        },
        () => {
          setIsListening(false);
        }
      );
      setIsListening(true);
    }
  };

  const handleProcessCommand = async (text: string) => {
    const cmdText = text.trim();
    if (!cmdText) return;

    setIsProcessing(true);
    try {
      // Call TanStack Start server function parseCommand
      const result = await parseCommand({
        data: {
          transcript: cmdText,
          lang: language,
        },
      });

      // Execute via voiceBus
      await voiceBus.execute(result, cmdText, (route) => {
        router.navigate({ to: route });
      });

      setTypedInput("");
      setLiveTranscript("");
    } catch (err: any) {
      toast.error("Failed to parse voice command.");
    } finally {
      setIsProcessing(false);
    }
  };

  const isBrowserSupported = controllerRef.current?.isSupported ?? true;

  return (
    <div
      className={cn(
        "rounded-3xl border shadow-xl backdrop-blur-xl transition-all",
        variant === "embedded"
          ? "bg-slate-900/90 border-slate-700/80 text-white p-4"
          : "bg-slate-900/95 border-primary/40 text-white p-5 w-full max-w-2xl mx-auto shadow-2xl ring-4 ring-primary/10"
      )}
    >
      {/* Header / Language bar */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-primary flex items-center justify-center text-white shadow-md shadow-primary/30">
            <Radio className={cn("size-4", isListening && "animate-pulse")} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider font-mono">
                Operator Voice Command Bar
              </h3>
              <span className="text-[9px] font-mono font-bold bg-primary/20 text-primary border border-primary/30 px-2 py-0.2 rounded-full">
                Gemini 2.5 + RL Synced
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              Speak in Malayalam, Manglish or English to command 3D Twin & Emergency Signals
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Language Toggle */}
          <button
            onClick={handleLanguageToggle}
            className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer transition-colors"
            title="Toggle Speech Recognition Language"
          >
            {language === "ml-IN" ? "🇮🇳 Malayalam (ml-IN)" : "🌐 English (en-IN)"}
          </button>

          {/* History Toggle */}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={cn(
              "size-8 rounded-xl flex items-center justify-center border transition-colors cursor-pointer",
              showHistory ? "bg-primary text-white border-primary" : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white"
            )}
            title="Toggle Command History Log"
          >
            <History className="size-4" />
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="size-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Browser Speech API Warning banner if not supported */}
      {!isBrowserSupported && (
        <div className="mt-3 p-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
          <AlertTriangle className="size-4 shrink-0" />
          <span>Speech Recognition API is not supported in this browser. You can type commands in Malayalam, Manglish, or English below.</span>
        </div>
      )}

      {/* Voice Control & Input Area */}
      <div className="mt-3.5 space-y-3">
        <div className="flex items-center gap-2.5">
          {/* Main Mic Button */}
          <button
            onClick={handleToggleListening}
            disabled={!isBrowserSupported}
            className={cn(
              "size-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-lg shrink-0",
              isListening
                ? "bg-rose-600 text-white animate-pulse shadow-rose-600/40 ring-4 ring-rose-500/30"
                : "bg-primary hover:bg-primary/90 text-white shadow-primary/30"
            )}
            title={isListening ? "Listening... Click to stop" : "Click to speak voice command"}
          >
            {isListening ? <Mic className="size-6 animate-bounce" /> : <Mic className="size-5" />}
          </button>

          {/* Transcript / Text Input Field */}
          <div className="flex-1 relative flex items-center rounded-2xl bg-slate-950/80 border border-slate-700 focus-within:border-primary overflow-hidden px-3 py-2 shadow-inner">
            <input
              type="text"
              value={isListening ? liveTranscript || "Listening for command..." : typedInput}
              onChange={(e) => setTypedInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && typedInput) {
                  handleProcessCommand(typedInput);
                }
              }}
              placeholder={isListening ? "Listening..." : "Type in Manglish / Malayalam / English (e.g. 'Edappally green aakku')..."}
              className={cn(
                "w-full bg-transparent text-xs outline-none text-slate-200 placeholder:text-slate-500 font-mono",
                isListening && "italic text-rose-300"
              )}
            />

            {typedInput && !isListening && (
              <button
                onClick={() => handleProcessCommand(typedInput)}
                disabled={isProcessing}
                className="size-7 rounded-xl bg-primary text-white flex items-center justify-center hover:brightness-110 cursor-pointer shrink-0 ml-2"
              >
                <Send className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Example Quick Action Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10.5px]">
          <span className="text-[9px] font-mono text-slate-500 uppercase font-bold shrink-0">Try:</span>
          {EXAMPLE_CHIPS.map((chip, idx) => (
            <button
              key={`chip-${idx}`}
              onClick={() => handleProcessCommand(chip.text)}
              className="px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/70 whitespace-nowrap cursor-pointer transition-colors shadow-2xs font-mono"
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* Command History Panel */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 pt-3 border-t border-slate-800 space-y-2 overflow-hidden"
          >
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 font-bold uppercase">
              <span>Command Execution Log</span>
              <span>{history.length} commands logged</span>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
              {history.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4 font-mono">No voice commands executed yet.</p>
              ) : (
                history.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-start justify-between gap-3 text-xs font-mono"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase",
                            item.status === "executed"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : item.status === "cancelled"
                                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          )}
                        >
                          {item.action}
                        </span>
                        <span className="text-[10px] text-slate-400">{item.confidence}% match</span>
                        <span className="text-[9px] text-slate-500">{item.timestamp}</span>
                      </div>
                      <p className="text-slate-300 mt-1 font-sans">"{item.transcript}"</p>
                      <p className="text-[10px] text-emerald-400/90 mt-0.5">{item.spokenReplyMl}</p>
                    </div>

                    <button
                      onClick={() => playVoiceReply(item.spokenReplyMl, item.spokenReplyEn)}
                      className="size-7 rounded-xl bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
                      title="Replay Voice Feedback"
                    >
                      <Volume2 className="size-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
