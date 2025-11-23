import { describe, it, expect, vi } from "vitest";

vi.mock("bullmq", () => {
  const add = vi.fn();
  const Queue = vi.fn(() => ({ add }));
  return { Queue, add };
});

import { enqueueTurnTimeout, enqueueAutoStart } from "../../../src/queue/queues";
import { add as mockAdd } from "bullmq";

describe("queue jobIds", () => {
  it("does not include colon in turn-timeout jobId", async () => {
    mockAdd.mockResolvedValueOnce({});
    await enqueueTurnTimeout(
      { tableId: "table-123", handId: "hand-abc", seatIndex: 5 },
      1000
    );
    expect(mockAdd).toHaveBeenCalledWith(
      "turn-timeout",
      { tableId: "table-123", handId: "hand-abc", seatIndex: 5 },
      expect.objectContaining({
        jobId: "table-123|hand-abc|5",
      })
    );
  });

  it("does not include colon in auto-start jobId", async () => {
    mockAdd.mockResolvedValueOnce({});
    await enqueueAutoStart({ tableId: "table-123" }, 500);
    expect(mockAdd).toHaveBeenCalledWith(
      "auto-start",
      { tableId: "table-123" },
      expect.objectContaining({
        jobId: "auto-start|table-123",
      })
    );
  });
});
