# The design claims of Gurita

This page lists the 19 design claims Gurita makes, in six groups, each with the
design that makes it true and one metric for a test. The claims are written in
ASD-STE100 Simplified Technical English, so that each claim reads the same to a
reader and to the author of a test. Each **Metric** line names the test that
would check its claim. Gurita's own test suite runs three of these tests: the
test of claim 11, the first part of the test of claim 2, and the second part of
the test of claim 12. No suite runs the other tests yet.

## Decisions

### 1. Gurita finds the open questions before the work starts.

- **Design:** The review skill reads the requirements and writes each gap as an
  open question. Task derivation does not start while an open question remains.
- **Metric:** The number of planted gaps found, and the number of review passes
  to convergence.

### 2. Each decision has a record in git.

- **Design:** One answer makes one commit. The commit subject shows how the
  answer was made: manual, recommendation, or alternative. A revert of that
  commit opens the question again.
- **Metric:** Commits per decision (must be 1), and the result of a revert test.

### 3. The person decides. The machine gives advice only.

- **Design:** A recommendation is advice. A principle changes the weight of an
  option. It does not block an option. The user can record a different
  alternative or an answer of their own. A goal change removes the
  recommendations that it makes out of date, but it does not change a
  recorded decision.
- **Metric:** The count of decisions recorded without a user command (must be
  0, unless the user started a batch skill).

### 4. Advice comes from the live project and shows its sources.

- **Design:** The alternatives and the recommendation come from the live
  project and the mission's requirements, not from memory. The alternatives
  are distinct and cover the decision. Each two alternatives are different in
  substance. Together they cover the full decision, not only the words of the
  question. This includes the option not to do the thing, when that option is
  possible. Each alternative has one key advantage and one key drawback. The
  recommender gives one recommendation with a direct reason. It names each
  principle it applied and each sibling recommendation it used.
- **Metric:** Judge score for alternative quality, and the count of
  recommendations without a clear option.

### 5. Advice gets better with each mission.

- **Design:** The capture skill reads the answers of a mission, and mainly the
  answers where the user did not accept the recommendation. It writes the
  reasons as principles in one store for the project. The recommender reads
  that store. The recorded decision text does not cite the principles.
- **Metric:** Agreement between the recommendation and the recorded decision,
  with and without the store.

### 6. Related questions are answered in the correct order.

- **Design:** A recommendation names each sibling recommendation it depends on.
  The batch answer skill answers the questions in that order, from the
  questions that depend on nothing. When an answer is the option that a
  dependent recommendation assumed, the dependent recommendation stays. When
  it is not, the dependent recommendation is removed and its alternatives
  stay, and the same occurs to the questions that depend on it. A
  recommendation can also depend on an answer without a stated dependency. A
  hand answer names each recommendation that it makes out of date, and these
  recommendations are removed in the same way. A goal change or a refresh of
  the starting state removes each recommendation that it makes out of date,
  and keeps the alternatives. That removal does not continue to the
  dependents.
- **Metric:** Golden-file result on a seeded graph, and the count of recorded
  decisions with an out-of-date reason.

## Work

### 7. Each requirement becomes a task, and each task has proof.

- **Design:** Task derivation makes a coverage matrix before it writes the
  tasks. Task completion derives an acceptance bar and verifies the work
  against it. Then the task leaves the task list. The commit of the task
  records the bar as its body, with one bullet for each criterion. The
  subject of that commit gives the task title, and its diff keeps the text
  of the task. Gurita reads these commits back from the git log.
- **Metric:** Recall of requirement IDs in the tasks and in the verified
  bullets of the task commits.

### 8. Gurita makes the detailed design late, against the live project.

- **Design:** A task holds only a title and 1 to 3 sentences. The completer
  makes the detailed design at completion time. It reads the live deliverables
  of the previous tasks, not a promised contract.
- **Metric:** Task body length, and the count of references that do not match
  the live project.

### 9. Work is bounded: one mission for each run, one started mission for each scope, one task at a time.

- **Design:** Each run names the mission that it works on by the path of
  the mission directory. No file stores a current mission. A run that
  does not name a live mission stops and changes nothing. The finish skill
  removes the mission directory, thus the directories that stay are the
  live missions. The scope of a mission is the directory that holds the
  mission directory. A mission is started when tasks go into its
  task list, and it stays started until the finish skill removes its
  directory. A started mission holds its scope, the directories above it,
  and the directories below it. Before the skills that add tasks write, and
  before each task that the completion skills start, a scope gate checks the
  scope. If a different started mission holds it, the skill stops and
  changes nothing. Tasks run in dependency order, one at a time.
- **Metric:** Count of runs that change a mission other than the mission
  that they name (must be 0), count of task commits for a mission while a
  different started mission holds its scope (must be 0), and the order of
  the task commits.

## Records

### 10. The repository is the memory.

- **Design:** The files of the live missions and the git log hold the full
  record. The finish commit of a mission removes the mission directory,
  and the body of that commit is the summary of the mission. The files of
  the mission stay in the parent of that commit. Gurita reads the finished
  missions and the completed tasks back from the git log. A new session
  reads these records and can answer questions about the project. No chat
  transcript is necessary.
- **Metric:** Score of a new session on a fixed question bank about the
  project.

### 11. The records are machine-readable.

- **Design:** The open questions of a mission are one XML document. After
  the mission is defined, only Gurita's open-question tool writes that
  document, and it writes it in one canonical form. The task list is the
  same: only Gurita's task-list tool writes it, in one canonical layout, and
  a failed write changes nothing. A completed task has no file. Its record
  is its task commit. The decisions in `requirements.md` are prose that a
  person can also edit. When the batch answer skill records a decision, it
  changes only the bytes of that decision. For a question that asks which of
  two conflicting decisions stands, it writes again the decision that does
  not stand, and changes nothing else.
- **Metric:** Golden-file diff of the question document after an answer, a
  cascade, or a prune, of the task list after each task-list write, and of
  `requirements.md` after each recorded decision.

### 12. Repository hygiene is structural.

- **Design:** Each commit records only its own paths, never all files. Thus a
  change of another run, staged or not, stays out of the commit. When
  another run holds the git lock, the commit tries again for a few seconds.
  Each commit subject has a marker that names the skill function. A pass
  that changes nothing makes no commit. A failed run leaves its partial work
  in the tree for the next run. The console shows one status line and does
  not repeat the diff.
- **Metric:** Count of unknown subjects, commits with a path from outside
  their own change set, and empty commits (each must be 0).

## Efficiency

### 13. Each unit of work runs with the smallest necessary context.

- **Design:** One subagent does one task or one alternative set, and then
  stops. The orchestrator holds no work context. It gets a bare DONE or a
  bare FAILED only. An alternative set never comes back in the message: the
  subagent writes it to one file outside the repository, and the orchestrator
  records it without reading it. The batch recommend and answer skills
  dispatch no agent. They read the question set one time for each run, not
  one time for each question. Task bodies are minimal.
- **Metric:** Tokens per task, orchestrator context size as the task count
  increases, and total cost per mission.

### 14. Unattended batch runs are possible.

- **Design:** The batch skills recommend, answer, and complete all items in one
  run. They gather the items once and run strictly in sequence. The user starts
  them and reads the git log after. Each run ends with one fixed first line,
  so a script that runs the skills one after another can tell how each run
  ended.
- **Metric:** Missions completed with 0 user turns after the start, and their
  scores on the other claims.

## Robustness

### 15. A run can stop and continue without loss.

- **Design:** A failed task leaves its partial work in the tree, and the next
  run continues from it. A bad subagent return gets one repair, then a skip,
  never a run stop. When the alternatives of a question never arrive, the
  run reports "no annotation landed" for that question, and the next run
  tries it again. A refused recommendation stops only its own question, and
  the other recommendations are recorded. The recommend skill corrects the
  refused recommendations and sends them again one time. When one is refused
  again, the run skips it and reports the error and the remedy: run the pass
  again. The answer skill records the decision before it removes the
  question, so an interruption leaves a safe superset.
- **Metric:** Result of a kill-and-resume test: work continued, not done again.

### 16. When in doubt, Gurita keeps the record and flags it.

- **Design:** When Gurita is not sure that an answer is the option a
  dependent recommendation assumed, it removes that recommendation and keeps
  the alternatives, so the next recommendation pass picks again. When a hand
  answer, a goal change, or a refresh of the starting state possibly makes a
  recommendation out of date, the skill removes that recommendation and keeps
  the alternatives. Review flags a possibly resolved question and does not
  delete it. Bootstrap changes only its own workflow section of the context
  file. Capture writes the principle store, but commits only after the user
  reads the diff. On rejection, it restores the store as it was.
- **Metric:** Count of records lost without a user command (must be 0).

## Engineering

### 17. One source of truth, no drift.

- **Design:** The skills, agents, procedures, and tools are written once.
  Each host's copy of the plugin is a build of that one source. Each shared
  procedure is referenced and never restated. A check fails when a host's
  copy is different from a new build.
- **Metric:** Result of the drift gate on each commit, and the count of
  restated procedures (must be 0).

### 18. The same behaviour on each host.

- **Design:** Each host gets the same skills with the same steps. Where hosts
  do one step differently, for example how they run subagents together and
  wait for them, the copy for each host describes only that host's own
  mechanism and names no other host.
- **Metric:** Same case scores on each host tree.

### 19. Each skill does one thing, on an explicit command.

- **Design:** Gurita runs only when the user invokes a skill. Each skill has
  one function. To record an answer, to change the goal, and to review the
  questions are 3 different skills. Task completion is the only function that
  has both a skill and an agent. They use the same procedure and differ only
  in where it runs: inline or isolated.
- **Metric:** Count of file changes outside the skill's declared paths (must
  be 0).

---

Claims 17 to 19 are about the plugin code, not a user project.
