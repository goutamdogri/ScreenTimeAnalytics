# Screen Time Deep Analytics & Gamification — Project Design Doc

## 1. Overview

A desktop application that tracks screen time at a **content-aware** level (not just "Chrome: 3 hours" but "YouTube: 40 min tutorials, 25 min Shorts"), categorizes activity by type and intentionality, visualizes it in depth, and drives behavior change through an RPG-style gamification layer.

**Platform target:** Ubuntu (X11) first, with provisions to add Wayland (GNOME) and Windows later without a rewrite.

**Core philosophy:** distinguish *what app* from *what content* from *how intentional the usage was* — this is what separates this from generic screen-time trackers.

---

## 2. Architecture

### 2.1 Stack
- **Shell:** Electron (cross-platform by default, satisfies "build once" goal for the UI/logic layer)
- **Frontend:** React + TypeScript + NativeWind/Tailwind
- **Backend/local service:** Node.js
- **Database:** PostgreSQL (local instance) for event storage and aggregation
- **Browser integration:** companion browser extension (Manifest V3) for tab-level content detection

### 2.2 Platform Adapter Pattern
All OS-specific capabilities sit behind one interface so the rest of the app never touches OS APIs directly:

```
interface PlatformAdapter {
  getActiveWindow(): { title: string; processName: string };
  onIdleChanged(callback): void;
  onMediaChanged(callback): void; // now-playing metadata
}
```

Implementations, selected at runtime via `$XDG_SESSION_TYPE` / `process.platform`:

| Adapter | Backend | Status |
|---|---|---|
| `X11Adapter` | `active-win` / `xdotool` for window info | **Build first** |
| `WaylandAdapter` | GNOME Shell extension exposing active-window over D-Bus (Wayland blocks cross-app window queries by design — no generic API exists) | Stubbed, future |
| `WindowsAdapter` | Win32 active window API + SMTC (`GlobalSystemMediaTransportControlsSessionManager`) for media | Stubbed, future |

**Media/now-playing is OS-native on both target platforms, no API keys or internet calls needed:**
- **Linux:** MPRIS over D-Bus — Spotify, browsers, VLC, YouTube Music all broadcast track metadata locally.
- **Windows:** SMTC — same concept, WinRT-based.

This means point 3 of the original spec (song/video listening detection) is actually the *most* OS-native, reliable part of the system.

### 2.3 Data Pipeline
```
Raw Events → Sessionization → Categorization → Intentionality Scoring → Aggregation → XP/Quest Engine → Dashboard
```

- **Raw events:** active-window changes, idle transitions, MPRIS media changes, browser tab/URL/title events from the extension
- **Sessionization:** merge raw events into continuous sessions per app/content item (handles rapid switching, brief interruptions)
- **Categorization:** rule layer first, ambiguous-content layer second (see Section 3)
- **Intentionality scoring:** per-session score based on duration vs. category norm, scroll velocity (from extension), time of day, fragmentation rate
- **Aggregation:** daily/weekly rollups feeding both dashboard and gamification engine

---

## 3. Content Categorization

### 3.1 Top-Level Categories
| Category | Primary Source | Examples |
|---|---|---|
| Deep Work | active window | VS Code, terminal, Obsidian, writing tools |
| Learning | window/tab rules + content layer | Coursera, docs, technical YouTube |
| Social Media | browser extension | Instagram, X, Reddit feed browsing |
| Short-form Video | browser extension | Reels, Shorts, TikTok-web |
| Long-form Video | browser extension + MPRIS | YouTube videos >4 min, Netflix |
| Music/Audio | MPRIS | Spotify, YouTube Music, podcasts |
| Communication | window/tab rules | Slack, Gmail, WhatsApp Web |
| Browsing/Research | browser extension | uncategorized domains |
| Idle/AFK | idle detection | screen on, no input |

### 3.2 Classification Pipeline
1. **Rule/whitelist layer** (instant, free): domain/app → category map, covers the large majority of traffic. Some domains need sub-rules (e.g. `youtube.com` splits into Learning vs Long-form vs Short-form based on content).
2. **Content-level layer** for ambiguous cases: browser extension sends only **URL + page title** (no DOM scraping needed) to an LLM classifier that assigns the sub-category. Results cached per URL so nothing is re-classified twice, keeping cost/latency minimal.

### 3.2.1 Long-form Video Sub-categorization

Long-form Video isn't left as a flat bucket — the same LLM classification step (URL + title) tags each video with a genre, using this default taxonomy:

| Sub-category | Examples |
|---|---|
| Educational/Tutorial | how-to, coding walkthroughs, courses |
| Documentary | long-form investigative/explainer content |
| Tech Review | product reviews, tech deep-dives |
| Entertainment/Comedy | sketches, comedy specials |
| Vlog/Lifestyle | personal vlogs, day-in-the-life |
| News/Commentary | news analysis, opinion/commentary channels |
| Podcast/Talk | long-form conversation/interview format |
| Music (long-form) | full albums, live performances, concerts |
| Other/Uncategorized | fallback when the LLM confidence is low |

This taxonomy lives in the same config-driven rule set as the top-level categories (Section 3.1), so it can be edited/extended later without touching the classification code — new sub-categories are just new entries the LLM prompt is told to choose from.

Each video's genre is stored per-session in the `sessions.sub_category` field (see Section 6), so dashboards can break "Long-form Video" time down by genre the same way Section 5 already breaks total time down by top-level category.

### 3.3 LLM Provider Configuration & Security

The content-level classifier is fully provider-agnostic, configurable in-app:

- **Local provider:** point at a local model server (e.g. Ollama, which is already part of your toolchain from GrammarSense) — no data leaves the machine, no API key needed.
- **Cloud provider:** select a provider (OpenAI, Anthropic, etc.) and specific model; requires an API key.

**API key handling — industry-standard local secret storage:**
- Keys are entered once via a settings UI and **never stored in plaintext**, never logged, never included in exported data or crash reports.
- Storage uses Electron's built-in `safeStorage` API, which encrypts data at rest using the OS's native credential store — **libsecret/GNOME Keyring on Ubuntu**, DPAPI on Windows when that adapter is added. This is the same mechanism used by mainstream Electron apps (VS Code, Slack) for local secret storage — no custom crypto, no reinventing key management.
- The encrypted key is stored in the local Postgres config table only as ciphertext; decryption happens in-memory at request time and the key is never written back to disk unencrypted.
- Provider/model selection and connection status are surfaced in Settings, with the ability to switch or clear the key at any time.

### 3.4 Intentionality Signals (computed, not manual)
- Session duration vs. category norm (a 90-second visit ≠ a 40-minute one)
- Scroll velocity / item-switch rate on feed-type content (proxy for doomscrolling)
- Time of day (late-night short-form is a strong autopilot signal)
- Session fragmentation (many rapid app switches = distracted, not intentional)

---

## 4. Gamification — RPG/XP System

### 4.1 Stats
Four tracked stats alongside a single Level/XP pool:
- **Focus** — from Deep Work sessions
- **Wisdom** — from Learning content
- **Discipline** — from streaks and staying under category budgets
- **Restraint** — rises when you actively resist doomscroll/short-form patterns, not merely from avoiding the app entirely

### 4.2 XP Mechanics
- Base XP per qualifying session (Deep Work requires a minimum uninterrupted length, e.g. 20 min, to prevent farming via short fake sessions)
- **Streak multiplier**, capped (e.g. 1.0x → 2.0x over 30 days)
- Daily/weekly quest completion grants bonus XP
- **No XP deduction for bad days** — instead a temporary debuff (reduced multiplier next session), so past progress is never erased, only momentum is slowed
- **Level curve (default, tunable):** exponential — XP required for level `N` = `100 × N^1.5` (rounded). Early levels come quickly to build momentum; later levels stretch out for long-term engagement. Treat the constant/exponent as a tuning parameter once real usage data exists, not a fixed decision.

### 4.3 Quests & Bosses
- **Daily quests**, auto-generated from personal usage patterns (e.g. "Complete 2 deep work sessions," "Short-form under 20 min")
- **Weekly boss fight**: an aggregate weekly target framed as a "doomscroll boss" whose HP drains as your Restraint stat rises over the week
- **Achievement badges**: one-time unlocks (7-day streak, 100 hrs deep work, etc.)

### 4.4 Currency & Cosmetics
- **Focus Coins** earned from XP milestones
- Spent on **cosmetic-only** unlocks (avatar items, dashboard themes) — deliberately non-functional so nothing is ever gated behind grinding on a tool built for self-improvement

### 4.5 Leaderboard
Single-user by nature — reframed as **"vs. your past self"**: weekly/monthly personal-best comparisons instead of social competition.

---

## 5. Visualization

- XP bar + level badge (persistent header element)
- 4-axis radar chart for Focus / Wisdom / Discipline / Restraint
- GitHub-style streak heatmap (daily goal completion over the year)
- Category budget rings (daily allowance vs. actual, per category)
- Session timeline/Gantt view of the day (visual replay of app switching)
- Weekly boss HP bar (ties directly into the gamification engine)
- Trend charts: category time over weeks/months, intentional vs. autopilot ratio over time

---

## 6. Data Model (high-level)

```
raw_events        (id, timestamp, source, app, window_title, url, event_type)
sessions          (id, start, end, app, category, sub_category, intentionality_score)
media_events       (id, session_id, track_title, artist, source_app, duration)
daily_rollups      (date, category, total_minutes, intentional_minutes)
xp_log             (id, timestamp, amount, source, stat_affected)
quests             (id, type[daily/weekly], criteria, status, reward_xp)
achievements       (id, name, unlocked_at)
user_state         (level, xp, focus, wisdom, discipline, restraint, coins, streak_count)
llm_config         (provider[local/cloud], model, encrypted_api_key, updated_at)
```

**Retention:** all data is kept **indefinitely by default** — nothing is auto-deleted or rolled up away. The UI provides a data-management view where the user can select date ranges, categories, or individual sessions and delete them manually; deletion is the only way data leaves the database.

---

## 7. Build Phases

1. **Phase 1 — Core tracking (X11 only):** `X11Adapter`, MPRIS listener, raw event capture, PostgreSQL schema, basic sessionization.
2. **Phase 2 — Categorization:** rule-based category mapping, browser extension for tab/content detection, intentionality scoring.
3. **Phase 3 — Dashboard:** visualizations from Section 5, using real aggregated data.
4. **Phase 4 — Gamification engine:** XP/stat calculation, quest generation, streak logic, boss-fight mechanics.
5. **Phase 5 — Content-level classifier:** ambiguous-content layer (rules + LLM fallback) for sub-categorizing titles.
6. **Phase 6 — Platform expansion:** Wayland (GNOME Shell extension) adapter, then Windows (SMTC + Win32) adapter — both isolated to the adapter layer, no rewrite of app logic.

---

## 8. Decisions Log

- **XP curve:** exponential default (`100 × N^1.5`), tunable after real usage data exists — see 4.2.
- **Content signals:** URL + page title only, no DOM scraping — see 3.2.
- **Classification method:** LLM-based, user-configurable local (e.g. Ollama) or cloud provider/model — see 3.3.
- **API key storage:** Electron `safeStorage` backed by OS credential store (libsecret on Ubuntu), never plaintext, never logged — see 3.3.
- **Data retention:** indefinite by default; manual selective deletion via UI — see Section 6.
