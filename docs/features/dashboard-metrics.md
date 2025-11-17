Here are the two full markdown docs, ready to drop into your repo:
## `/docs/specs/dashboard-metrics-spec.md`

````md
# Dashboard & Metrics Specification

This document defines the **metrics model**, **data sources**, **API**, and **UI behavior** for the Player Performance Dashboard.

The dashboard allows each user to see how they are performing over time across all tables they play on.

---

# 1. Goals & Scope

### Goals

- Give players **quantitative insight** into their poker performance.
- Provide **simple, clear** metrics derived from actual hands played.
- Support **time range filtering** (lifetime, last 7 days, last 30 days).
- Provide a **progression view** (graph) over time.

### Out of Scope (V1)

- Per-table or per-opponent breakdowns.
- Advanced positional stats (BTN, CO, etc.).
- Detailed hand replay / hand replayer UI.
- Export to CSV / external tools.

---

# 2. Data Sources

Metrics are computed from:

- `player_hands`
  - `net_chips`
  - `vpip_flag`
  - `pfr_flag`
  - `saw_showdown`
  - `won_showdown`
  - `table_id`, `hand_id`, `user_id`
  - `created_at`/time via related `hands` row or same timestamp
- `hands`
  - `created_at` / `completed_at`
  - `hand_number`
- Optionally `hand_actions` if needed for future advanced metrics.

No metrics are computed from client-side data; **all stats are server-derived** from DB.

---

# 3. Definitions & Formulas

All metrics are **per user**, filtered by a time range.

Let:

- `H` = set of all `player_hands` rows for user `U` within the selected time range.
- `N = |H|` = total number of hands.

## 3.1 Total Hands

`totalHands = N`

Number of hands in which the user was involved (sat at the table and was dealt cards).

---

## 3.2 Net Chips

`netChips = Σ (ph.net_chips for ph in H)`

- A positive value means the user has won net chips.
- A negative value means the user has lost net chips.
- Measured in the same chip units as blinds and stacks.

---

## 3.3 VPIP (Voluntarily Put $ In Pot)

VPIP = fraction of hands where the user voluntarily put chips into the pot preflop.

- `vpip_flag` is set to `true` if, in a given hand:
  - The user **voluntarily** invested chips preflop (not counting forced blinds).
  - Examples: calling a raise, opening, 3-betting, etc.

Formula:

`vpip = (number of ph in H where vpip_flag = true) / N`

Return as **decimal** (0–1) or formatted percentage in the API.

---

## 3.4 PFR (Preflop Raise)

PFR = fraction of hands where user made a **preflop raise**.

- `pfr_flag` is `true` if:
  - The user raised preflop in that hand at least once.

Formula:

`pfr = (number of ph in H where pfr_flag = true) / N`

---

## 3.5 Showdown Win Percentage

Showdown Win % = in how many showdowns the user won.

- `saw_showdown` is `true` if player saw showdown.
- `won_showdown` is `true` if player won (whole pot or share of pot) at showdown.

Let:
- `S = number of ph in H where saw_showdown = true`
- `W = number of ph in H where won_showdown = true`

If `S > 0`:

`showdownWinPct = W / S`

If `S = 0`, set `showdownWinPct = null` or `0` (we prefer `null` in API to indicate “not applicable”).

---

## 3.6 BB/100 (Big Blinds per 100 Hands)

BB/100 is a common poker metric for winrate normalized by blind size.

### 3.6.1 Simplest Approach (Global)

For V1 (simplest) we treat blinds as **equivalent** across tables. That is:

`bbPer100 = (netChips / bigBlindBaseline) / (N / 100)`

However, since tables can have different blinds, a more precise approach is:

### 3.6.2 Normalized per Table

For each player hand row:

- We know `table_id`.
- From `tables` we know `big_blind`.

For each `ph` in `H`:

- Contribution to BB units: `ph.net_chips / table.big_blind`.

Let:

`BB_total = Σ (ph.net_chips / table.big_blind for ph in H)`

Then:

`bbPer100 = BB_total / (N / 100)`

If `N < 20`, we may mark BB/100 as **low-confidence** in the UI (optional).

---

# 4. Time Ranges

Supported time ranges:

- `"lifetime"`: all hands since user joined.
- `"7d"`: last 7 days (relative to `now()`).
- `"30d"`: last 30 days.

Filter based on `hands.completed_at` (or `hands.created_at`):

```sql
where hand.completed_at >= now() - interval '7 days'
````

for example.

---

# 5. Metrics API

### 5.1 Summary Endpoint

`GET /api/dashboard/summary?range=<range>`

* `range` ∈ `"lifetime" | "7d" | "30d"`
* Default: `"lifetime"`

**Response 200:**

```json
{
  "range": "30d",
  "totalHands": 320,
  "netChips": 1450,
  "vpip": 0.32,
  "pfr": 0.18,
  "showdownWinPct": 0.56,
  "bbPer100": 3.4
}
```

If there is insufficient data for a metric (e.g., no showdowns), set that field to `null`.

---

### 5.2 Progression Endpoint

`GET /api/dashboard/progression?range=<range>&groupBy=<groupBy>`

* `range` ∈ `"lifetime" | "7d" | "30d"` (default: `"lifetime"`)
* `groupBy` ∈ `"day" | "hand"` (default: `"day"`)

#### 5.2.1 groupBy = "day"

Combine hands by calendar day:

```json
{
  "range": "30d",
  "groupBy": "day",
  "points": [
    { "date": "2025-11-01", "netChips": -200 },
    { "date": "2025-11-02", "netChips": 150 },
    { "date": "2025-11-03", "netChips": 300 }
  ]
}
```

Where each `netChips` is **cumulative net** up to that day, or **per-day net**:

* We recommend **cumulative** net chips over time for a smoother chart:

  * `netChips` at date D = sum of all `net_chips` from start of range to D.

#### 5.2.2 groupBy = "hand"

Return a series keyed by hand number index (useful for smaller ranges):

```json
{
  "range": "7d",
  "groupBy": "hand",
  "points": [
    { "handIndex": 1, "netChips": 20 },
    { "handIndex": 2, "netChips": -40 },
    { "handIndex": 3, "netChips": 100 }
  ]
}
```

Here `handIndex` is local to the returned result (1..N).
`netChips` is **cumulative** net up to that hand.

---

# 6. Database Queries (Conceptual)

### 6.1 Summary

Pseudo-SQL:

```sql
with hands_in_range as (
  select ph.*
  from player_hands ph
  join hands h on h.id = ph.hand_id
  where ph.user_id = :userId
    and (
      :range = 'lifetime'
      or h.completed_at >= (now() - interval '7 days') and :range = '7d'
      or h.completed_at >= (now() - interval '30 days') and :range = '30d'
    )
),
stats as (
  select
    count(*) as total_hands,
    coalesce(sum(net_chips), 0) as net_chips,
    sum(case when vpip_flag then 1 else 0 end) as vpip_hands,
    sum(case when pfr_flag then 1 else 0 end) as pfr_hands,
    sum(case when saw_showdown then 1 else 0 end) as showdown_hands,
    sum(case when won_showdown then 1 else 0 end) as showdown_wins
  from hands_in_range
)
select * from stats;
```

Then compute:

* `vpip = vpip_hands / total_hands` (if `total_hands > 0`)
* `pfr = pfr_hands / total_hands`
* `showdownWinPct = showdown_wins / showdown_hands` (if `showdown_hands > 0`).

BB/100 uses a joined table for blinds:

```sql
select
  sum(ph.net_chips::float / t.big_blind) as bb_total,
  count(*) as total_hands
from hands_in_range ph
join tables t on t.id = ph.table_id
...
```

`bbPer100 = bb_total / (total_hands / 100.0)`.

---

# 7. Frontend Dashboard UI

Located at: `/dashboard`

### 7.1 Layout

* Top:

  * **Range selector**: `Lifetime | Last 30 days | Last 7 days`
* Middle:

  * **Summary cards** for:

    * Total hands
    * Net chips
    * VPIP
    * PFR
    * Showdown %
    * BB/100
* Bottom:

  * **Progression chart** (line chart) showing net chips over time.

### 7.2 Behavior

* On load:

  * Call `GET /api/dashboard/summary?range=lifetime`
  * Call `GET /api/dashboard/progression?range=lifetime&groupBy=day`
* On range change:

  * Re-fetch both endpoints.
* Handle missing metrics (e.g., `showdownWinPct = null`) by:

  * Displaying `—` or `N/A`.

---

# 8. Performance & Caching

### 8.1 Performance

* For most users, `player_hands` size per range is modest.
* Use indexes on:

  * `player_hands.user_id`
  * `hands.completed_at`
* Use `LIMIT` and `ORDER BY` when querying progression data if necessary.

### 8.2 Caching (Optional)

* HTTP caching possible for `/api/dashboard/summary` and `/api/dashboard/progression` with short TTL (e.g., 10–30 seconds).
* For heavy traffic, consider adding a `user_stats` aggregated table and updating it on each hand completion.

---

# 9. Testing

### 9.1 Unit Tests

* Test metrics functions with:

  * No hands
  * One hand
  * Multiple hands, mix of wins/losses
  * Mixed blinds for BB/100

### 9.2 Integration Tests

* Insert synthetic data into `hands` and `player_hands`.
* Assert the dashboard endpoints produce expected JSON.

### 9.3 Edge Cases

* `N = 0` (no hands): all metrics `0` or `null`, no crash.
* All negative `net_chips`: metrics still computed.
* Only preflop folds: VPIP and PFR both `0`.

---

# 10. Summary

The Dashboard & Metrics system:

* Relies entirely on server-side data.
* Exposes clear, well-defined endpoints.
* Uses standard poker metrics (VPIP, PFR, BB/100).
* Provides both snapshot and progression views.
* Can scale via simple indexing and optional aggregated tables.

This document is the authoritative contract for all metrics-related behavior and endpoints.

````