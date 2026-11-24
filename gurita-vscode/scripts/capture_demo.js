// Records the listing's demo GIF, `media/demo.gif`, and its three screenshots, `media/sidebar-view.png`,
// `media/mission-page.png`, and `media/settings-window.png`, from one real VS Code session, never by
// hand. Run it from the repository root under Node 22 through nvm, after `npm ci` in
// `gurita-vscode/`:
//
//   (source "$HOME/.nvm/nvm.sh" && nvm use 22 && node gurita-vscode/scripts/capture_demo.js)
//
// It needs macOS with VS Code installed under /Applications, `ffmpeg` on `PATH`, and `python3` 3.9
// or later and `git` in /usr/bin. In order, it:
//
// 1. builds the package with `npm run package` and installs the VSIX into a throwaway extensions
//    directory through VS Code's own CLI, so the session runs the extension exactly as packaged;
// 2. seeds a sample project, a fresh git repository holding a copy of the host suite's fixture
//    project, `tests/fixtures/host_project/`, its `fixture.mission_<slug>/` directory renamed to
//    `mission_<slug>/`, as the host suite seeds it;
// 3. writes a stand-in for the harness CLI, a `claude` that runs `scripts/demo_claude.py`, into a
//    directory placed first on the session's `PATH`, which otherwise holds only the system
//    directories, so the recipe run is deterministic and starts no model session, and the harness
//    check reads Claude Code's Gurita copy as installed and up to date;
// 4. launches VS Code on the project with a throwaway profile (its own user data directory and
//    home directory, so neither the person's settings nor their `~/.gurita` files are read), its
//    viewport fixed at 1280 by 800 through the DevTools protocol, which the script also drives
//    the session through;
// 5. opens the Gurita view from the activity bar, opens the sample mission's window from its row
//    in the side-bar view, and starts the `First run` recipe from the mission's page, a drawn
//    pointer moving to each control before it is clicked, then waits for the run's terminal to
//    open and, the run finished, to close by itself, as `gurita.autoCloseFinishedRuns` closes it,
//    so the page redraws on the run's outcome;
// 6. captures a frame of the window throughout and assembles the frames, each held as long as it
//    stood on screen, into one looping GIF with `ffmpeg`, refusing a result over MAX_BYTES;
// 7. saves three full-resolution stills of the window, the drawn pointer hidden: the side-bar
//    view once the mission row shows, the mission's page once it has filled `derive tasks` with the
//    questions' alternatives and picks drawn, and, in one more step after the recording, the
//    Settings window, opened from the view's title bar once its harness check has finished.
//
// The GIF and the stills are written only together and only when every step succeeded, and the
// throwaway directory is then removed;
// on a failure the script prints one `Error:` line and leaves that directory in place for
// inspection. A capture is not reproducible byte for byte, so nothing compares the committed GIF
// with a fresh one: re-run the script when the flow it shows changes.
'use strict';

const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const EXTENSION_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(EXTENSION_ROOT, '..');
const FIXTURE = path.join(REPO_ROOT, 'tests', 'fixtures', 'host_project');
const FIXTURE_PREFIX = 'fixture.';
const STAND_IN = path.join(__dirname, 'demo_claude.py');
const VSIX = path.join(EXTENSION_ROOT, 'dist', 'gurita-vscode.vsix');
const OUTPUT = path.join(EXTENSION_ROOT, 'media', 'demo.gif');

/** The three stills, by the moment each is taken, and the file each is written to. */
const STILLS = {
  sidebar: path.join(EXTENSION_ROOT, 'media', 'sidebar-view.png'),
  mission: path.join(EXTENSION_ROOT, 'media', 'mission-page.png'),
  settings: path.join(EXTENSION_ROOT, 'media', 'settings-window.png'),
};

/** The largest GIF the script writes, in bytes. */
const MAX_BYTES = 5 * 1024 * 1024;

const VSCODE_APP = '/Applications/Visual Studio Code.app';
const VSCODE_BINARY = path.join(VSCODE_APP, 'Contents', 'MacOS', 'Code');
const VSCODE_CLI = path.join(VSCODE_APP, 'Contents', 'Resources', 'app', 'bin', 'code');
const SYSTEM_PATH = ['/usr/bin', '/bin', '/usr/sbin', '/sbin'];

const VIEWPORT = { width: 1280, height: 800, deviceScaleFactor: 2 };
const GIF_WIDTH = 1024;
const RECIPE = 'First run';
const FINISHED_STEP = 'derive tasks';
const TERMINAL = '.terminal-wrapper .xterm';
const SETTINGS_ACTION = 'Settings';

/** The throwaway profile's settings: no chat, no welcome page, no update or telemetry, and a terminal drawn into the DOM, so its text can be read. */
const SETTINGS = {
  'chat.disableAIFeatures': true,
  'extensions.autoCheckUpdates': false,
  'extensions.autoUpdate': false,
  'git.autoRepositoryDetection': false,
  'security.workspace.trust.enabled': false,
  'telemetry.telemetryLevel': 'off',
  'terminal.integrated.enablePersistentSessions': false,
  'terminal.integrated.gpuAcceleration': 'off',
  'update.mode': 'none',
  'window.restoreWindows': 'none',
  'workbench.colorTheme': 'Default Dark Modern',
  'workbench.enableExperiments': false,
  'workbench.secondarySideBar.defaultVisibility': 'hidden',
  'workbench.startupEditor': 'none',
  'workbench.tips.enabled': false,
};

class Failure extends Error {}

function fail(message) {
  throw new Failure(message);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Runs `command` to completion with its output shown, failing on a non-zero exit. */
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.error) {
    fail(`${path.basename(command)} could not be started: ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(`${path.basename(command)} ${args.join(' ')} exited with status ${result.status}`);
  }
}

function checkPrerequisites() {
  if (process.platform !== 'darwin') {
    fail('the capture runs on macOS only');
  }
  for (const file of [VSCODE_BINARY, VSCODE_CLI]) {
    if (!fs.existsSync(file)) {
      fail(`VS Code is not installed where the script looks for it: ${file}`);
    }
  }
  if (!fs.existsSync(path.join(EXTENSION_ROOT, 'node_modules'))) {
    fail('gurita-vscode/node_modules is missing: run npm ci in gurita-vscode/ first');
  }
  const ffmpeg = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  if (ffmpeg.error || ffmpeg.status !== 0) {
    fail('ffmpeg is not on PATH');
  }
  const python = spawnSync('/usr/bin/python3', ['-c', 'import sys; sys.exit(sys.version_info < (3, 9))']);
  if (python.error || python.status !== 0) {
    fail('/usr/bin/python3 is missing or older than 3.9');
  }
}

/** Builds the VSIX and installs it into the throwaway extensions directory. */
function buildAndInstall(dirs) {
  const npm = path.join(path.dirname(process.execPath), 'npm');
  const nodePath = `${path.dirname(process.execPath)}:${process.env.PATH ?? ''}`;
  run(npm, ['run', 'package'], { cwd: EXTENSION_ROOT, env: { ...process.env, PATH: nodePath } });
  run(
    VSCODE_CLI,
    [`--user-data-dir=${dirs.profile}`, `--extensions-dir=${dirs.extensions}`, '--install-extension', VSIX],
    { env: { HOME: dirs.home, PATH: SYSTEM_PATH.join(':'), TMPDIR: os.tmpdir() } },
  );
}

/** Copies the fixture project into a fresh repository with one commit, and returns the mission's path. */
function seedProject(dirs) {
  fs.cpSync(FIXTURE, dirs.project, { recursive: true });
  const fixtures = fs.readdirSync(dirs.project).filter((name) => name.startsWith(`${FIXTURE_PREFIX}mission_`));
  if (fixtures.length !== 1) {
    fail(`${FIXTURE} holds ${fixtures.length} fixture missions, not one`);
  }
  const mission = fixtures[0].slice(FIXTURE_PREFIX.length);
  fs.renameSync(path.join(dirs.project, fixtures[0]), path.join(dirs.project, mission));
  const git = (...args) => run('/usr/bin/git', args, { cwd: dirs.project, env: { HOME: dirs.home, PATH: SYSTEM_PATH.join(':') } });
  git('init', '-q');
  git('config', 'user.name', 'Pocket Ledger');
  git('config', 'user.email', 'demo@example.invalid');
  git('config', 'commit.gpgsign', 'false');
  git('add', '-A');
  git('commit', '-q', '--no-verify', '-m', 'Seed the sample project');
  return `${mission}/`;
}

function writeStandIn(dirs) {
  const quoted = `'${STAND_IN.replace(/'/g, `'\\''`)}'`;
  const file = path.join(dirs.bin, 'claude');
  fs.writeFileSync(file, `#!/bin/sh\nexec python3 ${quoted} "$@"\n`, { mode: 0o755 });
}

function writeSettings(dirs) {
  const user = path.join(dirs.profile, 'User');
  fs.mkdirSync(user, { recursive: true });
  fs.writeFileSync(path.join(user, 'settings.json'), `${JSON.stringify(SETTINGS, null, 2)}\n`);
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

/** One DevTools protocol connection to the browser, its page and frame sessions flattened onto it. */
class Protocol {
  constructor(socket) {
    this.socket = socket;
    this.next = 0;
    this.pending = new Map();
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      const waiter = message.id !== undefined ? this.pending.get(message.id) : undefined;
      if (waiter) {
        this.pending.delete(message.id);
        if (message.error) {
          waiter.reject(new Failure(`${waiter.method}: ${message.error.message}`));
        } else {
          waiter.resolve(message.result);
        }
      }
    });
    socket.addEventListener('close', () => {
      for (const waiter of this.pending.values()) {
        waiter.reject(new Failure('the DevTools connection closed'));
      }
      this.pending.clear();
    });
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', () => reject(new Failure(`cannot connect to ${url}`)), { once: true });
    });
    return new Protocol(socket);
  }

  send(method, params = {}, sessionId = undefined) {
    const id = ++this.next;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }

  async evaluate(expression, sessionId) {
    const { result, exceptionDetails } = await this.send(
      'Runtime.evaluate',
      { expression, returnByValue: true, awaitPromise: true },
      sessionId,
    );
    if (exceptionDetails) {
      fail(`evaluation failed: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
    }
    return result.value;
  }

  close() {
    this.socket.close();
  }
}

/** Polls `probe` until it returns a value other than null or undefined, failing after `timeout` ms. */
async function until(what, probe, timeout = 30000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    let value;
    try {
      value = await probe();
    } catch (error) {
      if (!(error instanceof Failure)) {
        throw error;
      }
    }
    if (value !== null && value !== undefined) {
      return value;
    }
    if (Date.now() > deadline) {
      fail(`timed out waiting for ${what}`);
    }
    await sleep(250);
  }
}

/** The pointer drawn over the workbench, since a screenshot shows no system cursor. */
const CURSOR_SCRIPT = `(() => {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '24');
  svg.setAttribute('height', '24');
  svg.setAttribute('viewBox', '0 0 24 24');
  const arrow = document.createElementNS(ns, 'path');
  arrow.setAttribute('d', 'M3 2 L3 19 L7.5 14.6 L10.6 21.4 L13.8 20 L10.8 13.3 L17 13.3 Z');
  arrow.setAttribute('fill', '#ffffff');
  arrow.setAttribute('stroke', '#000000');
  arrow.setAttribute('stroke-width', '1.4');
  arrow.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(arrow);
  const pointer = document.createElement('div');
  pointer.id = 'gurita-demo-pointer';
  Object.assign(pointer.style, {
    position: 'fixed', left: '-3px', top: '-2px', zIndex: '2147483647', pointerEvents: 'none',
    transform: 'translate(${VIEWPORT.width / 2}px, ${VIEWPORT.height / 2}px)',
    transition: 'transform 700ms ease-in-out',
  });
  pointer.appendChild(svg);
  document.body.appendChild(pointer);
  return true;
})()`;

/** The driven VS Code session: its workbench page, the frames recorded from it, its stills, and the pointer. */
class Session {
  constructor(protocol, pageSession, dirs) {
    this.protocol = protocol;
    this.page = pageSession;
    this.framesDir = dirs.frames;
    this.stillsDir = dirs.stills;
    this.frames = [];
    this.stills = {};
    this.recording = false;
    this.recorder = undefined;
    this.held = false;
    this.inFlight = undefined;
  }

  evaluate(expression) {
    return this.protocol.evaluate(expression, this.page);
  }

  async screenshot() {
    const { data } = await this.protocol.send('Page.captureScreenshot', { format: 'png' }, this.page);
    return Buffer.from(data, 'base64');
  }

  startRecording() {
    this.recording = true;
    this.recorder = (async () => {
      while (this.recording) {
        if (this.held) {
          await sleep(50);
          continue;
        }
        this.inFlight = this.screenshot();
        const data = await this.inFlight;
        const file = path.join(this.framesDir, `frame-${String(this.frames.length).padStart(5, '0')}.png`);
        fs.writeFileSync(file, data);
        this.frames.push({ file, at: Date.now() });
      }
    })();
    // A recording cut off by a failed step rejects once the session closes: stopRecording reports
    // that rejection, and it never ends the script before the step's own `Error:` line is printed.
    this.recorder.catch(() => undefined);
  }

  /**
   * Saves one full-resolution still of the window as `name`, the drawn pointer hidden for it, the
   * recording held meanwhile so no frame of the GIF shows the window without its pointer.
   */
  async still(name) {
    this.held = true;
    try {
      await this.inFlight;
      await this.evaluate(`document.getElementById('gurita-demo-pointer').style.visibility = 'hidden'`);
      await sleep(150);
      const file = path.join(this.stillsDir, `${name}.png`);
      fs.writeFileSync(file, await this.screenshot());
      this.stills[name] = file;
      await this.evaluate(`document.getElementById('gurita-demo-pointer').style.visibility = 'visible'`);
    } finally {
      this.held = false;
    }
  }

  async stopRecording() {
    this.recording = false;
    await this.recorder;
    this.frames.push({ file: undefined, at: Date.now() });
  }

  async pointTo({ x, y }) {
    await this.evaluate(
      `document.getElementById('gurita-demo-pointer').style.transform = 'translate(${x}px, ${y}px)'`,
    );
    await this.protocol.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }, this.page);
    await sleep(900);
  }

  async click(point) {
    await this.pointTo(point);
    const { x, y } = point;
    await this.protocol.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }, this.page);
    await this.protocol.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }, this.page);
  }

  /** The centre of the first workbench element `selector` matches whose text or label `test` accepts. */
  async centreOf(selector, test) {
    return this.evaluate(`(() => {
      const test = ${test};
      const node = [...document.querySelectorAll(${JSON.stringify(selector)})].find(test);
      if (!node) return null;
      const box = node.getBoundingClientRect();
      if (box.width === 0) return null;
      return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
    })()`);
  }
}

/**
 * Finds the mission window's webview frame, attaches to it, and returns the centre of the recipe
 * button named `recipe` in workbench coordinates, with whether the button is enabled.
 */
async function recipeButton(protocol, session, recipe) {
  const { targetInfos } = await protocol.send('Target.getTargets');
  const frames = targetInfos.filter((target) => target.type === 'iframe' && target.url.includes('extensionId=BusyMinds.gurita-vscode'));
  for (const frame of frames) {
    const { sessionId } = await protocol.send('Target.attachToTarget', { targetId: frame.targetId, flatten: true });
    const inner = await protocol.evaluate(`(() => {
      const frame = document.getElementById('active-frame');
      const page = frame && frame.contentDocument;
      if (!page) return null;
      const button = [...page.querySelectorAll('button.recipe')].find(
        (node) => node.querySelector('.recipe-name')?.textContent === ${JSON.stringify(recipe)});
      if (!button) return null;
      const outer = frame.getBoundingClientRect();
      const box = button.getBoundingClientRect();
      return { x: outer.x + box.x + box.width / 2, y: outer.y + box.y + box.height / 2, enabled: !button.disabled };
    })()`, sessionId);
    await protocol.send('Target.detachFromTarget', { sessionId });
    if (!inner) {
      continue;
    }
    const id = new URL(frame.url).searchParams.get('id');
    const outer = await session.evaluate(`(() => {
      const frame = [...document.querySelectorAll('iframe.webview')].find(
        (node) => new URL(node.src).searchParams.get('id') === ${JSON.stringify(id)});
      if (!frame) return null;
      const box = frame.getBoundingClientRect();
      return { x: box.x, y: box.y };
    })()`);
    if (outer) {
      return { x: Math.round(outer.x + inner.x), y: Math.round(outer.y + inner.y), enabled: inner.enabled };
    }
  }
  return null;
}

/**
 * The first value other than null that `probe`, an expression over `page`, the document of a
 * webview's content frame, gives in any of the extension's webview frames, or null.
 */
async function inWebview(protocol, probe) {
  const { targetInfos } = await protocol.send('Target.getTargets');
  for (const frame of targetInfos.filter((target) => target.type === 'iframe')) {
    const { sessionId } = await protocol.send('Target.attachToTarget', { targetId: frame.targetId, flatten: true });
    const value = await protocol.evaluate(`(() => {
      const page = document.getElementById('active-frame')?.contentDocument;
      if (!page) return null;
      return ${probe};
    })()`, sessionId);
    await protocol.send('Target.detachFromTarget', { sessionId });
    if (value !== null && value !== undefined) {
      return value;
    }
  }
  return null;
}

/** The text of the mission page's filled workflow block, read inside its webview frame. */
function filledStep(protocol) {
  return inWebview(protocol, `(() => {
    const step = page.querySelector('.workflow .block.next:not(.running)');
    return step ? step.textContent.trim() : null;
  })()`);
}

/** How many questions on the mission's page show both their alternatives and their pick, or null when none shows. */
function annotatedQuestions(protocol) {
  return inWebview(protocol, `(() => {
    const cards = [...page.querySelectorAll('article.card')].filter((card) => card.querySelector('.alternative.picked'));
    return cards.length > 0 ? cards.length : null;
  })()`);
}

/** Whether the Settings window has drawn its harness check's finished result, or null while it has not. */
function settingsChecked(protocol) {
  return inWebview(protocol, `(() => {
    const harnesses = page.querySelector('.settings .harnesses');
    if (!harnesses || harnesses.querySelector('.checking')) return null;
    return harnesses.querySelectorAll('.harness-status').length > 0 ? true : null;
  })()`);
}

/** Launches VS Code on the project and returns the child process and its DevTools port. */
async function launch(dirs) {
  const port = await freePort();
  const log = fs.openSync(path.join(dirs.root, 'vscode.log'), 'w');
  const child = spawn(
    VSCODE_BINARY,
    [
      `--user-data-dir=${dirs.profile}`,
      `--extensions-dir=${dirs.extensions}`,
      `--remote-debugging-port=${port}`,
      // The throwaway home holds no login keychain, so a keychain write would wait on a password
      // prompt nobody answers: secrets are kept in memory and the keychain is a mock one instead.
      // Both stand ahead of a known flag, since an unknown one would take the project as its value.
      '--use-inmemory-secretstorage',
      '--use-mock-keychain',
      '--new-window',
      '--skip-welcome',
      '--skip-release-notes',
      '--disable-workspace-trust',
      dirs.project,
    ],
    {
      cwd: dirs.project,
      stdio: ['ignore', log, log],
      env: {
        HOME: dirs.home,
        PATH: [dirs.bin, ...SYSTEM_PATH].join(':'),
        SHELL: '/bin/sh',
        TMPDIR: os.tmpdir(),
        USER: os.userInfo().username,
        LANG: 'en_US.UTF-8',
        VSCODE_CLI: '1',
      },
    },
  );
  return { child, port };
}

async function drive(dirs, port, mission) {
  const version = await until('VS Code to accept DevTools connections', async () => {
    try {
      return await (await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(5000) })).json();
    } catch {
      return null;
    }
  }, 60000);
  const protocol = await Protocol.connect(version.webSocketDebuggerUrl);
  try {
    const page = await until('the workbench page', async () => {
      const { targetInfos } = await protocol.send('Target.getTargets');
      return targetInfos.find((target) => target.type === 'page' && target.url.includes('workbench.html')) ?? null;
    });
    const { sessionId } = await protocol.send('Target.attachToTarget', { targetId: page.targetId, flatten: true });
    await protocol.send('Emulation.setDeviceMetricsOverride', { ...VIEWPORT, mobile: false }, sessionId);
    const session = new Session(protocol, sessionId, dirs);

    const activity = await until('the Gurita activity-bar entry', () =>
      session.centreOf('.activitybar .action-item', '(node) => node.querySelector("a")?.getAttribute("aria-label") === "Gurita"'),
    );
    await session.evaluate(CURSOR_SCRIPT);
    await sleep(1500);

    session.startRecording();
    await sleep(1200);
    await session.click(activity);
    const title = fs.readFileSync(path.join(dirs.project, mission, 'requirements.md'), 'utf8').split('\n')[0].replace(/^# /, '');
    const row = await until('the mission row in the side-bar view', () =>
      session.centreOf('.monaco-list-row', `(node) => (node.getAttribute('aria-label') ?? '').startsWith(${JSON.stringify(title)})`),
    );
    await sleep(1500);
    await session.still('sidebar');

    await session.click({ x: row.x - 60, y: row.y });
    const button = await until(`the ${RECIPE} button on the mission's page`, async () => {
      const found = await recipeButton(protocol, session, RECIPE);
      return found && found.enabled ? found : null;
    });
    await sleep(2200);

    await session.click(button);
    await until('the run terminal to open', () => session.centreOf(TERMINAL, '() => true'));
    await until('the run to finish and its terminal to close by itself', async () =>
      ((await session.centreOf(TERMINAL, '() => true')) === null ? true : null), 120000);
    await until(`the mission's page to fill ${FINISHED_STEP}`, async () => {
      const step = await filledStep(protocol);
      return step === FINISHED_STEP ? step : null;
    });
    await until("the questions' alternatives and picks on the mission's page", () => annotatedQuestions(protocol));
    await session.pointTo({ x: Math.round(VIEWPORT.width * 0.62), y: Math.round(VIEWPORT.height * 0.45) });
    await sleep(1500);
    await session.still('mission');
    await sleep(1500);
    await session.stopRecording();
    if (session.frames.length < 10) {
      fail(`only ${session.frames.length - 1} frames were captured`);
    }

    const settings = await until('the Settings action in the side-bar view\'s title bar', () =>
      session.centreOf('.part.sidebar .action-label', `(node) => node.getAttribute('aria-label') === ${JSON.stringify(SETTINGS_ACTION)}`),
    );
    await session.click(settings);
    await until("the Settings window's finished harness check", () => settingsChecked(protocol), 60000);
    await sleep(1500);
    await session.still('settings');
    return { frames: session.frames, stills: session.stills };
  } finally {
    await protocol.send('Browser.close').catch(() => undefined);
    protocol.close();
  }
}

/** Assembles the frames into one looping GIF, each frame held until the next was taken. */
function assemble(frames, dirs) {
  const lines = ['ffconcat version 1.0'];
  for (let index = 0; index < frames.length - 1; index += 1) {
    const seconds = Math.max(frames[index + 1].at - frames[index].at, 20) / 1000;
    lines.push(`file '${frames[index].file}'`, `duration ${seconds.toFixed(3)}`);
  }
  lines.push(`file '${frames[frames.length - 2].file}'`);
  const list = path.join(dirs.root, 'frames.ffconcat');
  fs.writeFileSync(list, `${lines.join('\n')}\n`);
  const gif = path.join(dirs.root, 'demo.gif');
  run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'concat', '-safe', '0', '-i', list,
    '-vf', `scale=${GIF_WIDTH}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle`,
    '-fps_mode', 'vfr', '-loop', '0',
    gif,
  ]);
  return gif;
}

/** Checks that `file` is a PNG of the viewport's full resolution. */
function checkStill(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.subarray(0, 8).toString('latin1') !== '\x89PNG\r\n\x1a\n') {
    fail(`${file} does not open with a PNG signature`);
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const expected = [VIEWPORT.width * VIEWPORT.deviceScaleFactor, VIEWPORT.height * VIEWPORT.deviceScaleFactor];
  if (width !== expected[0] || height !== expected[1]) {
    fail(`${file} is ${width} by ${height}, not ${expected[0]} by ${expected[1]}`);
  }
}

function checkGif(file) {
  const bytes = fs.readFileSync(file);
  const signature = bytes.subarray(0, 6).toString('latin1');
  if (signature !== 'GIF89a' && signature !== 'GIF87a') {
    fail(`${file} does not open with a GIF signature`);
  }
  if (bytes.length > MAX_BYTES) {
    fail(`the GIF is ${bytes.length} bytes, over the bound of ${MAX_BYTES}`);
  }
  return bytes.length;
}

async function main() {
  checkPrerequisites();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gurita-demo-'));
  const dirs = {
    root,
    home: path.join(root, 'home'),
    profile: path.join(root, 'profile'),
    extensions: path.join(root, 'extensions'),
    bin: path.join(root, 'bin'),
    project: path.join(root, 'project'),
    frames: path.join(root, 'frames'),
    stills: path.join(root, 'stills'),
  };
  for (const dir of [dirs.home, dirs.profile, dirs.extensions, dirs.bin, dirs.frames, dirs.stills]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  let child;
  try {
    buildAndInstall(dirs);
    const mission = seedProject(dirs);
    writeStandIn(dirs);
    writeSettings(dirs);
    const launched = await launch(dirs);
    child = launched.child;
    const { frames, stills } = await drive(dirs, launched.port, mission);
    await sleep(1000);
    const gif = assemble(frames, dirs);
    const size = checkGif(gif);
    for (const name of Object.keys(STILLS)) {
      if (stills[name] === undefined) {
        fail(`the ${name} still was not taken`);
      }
      checkStill(stills[name]);
    }
    fs.copyFileSync(gif, OUTPUT);
    for (const [name, output] of Object.entries(STILLS)) {
      fs.copyFileSync(stills[name], output);
    }
    fs.rmSync(root, { recursive: true, force: true });
    process.stdout.write(`Wrote ${path.relative(REPO_ROOT, OUTPUT)}: ${frames.length - 1} frames, ${size} bytes.\n`);
    for (const output of Object.values(STILLS)) {
      process.stdout.write(`Wrote ${path.relative(REPO_ROOT, output)}.\n`);
    }
  } catch (error) {
    process.stderr.write(`Error: ${error instanceof Failure ? error.message : error.stack}\n`);
    process.stderr.write(`The throwaway directory is left at ${root}\n`);
    process.exitCode = 1;
  } finally {
    if (child && child.exitCode === null) {
      child.kill();
    }
  }
}

main();
