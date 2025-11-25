import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ShareByEmailDialog } from "./ShareByEmailDialog"; // Will create this next

interface InviteCodeDisplayProps {
  inviteCode: string;
  tableName: string;
  isHost: boolean;
  tableId: string;
}

export const InviteCodeDisplay: React.FC<InviteCodeDisplayProps> = ({
  inviteCode,
  tableName,
  isHost,
  tableId,
}) => {
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const handleCopyClick = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopySuccess("Copied!");
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      setCopySuccess("Failed to copy");
      setTimeout(() => setCopySuccess(null), 2000);
      console.error("Failed to copy invite code: ", err);
    }
  };

  if (!isHost) {
    return null;
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-2 mt-4 p-3 bg-slate-700 rounded-md shadow">
      <span className="text-slate-300 text-sm font-medium mr-2">Invite Code:</span>
      <Input
        type="text"
        value={inviteCode}
        readOnly
        className="flex-grow text-center font-bold text-lg bg-slate-800 border-slate-600 focus:ring-emerald-500"
      />
      <Button onClick={handleCopyClick} className="shrink-0">
        {copySuccess || "Copy"}
      </Button>
      <Button onClick={() => setIsShareModalOpen(true)} className="shrink-0">
        Share via Email
      </Button>

      <ShareByEmailDialog
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        tableId={tableId}
        tableName={tableName}
        inviteCode={inviteCode}
      />
    </div>
  );
};
