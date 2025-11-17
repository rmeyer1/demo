# `/docs/specs/chat-system-spec.md`

````md
# Chat System Specification

This document defines the **complete technical specification** for the chat system integrated into the Texas Hold’em Home Game platform.

Chat is used to let players communicate in real time while sitting at a table.

---

# 1. Chat System Architecture

Chat uses a hybrid approach:

### Real-time layer → **WebSocket**
- Low-latency broadcast
- Used for sending messages during an active session
- Uses `CHAT_SEND` (client → server) and `CHAT_MESSAGE` (server → clients)

### Persistence layer → **Supabase Postgres**
- All chat messages are stored permanently
- Used for history (retrieved via REST)
- Allows pagination, moderation, metrics

### Optional scaling layer → **Redis**
- Not required for logic, but backend instances may use Redis pub/sub to fan messages out

---

# 2. Chat Entities

### Database table:
`chat_messages`

Fields:
- `id` (uuid)
- `table_id` (uuid)
- `user_id` (uuid)
- `seat_index` (nullable)
- `content` (text)
- `created_at` (timestamp)

(See `/docs/architecture/database-schema.md` for full DDL.)

---

# 3. Functional Requirements

### ✔ Players may send chat messages only when:
- They are authenticated
- They have joined the table via `JOIN_TABLE`

### ✔ Chat messages must:
- Be broadcasted to all others at the table
- Be persisted in DB
- Include seat name and timestamp
- Appear instantly without page refresh

### ✔ Chat should support:
- Inline timestamps
- Auto-scroll to bottom
- Moderation tools later (future extension)

### ✔ Mandatory filtering rules:
- Max length: **256 characters**
- Strip/escape HTML
- Remove zero-width characters if desired
- Remove leading/trailing whitespace

### ✔ Rate limiting (recommended)
- Max 5 messages per 5 seconds per user
- Excess messages dropped with an `ERROR` event

---

# 4. WebSocket Messages

Messages follow the WebSocket protocol:  
`/docs/specs/websocket-protocol.md`

### 4.1 Client → Server: `CHAT_SEND`

```json
{
  "type": "CHAT_SEND",
  "tableId": "table-uuid",
  "content": "Nice hand!"
}
````

Validation:

* `content` must be a non-empty string
* ≤ 256 characters
* User must be eligible to view `tableId` (membership check)
* Backend replaces disallowed characters and trims whitespace

On success:

1. Insert message into `chat_messages` DB
2. Broadcast `CHAT_MESSAGE` to room `table:<tableId>`

---

### 4.2 Server → Client: `CHAT_MESSAGE`

```json
{
  "type": "CHAT_MESSAGE",
  "tableId": "table-uuid",
  "message": {
    "id": "msg-uuid",
    "userId": "user-uuid",
    "displayName": "Rob",
    "seatIndex": 3,
    "content": "Nice hand!",
    "createdAt": "2025-11-16T20:05:00Z"
  }
}
```

Notes:

* The frontend displays `displayName` as the primary identity.
* Seat index may change during session (player moving seats), but the message logs the seat at time of message.

---

### 4.3 Server → Client: Chat Errors

Example:

```json
{
  "type": "ERROR",
  "code": "CHAT_RATE_LIMIT",
  "message": "Too many messages. Please slow down."
}
```

Or:

```json
{
  "type": "ERROR",
  "code": "CHAT_INVALID",
  "message": "Chat content is empty or too long."
}
```

---

# 5. REST API for Chat History

REST endpoints defined in:
`/docs/specs/rest-api-spec.md`

### 5.1 `GET /api/tables/:id/chat`

Returns the **recent N messages**, sorted by timestamp.

Example:

```json
[
  {
    "id": "msg-uuid",
    "userId": "user-uuid",
    "displayName": "Rob",
    "seatIndex": 3,
    "content": "Let's go!",
    "createdAt": "2025-11-16T19:59:00Z"
  }
]
```

### Query parameters:

* `limit`: default 50, max 200
* `before`: (optional) for pagination

---

# 6. Backend Chat Service

Backend manages all chat logic through `chat.service.ts`.

### Responsibilities

* Validate chat content
* Validate table membership
* Insert message into DB
* Return canonical message object
* Broadcast via WebSocket gateway
* Optional:

  * Rate-limiting per user/session
  * Profanity filtering
  * Anti-spam throttling

### Pseudocode

```ts
async function handleChatSend(userId, tableId, content) {
  if (!validateMembership(userId, tableId)) throw ChatError("NOT_IN_TABLE");

  const cleanContent = sanitize(content);

  if (cleanContent.length === 0 || cleanContent.length > 256) {
    throw ChatError("CHAT_INVALID");
  }

  enforceRateLimit(userId);

  const seat = await seatService.getSeatAtTable(userId, tableId);

  const msg = await db.chatMessage.create({
    data: {
      tableId,
      userId,
      seatIndex: seat?.seatIndex ?? null,
      content: cleanContent,
    },
  });

  websocket.broadcast(`table:${tableId}`, {
    type: "CHAT_MESSAGE",
    tableId,
    message: formatChatMessage(msg),
  });

  return msg;
}
```

---

# 7. Frontend Responsibilities

### The client must:

* Maintain WebSocket connection as long as the table page is open
* Render chat in a scrollable panel
* Style messages by seat color, if applicable
* Scroll to bottom on new message (unless user is reading history manually)
* Listen to:

  * `CHAT_MESSAGE`
  * `ERROR` (chat-specific failures)
* Send:

  * `CHAT_SEND` on user submit

### Example UI state hook

```ts
function useChat(tableId) {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    socket.on("CHAT_MESSAGE", (msg) => {
      if (msg.tableId === tableId) {
        setMessages((prev) => [...prev, msg.message]);
      }
    });

    return () => socket.off("CHAT_MESSAGE");
  }, [tableId]);

  return { messages };
}
```

---

# 8. Moderation & Safety (Future Enhancements)

### Optional future capabilities:

* Blocked words dictionary
* User mute or block per-table
* Temporal message expiration (auto-cleanup)
* Moderator flagging
* Bulk deletion of chat history
* AI-powered toxicity filtering
* Logging/reporting system for abuse

These are not required for V1.

---

# 9. Performance Considerations

### Expected message volume:

* Light compared to gameplay updates
* Most tables produce < 100 messages per hour

### DB considerations:

* Indexing by `(table_id, created_at)` ensures fast paginated history queries

### WS considerations:

* Messages should be small (<1KB)
* Compression not required but can be enabled via Socket.IO

---

# 10. Summary

The chat system provides:

* Instant realtime communication (WS-based)
* Persisted message history (REST-based)
* Secure authentication via Supabase
* 256-char sanitized messages
* Seamless integration with table UI
* Scalable architecture suitable for hundreds of concurrent tables

This specification defines the full behavior and API for chat within the poker platform.
