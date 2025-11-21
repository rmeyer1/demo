import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Server, Socket } from "socket.io";

vi.mock("../../src/services/table.service", () => {
  return {
    getTableById: vi.fn(),
    activateSeat: vi.fn(),
    deleteTableStateFromRedis: vi.fn(),
    sitDown: vi.fn(),
    standUp: vi.fn(),
  };
});

vi.mock("../../src/services/game.service", () => {
  return {
    getPublicTableView: vi.fn(),
    ensureTableState: vi.fn(),
    applyPlayerAction: vi.fn(),
  };
});

import { tableHandlers } from "../../src/ws/table.handler";
import * as tableService from "../../src/services/table.service";
import * as gameService from "../../src/services/game.service";

describe("handleJoinTable", () => {
  const joinTable = tableHandlers.handleJoinTable;

  const mockSocket = () => {
    return {
      join: vi.fn(),
      emit: vi.fn(),
    } as unknown as Socket;
  };

  const mockIo = () => ({
    in: vi.fn().mockReturnValue({ fetchSockets: vi.fn().mockResolvedValue([]) }),
  }) as unknown as Server;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("reactivates a sitting-out seat on reconnect and refreshes state", async () => {
    const socket = mockSocket();
    const io = mockIo();

    (tableService.getTableById as vi.Mock).mockResolvedValue({
      id: "table-1",
      hostUserId: "user-1",
      inviteCode: "TEST123",
      seats: [
        { seatIndex: 0, userId: "user-1", isSittingOut: true, stack: 1000 },
        { seatIndex: 1, userId: "user-2", isSittingOut: false, stack: 1000 },
      ],
    });

    (tableService.activateSeat as vi.Mock).mockResolvedValue(true);
    (tableService.deleteTableStateFromRedis as vi.Mock).mockResolvedValue(undefined);
    (gameService.ensureTableState as vi.Mock).mockResolvedValue(undefined);
    (gameService.getPublicTableView as vi.Mock).mockResolvedValue({ tableId: "table-1", seats: [] });

    await joinTable(io, socket, { tableId: "table-1", inviteCode: "TEST123" }, "user-1");

    expect(tableService.activateSeat).toHaveBeenCalledWith("table-1", "user-1");
    expect(tableService.deleteTableStateFromRedis).toHaveBeenCalledWith("table-1");
    expect(gameService.ensureTableState).toHaveBeenCalledWith("table-1");
    // TABLE_STATE should be emitted to the reconnecting user
    expect(socket.emit).toHaveBeenCalledWith(
      "TABLE_STATE",
      expect.objectContaining({ tableId: "table-1" })
    );
  });
});
