Dispatch one read-only subagent per question step 1b printed, **all of them together in one
message** — with no cap beyond one dispatch per surviving question — and run every dispatch in
the background, never in the foreground: each `Agent` call returns at once, and each agent's
ending wakes you with its final message. Run the batch call (sub-step **d**) every time you wake
with landed returns, over whatever has landed by then. No foreground shell loop, background
shell loop, or event monitor serves as the wait: the wake-ups the agents' endings bring are the
whole wait. No ranking or ordering precedes the dispatches: an alternative set is enumerated
against the sibling questions as scope only, never against how a sibling will settle, so no
dispatch reads what another wrote and their order changes nothing.

**A dispatch the host refuses for its limit on concurrent subagents is held, never dropped.**
When an `Agent` call is refused because that limit is reached, hold its question's Short Title
as pending, despite the refusal message telling you not to retry: the question is not skipped
and gets no advisory entry for it. Each time you wake with an ended agent, send one held
question again per agent that ended, in the background like the first dispatches and with the
same prompt, the oldest held first; a resend the host refuses again stays held. The resent
agent's file lands like any other, for the next batch call, and its final message gets the same
last-line verdict (sub-step **c**). A held question is still outstanding: the wait (sub-step
**f**) does not end, and the closing check (sub-step **g**) does not run, while any question is
held.
