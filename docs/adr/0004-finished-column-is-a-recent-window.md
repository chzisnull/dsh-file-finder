# ADR 0004 — The finished column is a recent window, not an unread inbox

Status: accepted (0.15.0). Amends ADR 0002 (three columns) and ADR 0003
(the unread rename and the rejection of idle sessions in the columns).

## Context

ADR 0003 renamed the status board's third column from "已完成" to "已结束·未读"
and moved historical sessions to the Recent tab, because `completionUnread` is
the only completion-shaped fact DSH exposes. That rename was honest, but the
column emptied itself in the two normal cases: the user opened the finished
session, or the page reloaded. The place the user looks for "what just
finished?" then showed "this column is empty" while the work had, in fact, just
finished. The Recent tab does answer that question, but it is a second tab
behind a different entry, and it mixes running and idle sessions by design.

The user's feedback was direct: stop showing only unread in that column; show
the five most recently completed sessions instead. Any implementation has to
accept that DSH keeps no completion timestamp and no success flag, so
"completed" can only mean "ended, ranked by the newest fact the plugin has".

## Decision

The Status board's finished column becomes a **recent window over every ended
session**:

- **Rows.** Every session whose state is finished-unread or idle — i.e. nothing
  is awaiting the user and nothing is running, including the whole subagent
  tree. Read and unread sessions are treated alike; this is what "not only
  unread" means.
- **Order.** The newest of the plugin's Activity time, its Access time and
  DSH's session summary time — the same ranking the Recent tab already uses.
  The summary time is the fallback when the host has no record of the session,
  and the row keeps the Recent tab's "~" marker for it. Ordering on
  `updatedAt` alone was rejected: it only moves on a human prompt, so a long run
  that just ended would rank below a session with a fresher prompt.
- **Cap.** The five newest. The column is an attention surface, not a history
  list; five cards answer "what just finished?" without turning it into a
  second Recent tab.
- **Count.** The column header counts the cards it lists (at most five), not
  every ended session, and shows no "in total" line. A total over every ended
  session would be a large, static number the user cannot act on — exactly the
  counter ADR 0003 rejected.
- **Labels.** The status column is "已结束"/"Finished". The sidebar pill and the
  Recent tab's row state keep "已结束·未读"/"Finished · unread", because those
  still report DSH's unread fact and nothing else.
- **Data.** The status board reads the existing host session-activity route
  once per open (the Recent tab already reads it and still polls it). No new
  storage domain, record field, route or schema version is introduced; a failed
  or missing read falls back to the summary time already shown for such rows.

## Consequences

- The Status board's third column is no longer purely "what needs me now": it
  deliberately mixes the unread attention fact with recent, already-read work.
  The sidebar count keeps the attention meaning separate, so a zero pill next
  to a populated column is expected and both are accurate.
- "Completed" here is a recency proxy, not a success claim and not a
  completion log: read state and task outcome still cannot be restored across
  a restart, and a session that ended long ago is not listed at all.
- Subagents still never own rows; their activity ranks the session they belong
  to, through the same rollup.
- No new rendering surface, shortcut or setting is added; the Recent tab is
  unchanged.
- Rejected: **counting every ended session in the sidebar** — a permanently
  large, actionless number.
- Rejected: **adding a sixth "recently finished" column or a third tab** — the
  board would lose its one-state-per-column story and duplicate Recent.
- Rejected: **tracking a durable per-session completion time on the host** —
  the turns already recorded in the activity domain give the same recency for
  this window without a schema migration.
