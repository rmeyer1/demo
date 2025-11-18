"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiClient, ApiError } from "@/lib/apiClient";
import type { Table } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

export default function LobbyPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [tableName, setTableName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [smallBlind, setSmallBlind] = useState(5);
  const [bigBlind, setBigBlind] = useState(10);
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");

  const { data: tables, isLoading } = useQuery({
    queryKey: ["tables"],
    queryFn: () => apiClient.get<Table[]>("/api/tables/my-tables"),
    enabled: !!user,
  });

  const handleCreateTable = async () => {
    if (!tableName.trim()) {
      setError("Table name is required");
      return;
    }

    try {
      const table = await apiClient.post<Table>("/api/tables", {
        name: tableName,
        maxPlayers,
        smallBlind,
        bigBlind,
      });
      setShowCreateModal(false);
      setTableName("");
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      router.push(`/table/${table.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create table");
    }
  };

  const handleJoinTable = async () => {
    if (!inviteCode.trim()) {
      setError("Invite code is required");
      return;
    }

    try {
      const table = await apiClient.post<{ tableId: string; name: string; maxPlayers: number; status: string }>(
        "/api/tables/join-by-code",
        { inviteCode: inviteCode.trim() }
      );
      setShowJoinModal(false);
      setInviteCode("");
      router.push(`/table/${table.tableId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to join table");
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login");
    }
  }, [authLoading, user, router]);

  if (authLoading || !user) {
    return <div className="text-center text-slate-400">Loading...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-slate-50">My Tables</h1>
        <div className="flex gap-4">
          <Button onClick={() => setShowJoinModal(true)}>Join Table</Button>
          <Button variant="primary" onClick={() => setShowCreateModal(true)}>
            Create Table
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center text-slate-400">Loading tables...</div>
      ) : tables && tables.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tables.map((table) => (
            <Card
              key={table.id}
              className="cursor-pointer hover:border-emerald-500 transition-colors"
              onClick={() => router.push(`/table/${table.id}`)}
            >
              <h3 className="text-xl font-semibold text-slate-50 mb-2">
                {table.name}
              </h3>
              <div className="space-y-1 text-sm text-slate-400">
                <p>Status: {table.status}</p>
                <p>Seats: {table.maxPlayers}</p>
                <p>Code: {table.inviteCode}</p>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <p className="text-center text-slate-400">
            No tables yet. Create one to get started!
          </p>
        </Card>
      )}

      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setTableName("");
          setError("");
        }}
        title="Create Table"
      >
        <div className="space-y-4">
          <Input
            label="Table Name"
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
            placeholder="Friday Night Poker"
          />
          <div className="grid grid-cols-3 gap-3">
            <Input
              type="number"
              label="Max Players"
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
              min={2}
              max={9}
            />
            <Input
              type="number"
              label="Small Blind"
              value={smallBlind}
              onChange={(e) => setSmallBlind(Number(e.target.value))}
              min={1}
            />
            <Input
              type="number"
              label="Big Blind"
              value={bigBlind}
              onChange={(e) => setBigBlind(Number(e.target.value))}
              min={1}
            />
          </div>
          {error && (
            <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}
          <div className="flex gap-4 justify-end">
            <Button
              variant="ghost"
              onClick={() => {
                setShowCreateModal(false);
                setTableName("");
                setError("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateTable}>Create</Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showJoinModal}
        onClose={() => {
          setShowJoinModal(false);
          setInviteCode("");
          setError("");
        }}
        title="Join Table"
      >
        <div className="space-y-4">
          <Input
            label="Invite Code"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="Enter invite code"
          />
          {error && (
            <div className="p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}
          <div className="flex gap-4 justify-end">
            <Button
              variant="ghost"
              onClick={() => {
                setShowJoinModal(false);
                setInviteCode("");
                setError("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleJoinTable}>Join</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
