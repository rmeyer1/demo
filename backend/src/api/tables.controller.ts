import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { authenticate, AuthenticatedRequest } from "../middleware/auth";
import {
  createTable,
  getTableById,
  getTableByInviteCode,
  getUserTables,
  sitDown,
  standUp,
  sendInviteEmails, // Added this import
} from "../services/table.service";

const createTableSchema = z.object({
  name: z.string().min(1),
  maxPlayers: z.number().int().min(2).max(9),
  smallBlind: z.number().int().positive(),
  bigBlind: z.number().int().positive(),
});

const joinByCodeSchema = z.object({
  inviteCode: z.string().min(1),
});

const sitDownSchema = z.object({
  seatIndex: z.number().int().min(0),
  buyInAmount: z.number().int().positive(),
});

// New schema for sending invite emails
const sendInviteEmailsSchema = z.object({
  emails: z.array(z.string().email()).min(1),
});

export async function registerTableRoutes(app: FastifyInstance) {
  // Create table
  app.post(
    "/",
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const userId = req.userId;

      const body = createTableSchema.parse(request.body);

      if (body.bigBlind <= body.smallBlind) {
        return reply.status(400).send({
          error: {
            code: "INVALID_BLINDS",
            message: "Big blind must be greater than small blind.",
          },
        });
      }

      try {
        const table = await createTable({
          name: body.name,
          maxPlayers: body.maxPlayers,
          smallBlind: body.smallBlind,
          bigBlind: body.bigBlind,
          hostUserId: userId,
          hostEmail: req.userEmail,
        });

        return reply.status(201).send({
          id: table.id,
          hostUserId: table.hostUserId,
          name: table.name,
          inviteCode: table.inviteCode,
          maxPlayers: table.maxPlayers,
          smallBlind: table.smallBlind,
          bigBlind: table.bigBlind,
          status: table.status,
          createdAt: table.createdAt.toISOString(),
        });
      } catch (error) {
        return reply.status(500).send({
          error: {
            code: "INTERNAL_ERROR",
            message: "Failed to create table.",
          },
        });
      }
    }
  );

  // Get table by ID
  app.get(
    "/:id",
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const userId = req.userId;
      const params = request.params as { id: string };
      const query = request.query as { inviteCode?: string };
      const table = await getTableById(params.id);

      if (!table) {
        return reply.status(404).send({
          error: {
            code: "TABLE_NOT_FOUND",
            message: "Table does not exist.",
          },
        });
      }

      const isHost = table.hostUserId === userId;
      const isMember = table.seats.some((s) => s.userId === userId);
      const hasValidInvite = query.inviteCode && query.inviteCode === table.inviteCode;

      if (!isHost && !isMember && !hasValidInvite) {
        return reply.status(403).send({
          error: {
            code: "NOT_IN_TABLE",
            message: "You are not a member of this table.",
          },
        });
      }

      return reply.send({
        id: table.id,
        hostUserId: table.hostUserId,
        name: table.name,
        // Only expose inviteCode to the host
        ...(isHost && { inviteCode: table.inviteCode }),
        maxPlayers: table.maxPlayers,
        smallBlind: table.smallBlind,
        bigBlind: table.bigBlind,
        status: table.status,
        createdAt: table.createdAt.toISOString(),
        seats: table.seats.map((seat) => ({
          seatIndex: seat.seatIndex,
          userId: seat.userId,
          displayName: seat.displayName,
          stack: seat.stack,
          isSittingOut: seat.isSittingOut,
        })),
      });
    }
  );

  // Get user's tables
  app.get(
    "/my-tables",
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const userId = req.userId;

      const query = request.query as { limit?: string; offset?: string };
      const limit = query.limit ? parseInt(query.limit, 10) : 20;
      const offset = query.offset ? parseInt(query.offset, 10) : 0;

      const tables = await getUserTables(userId, limit, offset);

      return reply.send(
        tables.map((table: any) => ({
          id: table.id,
          name: table.name,
          status: table.status,
          maxPlayers: table.maxPlayers,
          smallBlind: table.smallBlind,
          bigBlind: table.bigBlind,
          hostUserId: table.hostUserId,
          createdAt: table.createdAt.toISOString(),
        }))
      );
    }
  );

  // Join table by invite code
  app.post(
    "/join-by-code",
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = joinByCodeSchema.parse(request.body);
      const table = await getTableByInviteCode(body.inviteCode);

      if (!table) {
        return reply.status(404).send({
          error: {
            code: "TABLE_NOT_FOUND",
            message: "Invalid invite code.",
          },
        });
      }

      return reply.send({
        tableId: table.id,
        name: table.name,
        maxPlayers: table.maxPlayers,
        status: table.status,
      });
    }
  );

  // Send invite emails
  app.post(
    "/:id/send-invite",
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const userId = req.userId;
      const params = request.params as { id: string };
      const { emails } = sendInviteEmailsSchema.parse(request.body);

      try {
        const results = await sendInviteEmails(params.id, userId, emails);
        return reply.status(200).send({
          message: "Invite emails processed.",
          results,
        });
      } catch (error: any) {
        if (error.message.includes("Table not found")) {
          return reply.status(404).send({
            error: {
              code: "TABLE_NOT_FOUND",
              message: "Table does not exist.",
            },
          });
        }
        if (error.message.includes("Unauthorized")) {
          return reply.status(403).send({
            error: {
              code: "UNAUTHORIZED",
              message: "You are not authorized to send invites for this table.",
            },
          });
        }
        // Catch-all for other errors, including rate limiting from service
        return reply.status(500).send({
          error: {
            code: "INTERNAL_ERROR",
            message: error.message || "Failed to send invite emails.",
          },
        });
      }
    }
  );

  // Sit down
  app.post(
    "/:id/sit-down",
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const userId = req.userId;
      const params = request.params as { id: string };
      const body = sitDownSchema.parse(request.body);

      try {
        const result = await sitDown(params.id, userId, body.seatIndex, body.buyInAmount);

        return reply.send({
          tableId: result.tableId,
          seatIndex: result.seatIndex,
          userId: result.userId,
          displayName: result.displayName,
          stack: result.stack,
          isSittingOut: result.isSittingOut,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "UNKNOWN_ERROR";
        const statusCode =
          errorMessage === "INVALID_SEAT" || errorMessage === "SEAT_TAKEN" || errorMessage === "INVALID_BUYIN"
            ? 400
            : 500;

        return reply.status(statusCode).send({
          error: {
            code: errorMessage,
            message: errorMessage,
          },
        });
      }
    }
  );

  // Stand up
  app.post(
    "/:id/stand-up",
    { preHandler: authenticate },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const req = request as AuthenticatedRequest;
      const userId = req.userId;
      const params = request.params as { id: string };

      try {
        const result = await standUp(params.id, userId);

        return reply.send({
          tableId: result.tableId,
          seatIndex: result.seatIndex,
          remainingStack: result.remainingStack,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "UNKNOWN_ERROR";
        const statusCode = errorMessage === "NOT_SEATED" ? 400 : 500;

        return reply.status(statusCode).send({
          error: {
            code: errorMessage,
            message: errorMessage,
          },
        });
      }
    }
  );
}