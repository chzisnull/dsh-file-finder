# ADR 0003 — Recent sessions beside the Status board

Status: accepted (0.14.0). The finished column's copy is amended by ADR 0004:
the status column now lists a recent window of ended sessions; the
"finished · unread" name still applies to the sidebar count and to a recent
row's state label.

## Context

ADR 0002 put a three-state board inside the plugin: awaiting the user, running,
and finished unread. Those columns answer "what needs me now". They deliberately
drop anything idle, so a session that finished and was read, or one the user
simply wants to return to, has no row anywhere. When all three counts are zero
the board has nothing to show, and the only way in was ⇧⌘G; either way it could
not answer "where was that session I worked in yesterday?".

The obvious source, DSH's own session list, is not enough for that question.
DSH exposes no completion time, and its session summary timestamp only advances
for a prompt the user typed, so an Agent's work after that prompt leaves it
unchanged. It exposes no record of when the user last opened a session either. A
list ordered on it alone would put a session whose Agent just finished below one
that merely has a newer prompt, would put a recently visited but quiet session
below an untouched one, and could not label its time honestly. The "已完成"
column name made the confusion worse: it read as a record of successful work,
while it only means "a background run ended and the user has not looked at it",
and it is cleared by opening the session or reloading the page.

## Decision

The Session board gains a second peer tab, **Recent sessions**, beside the
Status board. It is the same dialog and the same session facts, not a separate
window, a new shortcut, or a fourth column.

- **One record per session**, across every workspace of the current DSH
  instance. Blank placeholders, archived sessions and subagent sessions are
  excluded; idle sessions are kept, because finding them again is the point.
- **Ordered by the newest of three facts**: the plugin's Activity time, its
  Access time, and DSH's session summary time. The summary time is marked as
  approximate — "约"/"~" — because it is not a completion or success time.
- **The plugin persists the first two on the host**, so the order survives a
  restart. They are the plugin's own records, not a DSH-native session state and
  not a second session store.
- **The finished column is renamed** from "已完成" to "已结束·未读" (Finished ·
  unread) in both the Status board and the sidebar counts, to say what it
  actually is: an unread end, not a successful or historical completion.
- **The sidebar foot gains a Recent entry** that opens the Recent tab, and stays
  usable when all three counts are zero. The count pills and ⇧⌘G still open the
  Status board.
- **The first page is 50 records** with a show-more action; search covers title
  and workspace of every eligible session, not only the visible page.
- **Nothing opens at startup.** If the host activity read fails, the tab says so;
  records without a persisted time fall back to the approximate summary time
  instead of presenting that fallback as a persisted fact.

## Consequences

- Recent answers "find that session again", not "did the task succeed". Read
  state and task outcome cannot be restored across a restart, and an access made
  while the page was not loaded cannot be observed: the list is explicitly
  approximate at those edges. The first main view restored at startup is not
  counted as a visit.
- The board still ships with its existing three switches; turning the main one
  off removes both tabs, the counts, the Recent entry and the shortcut together.
  It does not stop or erase the host-side recording while the plugin itself is
  loaded: turning the board back on finds the times that were gathered meanwhile.
- The open Recent tab refreshes the host activity on a slow poll, because DSH
  exposes no client observable for "the Agent did something in a session you are
  not watching"; that read is bounded and stays off the token stream.
- The plugin now owns a small persistence contract for activity and access
  times. It stays a cache of plugin facts next to DSH's sessions, never a
  replacement for them, and a missing or failed host read stays visible.
- No new key binding is added. Discoverability comes from the sidebar, which
  also means the Recent tab is reachable when the counts are all zero.
- Rejected: **putting idle sessions into the three columns**. The columns name
  things the user can act on, and an idle session belongs to none of them; a
  fourth column would also contradict "one state per session" and turn the
  unread column into a mixed list.
- Rejected: **treating the unread marker as history**. DSH clears it when the
  session is viewed or the page reloads, so it cannot be a completion record.
- Rejected: **ordering on DSH's summary timestamp alone**. It only moves on a
  human prompt, so it misses everything the Agent did afterwards, it carries no
  visit information, and it has no completion meaning; the resulting order would
  be misleading and the time would be mislabelled.
