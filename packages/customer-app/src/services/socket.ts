import { io, Socket } from "socket.io-client";
import { API_BASE_URL } from "./config";
import { getStoredTokens } from "./api";

let socket: Socket | null = null;

export async function connectSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  const tokens = await getStoredTokens();
  if (!tokens?.accessToken) {
    throw new Error("No auth token for socket connection");
  }

  socket = io(API_BASE_URL, {
    auth: { token: tokens.accessToken },
    transports: ["websocket"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
