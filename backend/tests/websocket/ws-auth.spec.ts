import { test, expect } from "@playwright/test";
import WebSocket from "ws";

const wsUrl = process.env.WS_URL;
const token = process.env.API_BEARER_TOKEN;

test.describe("WebSocket Auth", () => {
  test.skip(!wsUrl, "WS_URL not set; skipping WS tests.");

  test("rejects connection without token", async () => {
    await expect(async () => {
      await openWs(`${wsUrl}`);
    }).rejects.toThrow();
  });

  test("connects with token", async () => {
    test.skip(!token, "API_BEARER_TOKEN not set; skipping authenticated WS test.");
    const socket = await openWs(`${wsUrl}?token=${token}`);
    socket.close();
  });
});

function openWs(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.on("open", () => resolve(socket));
    socket.on("error", (err) => reject(err));
  });
}
