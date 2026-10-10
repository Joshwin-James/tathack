// Global Voice Command Event Bus & Safety Execution Controller
import { toast } from "sonner";
import { type CommandResponse } from "./parse-command";
import { playVoiceReply } from "./speech";

export interface CommandHistoryItem {
  id: string;
  transcript: string;
  action: string;
  params: Record<string, any>;
  confidence: number;
  spokenReplyMl: string;
  spokenReplyEn: string;
  status: "executed" | "cancelled" | "failed";
  timestamp: string;
}

type ActionHandler = (params: Record<string, any>) => void | Promise<void>;

class VoiceCommandBus {
  private handlers = new Map<string, Set<ActionHandler>>();
  private history: CommandHistoryItem[] = [];
  private historyListeners = new Set<(history: CommandHistoryItem[]) => void>();

  public on(action: string, handler: ActionHandler) {
    if (!this.handlers.has(action)) {
      this.handlers.set(action, new Set());
    }
    this.handlers.get(action)!.add(handler);
    return () => {
      this.handlers.get(action)?.delete(handler);
    };
  }

  public subscribeHistory(listener: (history: CommandHistoryItem[]) => void) {
    this.historyListeners.add(listener);
    listener([...this.history]);
    return () => {
      this.historyListeners.delete(listener);
    };
  }

  public getHistory() {
    return [...this.history];
  }

  private addHistory(item: CommandHistoryItem) {
    this.history = [item, ...this.history.slice(0, 49)];
    this.historyListeners.forEach((l) => l([...this.history]));
  }

  public async execute(
    cmd: CommandResponse,
    transcript: string,
    onNavigate?: (route: string) => void
  ) {
    const isSafetyCritical =
      cmd.action === "force_signal" || cmd.action === "send_citizen_alert";

    const historyId = `CMD-${Date.now()}`;
    const timestamp = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    if (isSafetyCritical) {
      // 3-Second Confirmation with Cancel Toast
      let isCancelled = false;

      const toastId = toast.warning(
        `🚨 Safety Action: ${cmd.action === "force_signal" ? `Force Signal ${cmd.params.junction || ""}` : "Broadcast Citizen Alert"}`,
        {
          description: `Executing in 3s: ${JSON.stringify(cmd.params)}. Tap Cancel to abort.`,
          duration: 3500,
          action: {
            label: "Cancel",
            onClick: () => {
              isCancelled = true;
              toast.dismiss(toastId);
              toast.info("Action cancelled by operator.");
              this.addHistory({
                id: historyId,
                transcript,
                action: cmd.action,
                params: cmd.params,
                confidence: cmd.confidence,
                spokenReplyMl: "ഓപ്പറേറ്റർ പ്രവർത്തനം റദ്ദാക്കി.",
                spokenReplyEn: "Action cancelled by operator.",
                status: "cancelled",
                timestamp,
              });
            },
          },
        }
      );

      // Wait 3 seconds before executing
      await new Promise((resolve) => setTimeout(resolve, 3000));

      if (isCancelled) return;
    }

    // Execute handlers
    const handlers = this.handlers.get(cmd.action);
    if (handlers && handlers.size > 0) {
      handlers.forEach((h) => {
        try {
          h(cmd.params);
        } catch (e) {
          console.error("Handler error for", cmd.action, e);
        }
      });
    }

    // Handle standard navigation
    if (cmd.action === "open_page" && cmd.params.route && onNavigate) {
      onNavigate(cmd.params.route);
    }

    // Audio Playback
    playVoiceReply(cmd.spoken_reply_ml, cmd.spoken_reply_en);

    // Toast result
    toast.success(`Voice Command: ${cmd.action.replace("_", " ").toUpperCase()}`, {
      description: cmd.spoken_reply_en,
    });

    // Add to history
    this.addHistory({
      id: historyId,
      transcript,
      action: cmd.action,
      params: cmd.params,
      confidence: cmd.confidence,
      spokenReplyMl: cmd.spoken_reply_ml,
      spokenReplyEn: cmd.spoken_reply_en,
      status: "executed",
      timestamp,
    });
  }
}

export const voiceBus = new VoiceCommandBus();
