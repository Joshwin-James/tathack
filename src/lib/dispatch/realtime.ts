// Project Sentinel — Dispatch Real-time Multi-Tab Synchronizer
// Cross-tab broadcast and event emitter

export type DispatchEventType =
  | 'assignment.created'
  | 'assignment.updated'
  | 'assignment.status_changed'
  | 'assignment.assigned'
  | 'assignment.comment_added'
  | 'simulation.reset';

export interface DispatchBroadcastMessage {
  type: DispatchEventType;
  assignmentId?: string;
  timestamp: number;
  payload?: any;
}

type Listener = (msg: DispatchBroadcastMessage) => void;

class DispatchRealtimeManager {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<Listener> = new Set();

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('sentinel-dispatch');
        this.channel.onmessage = (event) => {
          this.notify(event.data);
        };
      } catch (e) {
        console.warn('BroadcastChannel not supported in this environment', e);
      }
    }
  }

  broadcast(type: DispatchEventType, assignmentId?: string, payload?: any) {
    const msg: DispatchBroadcastMessage = {
      type,
      assignmentId,
      timestamp: Date.now(),
      payload,
    };

    // 1. Notify local tab listeners
    this.notify(msg);

    // 2. Broadcast across tabs
    if (this.channel) {
      try {
        this.channel.postMessage(msg);
      } catch (e) {
        console.warn('Broadcast postMessage error:', e);
      }
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(msg: DispatchBroadcastMessage) {
    for (const l of this.listeners) {
      try {
        l(msg);
      } catch (e) {
        console.error('Error in dispatch realtime listener:', e);
      }
    }
  }
}

export const dispatchRealtime = new DispatchRealtimeManager();
