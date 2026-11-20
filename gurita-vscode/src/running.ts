// The note of the runs the extension holds: the terminal of each mission's running runner, keyed
// by the mission's path, and the terminals of the runs a mission-starting button started, which
// belong to no mission. A mission's run is held from its start until its terminal closes. The pane
// draws the held missions' pages as running, every action button on them disabled and the
// workflow diagram's filled block pulsing, a click that still reaches the extension for a held
// mission is refused, and a click on a held mission's tab brings its terminal forward and focuses
// it. This module imports nothing from `vscode`, so the terminal is any value.

export class RunningRuns<Terminal> {
  /** The terminal of each mission's running runner, keyed by the mission's path. */
  private readonly byMission = new Map<string, Terminal>();

  /** The terminals of the running runners a mission-starting button started. */
  private readonly starting = new Set<Terminal>();

  /** Holds `terminal` as the run of the mission at `mission`, or, `mission` undefined, of no mission. */
  hold(mission: string | undefined, terminal: Terminal): void {
    if (mission === undefined) {
      this.starting.add(terminal);
    } else {
      this.byMission.set(mission, terminal);
    }
  }

  /** Clears every note `terminal` held when it closes, and returns whether it held one. */
  close(terminal: Terminal): boolean {
    let cleared = this.starting.delete(terminal);
    for (const [mission, held] of this.byMission) {
      if (held === terminal) {
        this.byMission.delete(mission);
        cleared = true;
      }
    }
    return cleared;
  }

  /** The terminal of the running runner of the mission at `mission`, or undefined when it has none. */
  terminal(mission: string): Terminal | undefined {
    return this.byMission.get(mission);
  }

  /** The paths of the missions with a running runner, sorted. */
  missions(): string[] {
    return [...this.byMission.keys()].sort();
  }
}
