import { io, Socket } from "socket.io-client";
import { getToken } from "./api";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

let socket: Socket | null = null;

// Queue of listeners registered before socket connected
const pendingListeners: Array<{ event: string; cb: (...args: any[]) => void }> = [];

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(): Socket {
  if (socket?.connected) return socket;

  // Clean up old socket if disconnected
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }

  const token = getToken();
  if (!token) throw new Error("No auth token");

  socket = io(API_BASE, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
  });

  socket.on("connect", () => {
    console.log("[Socket] Connected to server");
    // Attach any listeners that were registered before connection
    pendingListeners.forEach(({ event, cb }) => {
      socket?.on(event, cb);
    });
    pendingListeners.length = 0;
  });

  socket.on("disconnect", (reason) => {
    console.log("[Socket] Disconnected:", reason);
  });

  socket.on("connect_error", (err) => {
    console.warn("[Socket] Connection error:", err.message);
  });

  // Attach pending listeners immediately (socket.io queues them even before connect)
  pendingListeners.forEach(({ event, cb }) => {
    socket?.on(event, cb);
  });
  pendingListeners.length = 0;

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

// ── Typed event listeners ──
// These work even if called before the socket is connected

export interface RideStatusEvent {
  ride_id: string;
  old_status: string | null;
  new_status: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface DriverLocationEvent {
  driver_id: string;
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  timestamp: string;
}

export interface ChatMessageEvent {
  id: string;
  ride_id: string;
  sender_id: string;
  sender_name: string;
  body: string;
  created_at: string;
}

type EventCallback<T> = (data: T) => void;

function on(event: string, cb: (...args: any[]) => void) {
  if (socket) {
    socket.on(event, cb);
  } else {
    pendingListeners.push({ event, cb });
  }
  return () => {
    socket?.off(event, cb);
    const idx = pendingListeners.findIndex((p) => p.event === event && p.cb === cb);
    if (idx >= 0) pendingListeners.splice(idx, 1);
  };
}

export function onRideStatus(cb: EventCallback<RideStatusEvent>) {
  return on("ride:status", cb);
}

export function onDriverLocation(cb: EventCallback<DriverLocationEvent>) {
  return on("driver:location", cb);
}

export function onChatMessage(cb: EventCallback<ChatMessageEvent>) {
  return on("chat:message", cb);
}

export interface DriverStatusEvent {
  driver_id: string;
  user_id: string;
  status: string;
  timestamp: string;
  [key: string]: unknown;
}

export function onDriverStatus(cb: EventCallback<DriverStatusEvent>) {
  return on("driver:status", cb);
}
