import { test, expect } from "@playwright/test";
import WebSocket from "ws";

const wsUrl = process.env.WS_URL;
const token = process.env.API_BEARER_TOKEN;
const tableId = process.env.API_TEST_TABLE_ID;

test.describe("WebSocket Table Flow", () => {
  test.skip(!wsUrl || !token || !tableId, "WS_URL, API_BEARER_TOKEN, or API_TEST_TABLE_ID not set.");

  test("join table then leave", async () => {
    const socket = await openWs(`${wsUrl}?token=${token}`);

    const messages: any[] = [];
    socket.on("message", (data) => messages.push(JSON.parse(data.toString())));

    socket.send(
      JSON.stringify({
        type: "JOIN_TABLE",
        tableId,
      })
    );

    await waitFor(() => messages.some((m) => m.type === "TABLE_JOINED"), 5000);

    socket.send(JSON.stringify({ type: "LEAVE_TABLE", tableId }));
    socket.close();

    expect(messages.some((m) => m.type === "TABLE_JOINED")).toBe(true);
  });
});

function openWs(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.on("open", () => resolve(socket));
    socket.on("error", (err) => reject(err));
  });
}

async function waitFor(check: () => boolean, timeoutMs: number) {
  const start = Date.now();
  return new Promise<void>((resolve, reject) => {
    const interval = setInterval(() => {
      if (check()) {
        clearInterval(interval);
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        reject(new Error("Timeout waiting for condition"));
      }
    }, 50);
  });
}
