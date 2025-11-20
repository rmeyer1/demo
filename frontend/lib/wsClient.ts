"use client";

import { io, Socket } from "socket.io-client";
import { supabase } from "./supabaseClient";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4000";

let socket: Socket | null = null;
let currentToken: string | null = null;

export async function getSocket(forceNew = false): Promise<Socket> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token || null;

  if (!token) {
    throw new Error("No authentication token available");
  }

  const tokenChanged = token !== currentToken;

  // Replace the socket only when forced or when auth token changed.
  if (!socket || forceNew || tokenChanged) {
    if (socket) {
      socket.disconnect();
    }
    socket = io(WS_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });
    currentToken = token;
    return socket;
  }

  // If an existing socket instance is temporarily disconnected, try to reconnect
  // instead of tearing it down so multiple hooks can share it safely.
  if (socket.disconnected) {
    socket.connect();
  }

  return socket;
}

export async function refreshAndReconnect(): Promise<Socket> {
  await supabase.auth.refreshSession();
  return getSocket(true);
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentToken = null;
  }
}
