//! `greenrack-first-touch`: a Claude Code hook that gives a session the
//! greenrack index once per session, agent and repository root, at
//! SessionStart or on the first tool call that touches a repository using the
//! design system.
//!
//! The binary only decides whether the CLI must start; `greenrack hook
//! first-touch` renders the index. Its contract:
//! - the exit code is always 0, a panic included: an exit 2 would block the
//!   tool call;
//! - stdout is empty or exactly what the CLI printed (plain text for
//!   SessionStart, one JSON object for PreToolUse);
//! - a call that finds its marker reads the event, walks up to the `.git` and
//!   stats one directory: it starts no process.
//!
//! `--protocol` prints the protocol this binary speaks with the CLI, and
//! `--status` its last failure and back-offs as JSON; neither reads stdin.
//! `greenrack hook install --user --check` asks both.

use serde::Deserialize;
use serde_json::{json, Value};
use std::fmt;
use std::fs;
use std::io::{self, IsTerminal, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

/// Bumped when the stdin, environment, stdout or `--status` contract with the
/// CLI changes. The CLI reads it from `GREENRACK_FIRST_TOUCH_PROTOCOL` and
/// prints nothing for a protocol it does not speak.
const PROTOCOL: &str = "1";
const NAME: &str = "greenrack-first-touch";
/// The CLI the hook starts. The floor is the first release with `hook first-touch`.
const PACKAGE: &str = "@greenharness/greenrack-cli@^7.11.0";
/// `package.json` text that marks a consumer, the CLI's exact test aside.
const NEEDLES: [&str; 1] = ["@greenharness/greenrack-"];
/// A repository with its own session hook keeps it.
const OWN_HOOKS: [&str; 2] = [
    ".claude/hooks/greenrack-catalog.sh",
    ".claude/hooks/duro-catalog.sh",
];
const FILE_TOOLS: [&str; 5] = ["Read", "Edit", "Write", "MultiEdit", "NotebookEdit"];
const SKIP_DIRS: [&str; 2] = ["node_modules", ".git"];
/// Levels of `package.json` the consumer test reads: the root, a child and a grandchild.
const MAX_DEPTH: usize = 2;
const PACKAGE_READ_LIMIT: u64 = 1_000_000;
const FAIL_LIMIT: u32 = 3;
const FAIL_WINDOW: Duration = Duration::from_secs(600);
const PRUNE_AGE: Duration = Duration::from_secs(7 * 86_400);
const LOG_LIMIT: u64 = 1_000_000;
const LOG_KEEP: usize = 2000;
/// Claude Code saves hook context above 10,000 characters to a file.
const OUTPUT_LIMIT: usize = 9_900;
const HELP: &str = "greenrack-first-touch: a Claude Code hook; Claude Code runs it
with the event on stdin. Install it with:
  npx -y @greenharness/greenrack-cli@^7.11.0 hook install --user
  --protocol  the protocol it speaks with the CLI
  --status    its last failure and back-offs, as JSON
  --version   its name and protocol";

/// The event as Claude Code sends it: only ids and paths are read, so a
/// Write's content is skipped without building a value for it.
#[derive(Deserialize, Default)]
struct Event {
    session_id: Option<String>,
    cwd: Option<String>,
    hook_event_name: Option<String>,
    tool_name: Option<String>,
    tool_input: Option<ToolInput>,
    agent_id: Option<String>,
    source: Option<String>,
}

#[derive(Deserialize, Default)]
struct ToolInput {
    file_path: Option<String>,
    notebook_path: Option<String>,
}

/// What the hook was called for, read once from the event.
enum Call {
    /// A session starts in `cwd`; `reset` when its earlier context is gone
    /// (a resume, a compact or a clear).
    Start { cwd: PathBuf, reset: bool },
    /// A tool works in `dir`.
    Tool { dir: PathBuf },
}

impl Call {
    fn of(event: &Event) -> Option<Call> {
        match event.hook_event_name.as_deref()? {
            "SessionStart" => Some(Call::Start {
                cwd: PathBuf::from(event.cwd.as_deref()?),
                reset: matches!(
                    event.source.as_deref(),
                    Some("resume" | "compact" | "clear")
                ),
            }),
            "PreToolUse" => Some(Call::Tool {
                dir: touched_dir(event)?,
            }),
            _ => None,
        }
    }

    fn event_name(&self) -> &'static str {
        match self {
            Call::Start { .. } => "SessionStart",
            Call::Tool { .. } => "PreToolUse",
        }
    }
}

/// An id that is safe as one path segment.
struct Id(String);

impl Id {
    fn parse(id: &str) -> Option<Id> {
        let ok = !id.is_empty()
            && id.len() <= 128
            && id
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_');
        ok.then(|| Id(id.to_string()))
    }
}

fn main() {
    match std::env::args().nth(1).as_deref() {
        Some("--protocol") => answer(PROTOCOL),
        Some("--status") => answer(&status()),
        Some("--version") => answer(&format!("{NAME} (protocol {PROTOCOL})")),
        Some("-h" | "--help") => answer(HELP),
        _ => {}
    }
    // A person at a terminal gets the help, never a read that waits on them.
    if io::stdin().is_terminal() {
        answer(HELP);
    }
    std::panic::set_hook(Box::new(|info| {
        let _ = writeln!(io::stderr(), "{NAME}: {info}"); // stderr closed: nowhere left to report
    }));
    if let Ok(Some(text)) = std::panic::catch_unwind(run) {
        let mut out = io::stdout().lock();
        let _ = out.write_all(text.as_bytes()); // stdout closed: Claude Code stopped reading
        let _ = out.flush(); // the same: the exit code stays 0 whatever happens
    }
    std::process::exit(0);
}

/// Print one answer and exit 0.
fn answer(text: &str) -> ! {
    let _ = writeln!(io::stdout(), "{text}"); // stdout closed: the asker has gone
    std::process::exit(0);
}

/// One hook call. `None` prints nothing.
fn run() -> Option<String> {
    if std::env::var_os("GREENRACK_FIRST_TOUCH_PANIC").is_some() {
        panic!("forced by GREENRACK_FIRST_TOUCH_PANIC");
    }
    let mut input = Vec::new();
    io::stdin().lock().read_to_end(&mut input).ok()?;
    let event: Event = serde_json::from_slice(&input).ok()?;
    let state = state_dir()?;
    let session = Id::parse(event.session_id.as_deref()?)?;
    let agent = match event.agent_id.as_deref() {
        Some(id) => Id::parse(id)?,
        None => Id("main".to_string()),
    };
    let session_dir = state.join(&session.0);
    let call = Call::of(&event)?;
    if let Call::Start { reset: true, .. } = call {
        let _ = fs::remove_dir_all(&session_dir); // left markers cost one index this session, nothing more
    }
    let event_name = call.event_name();
    let touched: &Path = match &call {
        Call::Start { cwd, .. } => cwd,
        Call::Tool { dir } => dir,
    };
    let root = git_root(touched)?;
    let root_text = normalize(&root.to_string_lossy());
    let key = root_key(&root_text);
    let marker = session_dir.join(&agent.0).join(&key).join(".m");
    if is_hit(&marker) {
        return None;
    }
    let first_of_session = !session_dir.exists();
    let record = |outcome: &str, ms: Option<u128>| {
        log(
            &state, event_name, &session.0, &agent.0, &root_text, outcome, ms,
        );
    };
    if !is_consumer(&root) {
        if claim(&marker) {
            finish(&marker, &root_text);
            record("not a consumer", None);
        }
        return None;
    }
    if matches!(call, Call::Start { .. }) && OWN_HOOKS.iter().any(|hook| root.join(hook).exists()) {
        if claim(&marker) {
            finish(&marker, &root_text);
            record("own hook", None);
        }
        return None;
    }
    let failures = state.join("failures").join(&key);
    let previous = read_failures(&failures);
    if previous.as_ref().is_some_and(Failures::backing_off) {
        record("backing off", None);
        return None;
    }
    if !claim(&marker) {
        return None;
    }
    if first_of_session {
        prune(&state);
    }
    let unavailable = match call {
        Call::Start { .. } => previous.and_then(|f| f.reason),
        Call::Tool { .. } => None,
    };
    let started = Instant::now();
    let cli_outcome = run_cli(event_name, input, &root, &root_text, unavailable.as_deref());
    let ms = Some(started.elapsed().as_millis());
    match cli_outcome {
        Ok(text) => {
            let _ = fs::remove_file(&failures); // usually absent; a left counter expires with FAIL_WINDOW
            finish(&marker, &root_text);
            let text = text.trim_end();
            if text.is_empty() {
                record("empty", ms);
                return None;
            }
            if text.chars().count() > OUTPUT_LIMIT {
                record("too large", ms);
                return None;
            }
            record("given", ms);
            Some(format!("{text}\n"))
        }
        Err(failure) => {
            let _ = fs::remove_dir_all(&marker); // a left claim expires after the claim TTL, then a call retries
            note_failure(&failures, &failure.to_string());
            record(&format!("failed: {failure}"), ms);
            let _ = writeln!(io::stderr(), "{NAME}: no index for {root_text} ({failure})"); // stderr closed: the log above has it
            None
        }
    }
}

fn state_dir() -> Option<PathBuf> {
    let base = if cfg!(windows) {
        PathBuf::from(std::env::var_os("LOCALAPPDATA")?)
    } else {
        match std::env::var_os("XDG_STATE_HOME").map(PathBuf::from) {
            // A relative value is ignored, per the XDG spec.
            Some(path) if path.is_absolute() => path,
            _ => PathBuf::from(std::env::var_os("HOME")?).join(".local/state"),
        }
    };
    Some(base.join(NAME))
}

/// Where a tool call works: its file's folder, else the cwd (Bash).
fn touched_dir(event: &Event) -> Option<PathBuf> {
    let cwd = match event.cwd.as_deref() {
        Some(cwd) => PathBuf::from(cwd),
        None => std::env::current_dir().ok()?,
    };
    let target = event
        .tool_input
        .as_ref()
        .filter(|_| FILE_TOOLS.contains(&event.tool_name.as_deref().unwrap_or("")))
        .and_then(|input| {
            input
                .file_path
                .as_deref()
                .or(input.notebook_path.as_deref())
        });
    let path = match target {
        Some(target) => cwd.join(target),
        None => cwd,
    };
    nearest_dir(&path)
}

/// The folder itself, or the nearest parent that exists (a Write into a new folder).
fn nearest_dir(path: &Path) -> Option<PathBuf> {
    let mut current = path;
    loop {
        if current.is_dir() {
            return Some(current.to_path_buf());
        }
        current = current.parent()?;
    }
}

/// The nearest folder above `dir` holding `.git` (a folder, or a file in a worktree).
fn git_root(dir: &Path) -> Option<PathBuf> {
    let real = fs::canonicalize(dir).ok()?;
    let mut current = real.as_path();
    loop {
        if current.join(".git").exists() {
            return Some(current.to_path_buf());
        }
        current = current.parent()?;
    }
}

/// One spelling per root on this platform.
fn normalize(path: &str) -> String {
    if cfg!(windows) {
        windows_spelling(path)
    } else {
        strip_verbatim(path)
    }
}

/// The path without Windows' `\\?\` prefix, which `canonicalize` adds.
fn strip_verbatim(path: &str) -> String {
    if let Some(rest) = path.strip_prefix(r"\\?\UNC\") {
        format!(r"\\{rest}")
    } else if let Some(rest) = path.strip_prefix(r"\\?\") {
        rest.to_string()
    } else {
        path.to_string()
    }
}

/// Windows paths ignore case and take either slash: `/` and lower case.
fn windows_spelling(path: &str) -> String {
    strip_verbatim(path).replace('\\', "/").to_lowercase()
}

/// A fixed-width name for a root (FNV-1a 64), so a marker path never nears MAX_PATH.
fn root_key(root: &str) -> String {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for byte in root.bytes() {
        hash ^= u64::from(byte);
        hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
    }
    format!("{hash:016x}")
}

fn claim_ttl() -> Duration {
    std::env::var("GREENRACK_FIRST_TOUCH_CLAIM_TTL_MS")
        .ok()
        .and_then(|ms| ms.parse().ok())
        .map_or(Duration::from_secs(30), Duration::from_millis)
}

fn age(path: &Path) -> Option<Duration> {
    let modified = fs::metadata(path).ok()?.modified().ok()?;
    Some(
        SystemTime::now()
            .duration_since(modified)
            .unwrap_or_default(),
    )
}

/// Done, or claimed by a run that may still be working.
fn is_hit(marker: &Path) -> bool {
    marker.join("done").exists() || age(marker).is_some_and(|age| age < claim_ttl())
}

/// Take the marker: create it, or replace a claim abandoned longer than the
/// TTL by renaming it aside first, so parallel reclaimers run once.
fn claim(marker: &Path) -> bool {
    let Some(parent) = marker.parent() else {
        return false;
    };
    if fs::create_dir_all(parent).is_err() {
        return false;
    }
    match fs::create_dir(marker) {
        Ok(()) => true,
        Err(err) if err.kind() == io::ErrorKind::AlreadyExists => {
            if is_hit(marker) {
                return false;
            }
            let aside = parent.join(format!(".m.stale.{}.{}", std::process::id(), nanos()));
            if fs::rename(marker, &aside).is_err() {
                return false;
            }
            // Between the check above and the rename, another caller may have
            // reclaimed the stale marker and made a fresh one: that one is
            // live, so it goes back and this caller stands down.
            if age(&aside).is_some_and(|age| age < claim_ttl()) {
                stand_down(&aside, marker);
                return false;
            }
            let _ = fs::remove_dir_all(&aside); // a left folder costs disk only; prune removes it with its session
            fs::create_dir(marker).is_ok()
        }
        Err(_) => false,
    }
}

/// Put back a live claim moved aside by mistake. A third caller may already
/// hold the marker path, and on Unix a rename silently replaces an empty
/// directory, so the path is tested first and theirs stands.
// holds-until: a report of a double index under three racing callers; one
// can still create the marker between the test and the rename.
fn stand_down(aside: &Path, marker: &Path) {
    if marker.exists() || fs::rename(aside, marker).is_err() {
        let _ = fs::remove_dir_all(aside); // another caller holds the marker; this copy is spare
    }
}

fn finish(marker: &Path, root: &str) {
    let _ = fs::write(marker.join("root"), root); // for a person reading the state; nothing reads it back
    let _ = fs::write(marker.join("done"), b""); // lost: the call runs again once the claim expires (30 s)
}

fn nanos() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_nanos())
}

fn now_secs() -> f64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0.0, |d| d.as_secs_f64())
}

/// A cheap superset of the CLI's consumer test: a `package.json` naming a needle.
fn is_consumer(root: &Path) -> bool {
    fn visit(dir: &Path, depth: usize) -> bool {
        if let Ok(file) = fs::File::open(dir.join("package.json")) {
            let mut text = String::new();
            if file
                .take(PACKAGE_READ_LIMIT)
                .read_to_string(&mut text)
                .is_ok()
                && NEEDLES.iter().any(|needle| text.contains(needle))
            {
                return true;
            }
        }
        if depth >= MAX_DEPTH {
            return false;
        }
        let Ok(entries) = fs::read_dir(dir) else {
            return false;
        };
        entries.flatten().any(|entry| {
            let name = entry.file_name();
            let skip = SKIP_DIRS.iter().any(|s| name == *s);
            !skip && entry.file_type().is_ok_and(|t| t.is_dir()) && visit(&entry.path(), depth + 1)
        })
    }
    visit(root, 0)
}

/// The failures counted for one root: `count at reason` on disk.
struct Failures {
    count: u32,
    at: f64,
    reason: Option<String>,
}

impl Failures {
    fn backing_off(&self) -> bool {
        self.count >= FAIL_LIMIT && now_secs() - self.at < FAIL_WINDOW.as_secs_f64()
    }
}

fn read_failures(path: &Path) -> Option<Failures> {
    let text = fs::read_to_string(path).ok()?;
    let mut parts = text.splitn(3, ' ');
    let count = parts.next()?.parse().ok()?;
    let at = parts.next()?.parse().ok()?;
    let reason = parts
        .next()
        .map(str::trim)
        .filter(|reason| !reason.is_empty())
        .map(String::from);
    Some(Failures { count, at, reason })
}

/// Count one more failure for a root.
// holds-until: a report of a back-off that came late. The read and the write
// are not locked, so two sessions failing on one root at once count one; while
// one session at a time fails per root, the count is exact.
fn note_failure(path: &Path, reason: &str) {
    let count = read_failures(path)
        .filter(|f| now_secs() - f.at < FAIL_WINDOW.as_secs_f64())
        .map_or(0, |f| f.count);
    let Some(parent) = path.parent() else {
        return;
    };
    if fs::create_dir_all(parent).is_err() {
        return;
    }
    // Staged and renamed: a parallel call never reads half a counter.
    let staged = parent.join(format!(".tmp.{}.{}", std::process::id(), nanos()));
    let line = format!("{} {} {}", count + 1, now_secs(), reason.replace('\n', " "));
    if fs::write(&staged, line).is_ok() && fs::rename(&staged, path).is_err() {
        let _ = fs::remove_file(&staged); // a stray temp file costs disk only
    }
}

/// Session folders older than a week go, and the log keeps its last lines.
fn prune(state: &Path) {
    if let Ok(entries) = fs::read_dir(state) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name();
            if name == "failures" || name == "log.jsonl" || !path.is_dir() {
                continue;
            }
            if age(&path).is_some_and(|age| age > PRUNE_AGE) {
                let _ = fs::remove_dir_all(&path); // left behind, the next session's prune tries again
            }
        }
    }
    let log = state.join("log.jsonl");
    if fs::metadata(&log).is_ok_and(|m| m.len() > LOG_LIMIT) {
        if let Ok(text) = fs::read_to_string(&log) {
            let lines: Vec<&str> = text.lines().collect();
            let kept = lines[lines.len().saturating_sub(LOG_KEEP)..].join("\n") + "\n";
            let staged = state.join(format!(".log.{}.tmp", std::process::id()));
            if fs::write(&staged, kept).is_ok() {
                let _ = fs::rename(&staged, &log); // the log stays long until the next session's prune
            }
        }
    }
}

fn log(
    state: &Path,
    event: &str,
    session: &str,
    agent: &str,
    root: &str,
    outcome: &str,
    ms: Option<u128>,
) {
    let line = json!({
        "ts": now_secs(),
        "event": event,
        "session": session,
        "agent": agent,
        "root": root,
        "outcome": outcome,
        "ms": ms,
    });
    if fs::create_dir_all(state).is_ok() {
        if let Ok(mut file) = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(state.join("log.jsonl"))
        {
            let _ = writeln!(file, "{line}"); // a lost line loses a statistic, never the hook's work
        }
    }
}

/// `--status`: the last failure in the log and the roots backing off, as one
/// JSON object. The CLI's `--check` prints it; the files stay this binary's.
fn status() -> String {
    let Some(state) = state_dir() else {
        return json!({"protocol": PROTOCOL, "lastFailure": null, "backingOff": []}).to_string();
    };
    let last = fs::read_to_string(state.join("log.jsonl"))
        .ok()
        .and_then(|text| {
            text.lines().rev().find_map(|line| {
                let row: Value = serde_json::from_str(line).ok()?;
                row["outcome"].as_str()?.starts_with("failed").then(
                    || json!({"ts": row["ts"], "root": row["root"], "outcome": row["outcome"]}),
                )
            })
        });
    let backing_off: Vec<Value> = fs::read_dir(state.join("failures"))
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|entry| read_failures(&entry.path()))
        .filter(Failures::backing_off)
        .map(|f| json!({"count": f.count, "ts": f.at, "reason": f.reason}))
        .collect();
    json!({"protocol": PROTOCOL, "lastFailure": last, "backingOff": backing_off}).to_string()
}

fn timeout() -> Duration {
    std::env::var("GREENRACK_FIRST_TOUCH_TIMEOUT_MS")
        .ok()
        .and_then(|ms| ms.parse().ok())
        .map_or(Duration::from_secs(10), Duration::from_millis)
}

fn program() -> std::ffi::OsString {
    std::env::var_os("GREENRACK_FIRST_TOUCH_NPX")
        .unwrap_or_else(|| if cfg!(windows) { "npx.cmd" } else { "npx" }.into())
}

/// Why the CLI gave no index.
enum CliFailure {
    Spawn(io::Error),
    Wait(io::Error),
    Timeout,
    /// It exited 0, but a process it left behind kept its output open.
    OutputOpen,
    Exit {
        code: Option<i32>,
        last: String,
    },
}

impl fmt::Display for CliFailure {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CliFailure::Spawn(err) => write!(f, "cannot start npx: {err}"),
            CliFailure::Wait(err) => write!(f, "cannot wait for npx: {err}"),
            CliFailure::Timeout => f.write_str("timeout"),
            CliFailure::OutputOpen => f.write_str("output left open"),
            CliFailure::Exit { code, last } => {
                let code = code.map_or_else(|| "signal".to_string(), |c| c.to_string());
                if last.is_empty() {
                    write!(f, "exit {code}")
                } else {
                    write!(f, "exit {code}: {last}")
                }
            }
        }
    }
}

/// Start `npx … hook first-touch` in the root with the event on stdin; its
/// stdout when it exits 0 in time, else why not. A timeout kills the tree,
/// and so does every exit: nothing it started outlives the call.
fn run_cli(
    event_name: &str,
    input: Vec<u8>,
    root: &Path,
    root_text: &str,
    unavailable: Option<&str>,
) -> Result<String, CliFailure> {
    let mut command = Command::new(program());
    command
        .args(["-y", PACKAGE, "hook", "first-touch"])
        .current_dir(root)
        .env("GREENRACK_FIRST_TOUCH_PROTOCOL", PROTOCOL)
        .env("GREENRACK_FIRST_TOUCH_ROOT", root_text)
        .env("GREENRACK_FIRST_TOUCH_EVENT", event_name)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    match unavailable {
        Some(reason) => command.env("GREENRACK_FIRST_TOUCH_UNAVAILABLE", reason),
        None => command.env_remove("GREENRACK_FIRST_TOUCH_UNAVAILABLE"),
    };
    // holds-until: a report of an npx outliving a killed hook. Its own group
    // keeps npx from this binary's signals, so when Claude Code kills the
    // binary first (a cancelled hook; its 15 s cap is above our 10 s), the
    // group runs on until npx ends by itself.
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }
    let mut child = command.spawn().map_err(CliFailure::Spawn)?;
    let tree = Tree::of(&child);
    if let Some(mut stdin) = child.stdin.take() {
        thread::spawn(move || {
            let _ = stdin.write_all(&input); // the CLI may exit unread; its exit status tells the outcome
        });
    }
    let stdout = reader(child.stdout.take());
    let stderr = reader(child.stderr.take());
    let deadline = Instant::now() + timeout();
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if Instant::now() < deadline => thread::sleep(Duration::from_millis(10)),
            Ok(None) => {
                tree.kill(&mut child);
                reap(&mut child);
                return Err(CliFailure::Timeout);
            }
            Err(err) => {
                tree.kill(&mut child);
                reap(&mut child);
                return Err(CliFailure::Wait(err));
            }
        }
    };
    // Whatever npx left running goes now, so its pipes close.
    tree.kill(&mut child);
    let grace = Duration::from_secs(1);
    if !status.success() {
        let err = stderr.recv_timeout(grace).unwrap_or_default();
        let err = String::from_utf8_lossy(&err);
        let last = err
            .lines()
            .rev()
            .find(|l| !l.trim().is_empty())
            .unwrap_or("");
        return Err(CliFailure::Exit {
            code: status.code(),
            last: last.trim().chars().take(200).collect(),
        });
    }
    let out = stdout
        .recv_timeout(grace)
        .map_err(|_| CliFailure::OutputOpen)?;
    Ok(String::from_utf8_lossy(&out).into_owned())
}

fn reap(child: &mut Child) {
    let _ = child.wait(); // the kill is sent; a failed wait leaves a zombie that init reaps
}

/// Read a pipe on its own thread, so a grandchild holding it never blocks the hook.
fn reader<R: Read + Send + 'static>(pipe: Option<R>) -> mpsc::Receiver<Vec<u8>> {
    let (send, receive) = mpsc::channel();
    if let Some(mut pipe) = pipe {
        thread::spawn(move || {
            let mut bytes = Vec::new();
            let _ = pipe.read_to_end(&mut bytes); // an error keeps the bytes read so far, sent below
            let _ = send.send(bytes); // the receiver gave up at its deadline
        });
    }
    receive
}

/// The child and everything it started.
#[cfg(unix)]
struct Tree(Option<i32>);

#[cfg(unix)]
impl Tree {
    fn of(child: &Child) -> Tree {
        Tree(i32::try_from(child.id()).ok())
    }

    fn kill(&self, child: &mut Child) {
        // The child leads its own process group (`process_group(0)`), which
        // outlives it while anything it started still runs.
        if let Some(pid) = self.0 {
            // SAFETY: killpg only sends a signal; a gone group is ESRCH.
            unsafe {
                libc::killpg(pid, libc::SIGKILL);
            }
        }
        let _ = child.kill(); // already ended by the group kill, or exited: both are fine
    }
}

#[cfg(windows)]
struct Tree(Option<job::Job>);

#[cfg(windows)]
impl Tree {
    fn of(child: &Child) -> Tree {
        Tree(job::Job::for_child(child))
    }

    fn kill(&self, child: &mut Child) {
        if let Some(job) = &self.0 {
            job.kill();
        }
        let _ = child.kill(); // already ended with the job, or exited: both are fine
    }
}

#[cfg(windows)]
mod job {
    use std::os::windows::io::AsRawHandle;
    use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
    use windows_sys::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
        SetInformationJobObject, TerminateJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
        JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    };

    /// A Job Object holding the child: closing or terminating it ends the tree.
    pub struct Job(HANDLE);

    impl Job {
        // holds-until: a report of a node outliving a timeout on Windows. The
        // child joins the job once started, so a process it starts before the
        // assignment escapes the kill; then start it suspended and resume it
        // after the assignment.
        pub fn for_child(child: &std::process::Child) -> Option<Job> {
            // SAFETY: plain Win32 calls on handles this function owns or borrows.
            unsafe {
                let handle = CreateJobObjectW(std::ptr::null(), std::ptr::null());
                if handle.is_null() {
                    return None;
                }
                let job = Job(handle);
                let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
                info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
                let size = u32::try_from(std::mem::size_of_val(&info)).ok()?;
                let set = SetInformationJobObject(
                    job.0,
                    JobObjectExtendedLimitInformation,
                    std::ptr::addr_of!(info).cast(),
                    size,
                );
                if set == 0 {
                    return None;
                }
                if AssignProcessToJobObject(job.0, child.as_raw_handle() as HANDLE) == 0 {
                    return None;
                }
                Some(job)
            }
        }

        pub fn kill(&self) {
            // SAFETY: the handle is valid until drop.
            unsafe {
                let _ = TerminateJobObject(self.0, 1); // a failure leaves child.kill() to end npx itself
            }
        }
    }

    impl Drop for Job {
        fn drop(&mut self) {
            // SAFETY: the handle was created by CreateJobObjectW and is closed once.
            unsafe {
                CloseHandle(self.0);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ids_are_one_safe_path_segment() {
        assert_eq!(
            Id::parse("abc-1_2").map(|id| id.0).as_deref(),
            Some("abc-1_2")
        );
        for bad in ["", "../x", "a/b", "a b", "a\\b", "é"] {
            assert!(Id::parse(bad).is_none(), "{bad:?}");
        }
    }

    #[test]
    fn windows_paths_get_one_spelling() {
        assert_eq!(windows_spelling(r"\\?\C:\Repo\App"), "c:/repo/app");
        assert_eq!(windows_spelling(r"C:\Repo\App"), "c:/repo/app");
        assert_eq!(
            windows_spelling(r"\\?\UNC\server\share\r"),
            "//server/share/r"
        );
        assert_eq!(strip_verbatim("/Users/me/App"), "/Users/me/App");
    }

    #[test]
    fn root_keys_are_fixed_width_and_tell_nested_roots_apart() {
        let outer = root_key("/r");
        let inner = root_key("/r/sub");
        assert_eq!(outer.len(), 16);
        assert_eq!(inner.len(), 16);
        assert_ne!(outer, inner);
        assert_eq!(root_key("/r"), outer);
    }

    #[test]
    fn a_missing_failure_record_is_no_back_off() {
        assert!(read_failures(Path::new("/nonexistent/greenrack/failures")).is_none());
    }

    #[test]
    fn an_empty_failure_reason_is_no_reason() {
        let dir = std::env::temp_dir().join(format!("{NAME}-unit-{}", nanos()));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("f");
        fs::write(&path, "2 1.5 ").unwrap();
        let failures = read_failures(&path).unwrap();
        assert_eq!((failures.count, failures.reason), (2, None));
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn failures_read_as_the_strings_the_log_keeps() {
        let exit = CliFailure::Exit {
            code: Some(1),
            last: "boom".to_string(),
        };
        assert_eq!(exit.to_string(), "exit 1: boom");
        let bare = CliFailure::Exit {
            code: None,
            last: String::new(),
        };
        assert_eq!(bare.to_string(), "exit signal");
        assert_eq!(CliFailure::Timeout.to_string(), "timeout");
    }

    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("{NAME}-{name}-{}", nanos()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    // Opening a directory to set its time is Unix-only in std.
    #[cfg(unix)]
    #[test]
    fn a_stale_claim_is_taken_and_a_fresh_one_is_not() {
        let dir = scratch("claim");
        let marker = dir.join(".m");
        fs::create_dir(&marker).unwrap();
        assert!(!claim(&marker), "a fresh claim is another call's work");
        let old = SystemTime::now() - Duration::from_secs(3600);
        fs::File::open(&marker).unwrap().set_modified(old).unwrap();
        assert!(claim(&marker), "a claim older than the TTL is taken");
        assert!(age(&marker).is_some_and(|age| age < claim_ttl()));
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn standing_down_puts_a_live_claim_back_unless_the_path_is_held() {
        let dir = scratch("stand-down");
        let marker = dir.join(".m");
        let aside = dir.join(".m.stale");
        fs::create_dir(&aside).unwrap();
        stand_down(&aside, &marker);
        assert!(marker.is_dir() && !aside.exists(), "put back where it was");
        // An empty marker made by a third caller in between stays theirs.
        fs::create_dir(&aside).unwrap();
        fs::write(aside.join("mine"), b"").unwrap();
        stand_down(&aside, &marker);
        assert!(marker.is_dir() && !marker.join("mine").exists() && !aside.exists());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn only_the_two_hook_events_are_calls() {
        let mut event = Event {
            hook_event_name: Some("Stop".to_string()),
            cwd: Some("/".to_string()),
            ..Event::default()
        };
        assert!(Call::of(&event).is_none());
        event.hook_event_name = Some("SessionStart".to_string());
        assert_eq!(
            Call::of(&event).map(|c| c.event_name()),
            Some("SessionStart")
        );
        event.hook_event_name = None;
        assert!(Call::of(&event).is_none());
    }
}
