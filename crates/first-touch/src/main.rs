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
//! `--protocol` prints the protocol this binary speaks with the CLI and reads
//! no stdin; `greenrack hook install --user --check` asks it.

use serde::Deserialize;
use std::fs;
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

/// Bumped when the stdin, environment or stdout contract with the CLI changes.
const PROTOCOL: &str = "1";
const NAME: &str = "greenrack-first-touch";
/// The CLI the hook starts. The floor is the first release with `hook first-touch`.
const PACKAGE: &str = "@greenharness/greenrack-cli@^7.7.0";
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

fn main() {
    if std::env::args().nth(1).as_deref() == Some("--protocol") {
        let _ = writeln!(io::stdout(), "{PROTOCOL}");
        std::process::exit(0);
    }
    std::panic::set_hook(Box::new(|info| {
        let _ = writeln!(io::stderr(), "{NAME}: {info}");
    }));
    if let Ok(Some(text)) = std::panic::catch_unwind(run) {
        let mut out = io::stdout().lock();
        let _ = out.write_all(text.as_bytes());
        let _ = out.flush();
    }
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
    let session = safe_id(event.session_id.as_deref()?)?;
    let agent = match event.agent_id.as_deref() {
        Some(id) => safe_id(id)?,
        None => "main".to_string(),
    };
    let start = event.hook_event_name.as_deref() == Some("SessionStart");
    let session_dir = state.join(&session);
    // The earlier context is gone after a resume, a compact or a clear.
    if start
        && matches!(
            event.source.as_deref(),
            Some("resume" | "compact" | "clear")
        )
    {
        let _ = fs::remove_dir_all(&session_dir);
    }
    let touched = if start {
        PathBuf::from(event.cwd.as_deref()?)
    } else {
        touched_dir(&event)?
    };
    let root = git_root(&touched)?;
    let root_text = normalize(&root.to_string_lossy(), cfg!(windows));
    let key = root_key(&root_text);
    let marker = session_dir.join(&agent).join(&key).join(".m");
    if is_hit(&marker) {
        return None;
    }
    let first_of_session = !session_dir.exists();
    let record = |outcome: &str, ms: Option<u128>| {
        log(&state, &event, &session, &agent, &root_text, outcome, ms);
    };
    if !is_consumer(&root) {
        if claim(&marker) {
            finish(&marker, &root_text);
            record("not a consumer", None);
        }
        return None;
    }
    if start && OWN_HOOKS.iter().any(|hook| root.join(hook).exists()) {
        if claim(&marker) {
            finish(&marker, &root_text);
            record("own hook", None);
        }
        return None;
    }
    let failures = state.join("failures").join(&key);
    let previous = read_failures(&failures);
    if previous.as_ref().is_some_and(|f| f.backing_off()) {
        return None;
    }
    if !claim(&marker) {
        return None;
    }
    if first_of_session {
        prune(&state);
    }
    let unavailable = if start {
        previous.map(|f| f.reason)
    } else {
        None
    };
    let started = Instant::now();
    let result = run_cli(&event, &input, &root, &root_text, unavailable.as_deref());
    let ms = Some(started.elapsed().as_millis());
    match result {
        Ok(text) => {
            let _ = fs::remove_file(&failures);
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
        Err(reason) => {
            let _ = fs::remove_dir_all(&marker);
            note_failure(&failures, &reason);
            record(&format!("failed: {reason}"), ms);
            let _ = writeln!(io::stderr(), "{NAME}: no index for {root_text} ({reason})");
            None
        }
    }
}

/// An id that is safe as one path segment.
fn safe_id(id: &str) -> Option<String> {
    let ok = !id.is_empty()
        && id.len() <= 128
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_');
    ok.then(|| id.to_string())
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

/// One spelling per root: `\\?\` dropped, and on Windows `/` and lower case.
fn normalize(path: &str, windows: bool) -> String {
    let path = if let Some(rest) = path.strip_prefix(r"\\?\UNC\") {
        format!(r"\\{rest}")
    } else if let Some(rest) = path.strip_prefix(r"\\?\") {
        rest.to_string()
    } else {
        path.to_string()
    };
    if windows {
        path.replace('\\', "/").to_lowercase()
    } else {
        path
    }
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
            let _ = fs::remove_dir_all(&aside);
            fs::create_dir(marker).is_ok()
        }
        Err(_) => false,
    }
}

fn finish(marker: &Path, root: &str) {
    let _ = fs::write(marker.join("root"), root);
    let _ = fs::write(marker.join("done"), b"");
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

struct Failures {
    count: u32,
    at: f64,
    reason: String,
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
    let reason = parts.next().unwrap_or("").trim().to_string();
    Some(Failures { count, at, reason })
}

fn note_failure(path: &Path, reason: &str) {
    let count = read_failures(path)
        .filter(|f| now_secs() - f.at < FAIL_WINDOW.as_secs_f64())
        .map_or(0, |f| f.count);
    let Some(parent) = path.parent() else {
        return;
    };
    let _ = fs::create_dir_all(parent);
    // Staged and renamed: a parallel call never reads half a counter.
    let staged = parent.join(format!(".tmp.{}.{}", std::process::id(), nanos()));
    let line = format!("{} {} {}", count + 1, now_secs(), reason.replace('\n', " "));
    if fs::write(&staged, line).is_ok() && fs::rename(&staged, path).is_err() {
        let _ = fs::remove_file(&staged);
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
                let _ = fs::remove_dir_all(&path);
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
                let _ = fs::rename(&staged, &log);
            }
        }
    }
}

fn log(
    state: &Path,
    event: &Event,
    session: &str,
    agent: &str,
    root: &str,
    outcome: &str,
    ms: Option<u128>,
) {
    let line = serde_json::json!({
        "ts": now_secs(),
        "event": event.hook_event_name.as_deref().unwrap_or(""),
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
            let _ = writeln!(file, "{line}");
        }
    }
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

/// Start `npx … hook first-touch` in the root with the event on stdin; its
/// stdout when it exits 0 in time, else why not. A timeout kills the tree.
fn run_cli(
    event: &Event,
    input: &[u8],
    root: &Path,
    root_text: &str,
    unavailable: Option<&str>,
) -> Result<String, String> {
    let mut command = Command::new(program());
    command
        .args(["-y", PACKAGE, "hook", "first-touch"])
        .current_dir(root)
        .env("GREENRACK_FIRST_TOUCH_ROOT", root_text)
        .env(
            "GREENRACK_FIRST_TOUCH_EVENT",
            event.hook_event_name.as_deref().unwrap_or(""),
        )
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    match unavailable {
        Some(reason) if !reason.is_empty() => {
            command.env("GREENRACK_FIRST_TOUCH_UNAVAILABLE", reason);
        }
        _ => {
            command.env_remove("GREENRACK_FIRST_TOUCH_UNAVAILABLE");
        }
    }
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }
    let mut child = command
        .spawn()
        .map_err(|err| format!("cannot start npx: {err}"))?;
    let tree = Tree::of(&child);
    if let Some(mut stdin) = child.stdin.take() {
        let input = input.to_vec();
        thread::spawn(move || {
            let _ = stdin.write_all(&input);
        });
    }
    let stdout = reader(child.stdout.take());
    let stderr = reader(child.stderr.take());
    let deadline = Instant::now() + timeout();
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if Instant::now() < deadline => thread::sleep(Duration::from_millis(10)),
            _ => {
                tree.kill(&mut child);
                let _ = child.wait();
                return Err("timeout".to_string());
            }
        }
    };
    let grace = Duration::from_secs(1);
    let out = stdout.recv_timeout(grace).unwrap_or_default();
    if !status.success() {
        let err = stderr.recv_timeout(grace).unwrap_or_default();
        let err = String::from_utf8_lossy(&err);
        let last = err
            .lines()
            .rev()
            .find(|l| !l.trim().is_empty())
            .unwrap_or("");
        let last: String = last.trim().chars().take(200).collect();
        let code = status
            .code()
            .map_or("signal".to_string(), |c| c.to_string());
        return Err(if last.is_empty() {
            format!("exit {code}")
        } else {
            format!("exit {code}: {last}")
        });
    }
    Ok(String::from_utf8_lossy(&out).into_owned())
}

/// Read a pipe on its own thread, so a grandchild holding it never blocks the hook.
fn reader<R: Read + Send + 'static>(pipe: Option<R>) -> mpsc::Receiver<Vec<u8>> {
    let (send, receive) = mpsc::channel();
    if let Some(mut pipe) = pipe {
        thread::spawn(move || {
            let mut bytes = Vec::new();
            let _ = pipe.read_to_end(&mut bytes);
            let _ = send.send(bytes);
        });
    }
    receive
}

/// The child and everything it started.
#[cfg(unix)]
struct Tree;

#[cfg(unix)]
impl Tree {
    fn of(_child: &Child) -> Tree {
        Tree
    }

    fn kill(&self, child: &mut Child) {
        // The child leads its own process group (`process_group(0)`).
        if let Ok(pid) = i32::try_from(child.id()) {
            // SAFETY: killpg only sends a signal; a gone group is ESRCH.
            unsafe {
                libc::killpg(pid, libc::SIGKILL);
            }
        }
        let _ = child.kill();
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
        let _ = child.kill();
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
                SetInformationJobObject(
                    job.0,
                    JobObjectExtendedLimitInformation,
                    std::ptr::addr_of!(info).cast(),
                    size,
                );
                if AssignProcessToJobObject(job.0, child.as_raw_handle() as HANDLE) == 0 {
                    return None;
                }
                Some(job)
            }
        }

        pub fn kill(&self) {
            // SAFETY: the handle is valid until drop.
            unsafe {
                TerminateJobObject(self.0, 1);
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
        assert_eq!(safe_id("abc-1_2").as_deref(), Some("abc-1_2"));
        for bad in ["", "../x", "a/b", "a b", "a\\b", "é"] {
            assert!(safe_id(bad).is_none(), "{bad:?}");
        }
    }

    #[test]
    fn windows_paths_get_one_spelling() {
        assert_eq!(normalize(r"\\?\C:\Repo\App", true), "c:/repo/app");
        assert_eq!(normalize(r"C:\Repo\App", true), "c:/repo/app");
        assert_eq!(
            normalize(r"\\?\UNC\server\share\r", true),
            "//server/share/r"
        );
        assert_eq!(normalize("/Users/me/App", false), "/Users/me/App");
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
}
