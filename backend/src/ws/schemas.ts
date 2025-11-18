import { z } from "zod";

const uuid = () =>
  z
    .string()
    .uuid({ message: "INVALID_UUID" });

export const joinTableSchema = z.object({
  tableId: uuid(),
});

export const leaveTableSchema = z.object({
  tableId: uuid(),
});

export const sitDownSchema = z.object({
  tableId: uuid(),
  seatIndex: z.number().int().nonnegative(),
  buyInAmount: z.number().int().positive(),
});

export const standUpSchema = z.object({
  tableId: uuid(),
});

export const playerActionSchema = z.object({
  tableId: uuid(),
  handId: uuid(),
  action: z.enum(["FOLD", "CHECK", "CALL", "BET", "RAISE", "ALL_IN"]),
  amount: z.number().int().nonnegative().optional(),
});

export const chatSendSchema = z.object({
  tableId: uuid(),
  content: z.string().min(1).max(256),
});

export const gameStartSchema = z.object({
  tableId: uuid(),
});

export type JoinTableInput = z.infer<typeof joinTableSchema>;
export type LeaveTableInput = z.infer<typeof leaveTableSchema>;
export type SitDownInput = z.infer<typeof sitDownSchema>;
export type StandUpInput = z.infer<typeof standUpSchema>;
export type PlayerActionInput = z.infer<typeof playerActionSchema>;
export type ChatSendInput = z.infer<typeof chatSendSchema>;
export type GameStartInput = z.infer<typeof gameStartSchema>;
