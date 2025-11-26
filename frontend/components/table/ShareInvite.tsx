"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
// import { useToast } from "@/components/ui/use-toast"; // Assuming a toast component/hook - Commented out to fix build
import { apiClient, ApiError } from "@/lib/apiClient";

interface ShareInviteProps {
  tableId: string;
  inviteCode: string;
  tableName: string;
}

interface SendInviteResponse {
  results: Array<{ email: string; success: boolean; error?: string }>;
}

export function ShareInvite({ tableId, inviteCode, tableName }: ShareInviteProps) {
  // const { toast } = useToast(); // Commented out to fix build
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailsInput, setEmailsInput] = useState("");
  const [emailErrors, setEmailErrors] = useState<Record<string, string>>({});
  const [isSending, setIsSending] = useState(false);
  const [sendResults, setSendResults] = useState<Array<{ email: string; success: boolean; error?: string }>>([]);

  const handleCopyInviteCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      /*
      toast({
        title: "Copied!",
        description: "Invite code copied to clipboard.",
      });
      */ // Commented out to fix build
    } catch (err) {
      console.error("Failed to copy invite code: ", err);
      /*
      toast({
        title: "Copy Failed",
        description: "Could not copy invite code.",
        variant: "destructive",
      });
      */ // Commented out to fix build
    }
  };

  const validateEmails = (emailString: string) => {
    const emailArray = emailString.split(",").map((e) => e.trim()).filter(Boolean);
    const errors: Record<string, string> = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    emailArray.forEach((email) => {
      if (!emailRegex.test(email)) {
        errors[email] = "Invalid email format";
      }
    });
    setEmailErrors(errors);
    return Object.keys(errors).length === 0 ? emailArray : null;
  };

  const handleSendEmails = async () => {
    const validEmails = validateEmails(emailsInput);
    if (!validEmails || validEmails.length === 0) {
      /*
      toast({
        title: "Validation Error",
        description: "Please enter valid email addresses.",
        variant: "destructive",
      });
      */ // Commented out to fix build
      return;
    }

    setIsSending(true);
    setSendResults([]);
    try {
      const response = await apiClient.post<SendInviteResponse>(`/api/tables/${tableId}/send-invite`, {
        emails: validEmails,
      });
      setSendResults(response.results || []);
      /*
      toast({
        title: "Invitations Sent",
        description: "Email invitations have been processed.",
      });
      */ // Commented out to fix build
      setEmailsInput(""); // Clear input on success
      // setShowEmailModal(false); // Optionally close modal on success
    } catch (error) {
      console.error("Failed to send invite emails:", error);
      const message = error instanceof ApiError ? error.message : "Failed to send invite emails.";
      /*
      toast({
        title: "Error Sending Invites",
        description: message,
        variant: "destructive",
      });
      */ // Commented out to fix build
      setSendResults(
        validEmails.map((email) => ({
          email,
          success: false,
          error: "Failed to send due to server error.",
        }))
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="bg-slate-700 p-4 rounded-lg shadow-md">
      <h3 className="text-lg font-semibold text-white mb-3">Invite Players</h3>
      <div className="flex items-center space-x-2 mb-4">
        <Input
          readOnly
          value={inviteCode}
          className="flex-grow bg-slate-800 border-slate-600 text-amber-300 font-mono"
          aria-label="Invite Code"
        />
        <Button onClick={handleCopyInviteCode} variant="secondary">
          Copy
        </Button>
      </div>
      <p className="text-sm text-slate-300 mb-4">
        Share this code with friends to invite them to "{tableName}".
      </p>

      <Button onClick={() => setShowEmailModal(true)} className="w-full">
        Share via Email
      </Button>

      <Modal
        isOpen={!!showEmailModal}
        onClose={() => {
          if (!isSending) {
            setShowEmailModal(false);
            setEmailsInput("");
            setEmailErrors({});
            setSendResults([]);
          }
        }}
        title={`Invite to "${tableName}"}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            Enter email addresses (comma-separated) to send invitations.
          </p>
          <Input
            label="Recipient Emails"
            type="text"
            value={emailsInput}
            onChange={(e) => setEmailsInput(e.target.value)}
            placeholder="e.g., friend1@example.com, friend2@example.com"
            disabled={isSending}
          />
          {Object.keys(emailErrors).length > 0 && (
            <div className="rounded-md border border-red-700 bg-red-900/40 px-3 py-2 text-sm text-red-200">
              {Object.entries(emailErrors).map(([email, error]) => (
                <p key={email}>
                  {email}: {error}
                </p>
              ))}
            </div>
          )}

          {sendResults.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
              <p className="text-sm font-medium text-slate-200">Send Results:</p>
              {sendResults.map((result, index) => (
                <div key={index} className={`flex items-center justify-between text-sm ${ result.success ? "text-emerald-300" : "text-red-300"}`}>
                  <span>{result.email}</span>
                  <span>{result.success ? "Sent" : `Failed: ${result.error}`}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              onClick={() => {
                if (!isSending) {
                  setShowEmailModal(false);
                  setEmailsInput("");
                  setEmailErrors({});
                  setSendResults([]);
                }
              }}
              disabled={isSending}
            >
              Cancel
            </Button>
            <Button onClick={handleSendEmails} disabled={isSending}>
              {isSending ? "Sending..." : "Send Invites"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
