//! The hook's contract, run against the built binary with a fake `npx`.
//!
//! Spec: the 36 tests of the Python hook it replaces
//! (dotfiles `dot_claude/tools/greenrack-entry/test_entry.py`), mapped here:
//!
//! | Python test | Here |
//! |---|---|
//! | outside_a_repository_prints_nothing | `outside_a_repository_prints_nothing` |
//! | in_a_consumer_prints_plain_text_once | `session_start_in_a_consumer_prints_once` |
//! | resume_compact_and_clear_print_again | `resume_compact_and_clear_print_again` |
//! | a_session_started_outside_a_repo_gets_its_index_again_after_a_compact | `a_compact_clears_the_session_markers` |
//! | a_session_started_in_the_repo_is_told_once_after_a_compact | `resume_compact_and_clear_print_again` |
//! | a_repo_with_its_own_hook_stays_silent_and_is_marked | `a_repo_with_its_own_hook_stays_silent_and_is_marked` |
//! | a_subfolder_start_resolves_the_git_root | `a_subfolder_resolves_the_git_root` |
//! | first_read_in_a_consumer_returns_one_json_object_once | `first_read_in_a_consumer_prints_once` |
//! | a_session_started_in_the_repo_is_not_told_twice | `a_session_started_in_the_repo_is_not_told_twice` |
//! | a_subagent_gets_its_own_index | `a_subagent_gets_its_own_index` |
//! | another_session_is_told_again | `another_session_is_told_again` |
//! | bash_uses_the_cwd | `bash_uses_the_cwd` |
//! | a_cwd_outside_any_repository_prints_nothing | `outside_a_repository_prints_nothing` |
//! | a_file_in_another_repository_follows_the_file_not_the_cwd | `a_file_follows_its_own_repository` |
//! | a_write_into_a_folder_that_does_not_exist_yet | `a_write_into_a_new_folder` |
//! | a_notebook_path | `a_notebook_path` |
//! | a_relative_path_resolves_against_the_cwd | `a_relative_path_resolves_against_the_cwd` |
//! | a_worktree_marks_its_root_with_a_dot_git_file | `a_worktree_marks_its_root_with_a_dot_git_file` |
//! | a_symlinked_path_names_the_same_root | `a_symlinked_path_names_the_same_root` (unix) |
//! | a_repository_that_is_not_a_consumer_prints_nothing_quietly | `a_repository_that_is_not_a_consumer_prints_nothing` |
//! | the_consumer_test_looks_three_levels_down_and_skips_node_modules | `the_consumer_test_looks_three_levels_down` |
//! | a_command_with_no_output_keeps_the_marker | `a_command_with_no_output_keeps_the_marker` |
//! | context_over_the_cap_is_cut | `output_over_the_cap_is_dropped` (the CLI cuts; the binary refuses what it cannot pass) |
//! | a_failing_command_exits_zero_and_the_next_call_retries | `a_failing_command_exits_zero_and_retries` |
//! | a_hanging_command_is_killed_at_the_timeout | `a_hanging_command_is_killed_at_the_timeout` |
//! | output_that_is_not_utf8_still_gives_the_index | `output_that_is_not_utf8_still_gives_the_index` |
//! | a_timeout_kills_the_commands_children_too | `a_timeout_kills_the_commands_children_too` |
//! | a_log_over_a_megabyte_is_cut_to_its_last_lines | `a_log_over_a_megabyte_is_cut` |
//! | three_failures_back_off_instead_of_running_again | `three_failures_back_off` |
//! | garbage_input_exits_zero_quietly | `garbage_input_exits_zero` |
//! | a_missing_command_exits_zero | `a_missing_command_exits_zero` |
//! | a_call_that_finds_its_marker_imports_neither_json_nor_re | n/a (Python): `a_hit_starts_no_process` |
//! | escaped_characters_in_a_path_still_read | `escaped_characters_in_a_path_still_read` |
//! | a_payload_the_scanner_cannot_read_is_left_to_json | n/a (Python): covered by `garbage_input_exits_zero` |
//! | parallel_calls_print_the_index_once | `parallel_calls_print_and_run_once` |
//! | a_call_adds_little_to_an_empty_interpreter_start | `a_hit_is_close_to_an_empty_start` (ignored; release build) |
//!
//! Added for the binary: `protocol_answers_without_reading_stdin`,
//! `a_forced_panic_exits_zero`, `a_stale_claim_is_reclaimed_once`,
//! `a_failure_reason_reaches_the_next_session_start`.

use serde_json::{json, Value};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};
use std::time::{Duration, Instant};

const BIN: &str = env!("CARGO_BIN_EXE_greenrack-first-touch");
const NEEDLE: &str = "@greenharness/greenrack-";

fn fake_npx() -> PathBuf {
    // target/<profile>/deps/contract-… → target/<profile>/examples/fake_npx
    let exe = std::env::current_exe().expect("test path");
    let profile = exe.parent().and_then(Path::parent).expect("target dir");
    let name = if cfg!(windows) {
        "fake_npx.exe"
    } else {
        "fake_npx"
    };
    let path = profile.join("examples").join(name);
    assert!(
        path.exists(),
        "{} is missing: run `cargo test`, which builds the examples",
        path.display()
    );
    path
}

struct Case {
    tmp: PathBuf,
    state: PathBuf,
}

/// One number per case: two tests started in the same clock tick once got the
/// same folder, and one's cleanup deleted the other's state mid-run.
static NEXT_CASE: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);

impl Case {
    fn new() -> Case {
        let n = NEXT_CASE.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        let tmp = std::env::temp_dir().join(format!(
            "gft-{}-{n}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&tmp).unwrap();
        let tmp = std::fs::canonicalize(&tmp).unwrap();
        let state = tmp.join("state");
        Case { tmp, state }
    }

    /// A repository: a `.git` folder, and a consumer `package.json` when asked.
    fn repo(&self, name: &str, consumer: bool) -> PathBuf {
        let root = self.tmp.join(name);
        std::fs::create_dir_all(root.join(".git")).unwrap();
        if consumer {
            self.package(&root.join("package.json"));
        }
        root
    }

    fn package(&self, path: &Path) {
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(path, format!(r#"{{"dependencies":{{"{NEEDLE}ui":"1"}}}}"#)).unwrap();
    }

    fn command(&self, mode: &str) -> Command {
        let mut command = Command::new(BIN);
        command
            .env("GREENRACK_FIRST_TOUCH_NPX", fake_npx())
            .env("FAKE_MODE", mode)
            .env("XDG_STATE_HOME", &self.state)
            .env("LOCALAPPDATA", &self.state)
            .env_remove("GREENRACK_FIRST_TOUCH_PANIC")
            .env_remove("GREENRACK_FIRST_TOUCH_TIMEOUT_MS")
            .env_remove("GREENRACK_FIRST_TOUCH_CLAIM_TTL_MS")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        command
    }

    fn run_with(&self, mut command: Command, event: &[u8]) -> Output {
        let mut child = command.spawn().expect("start the hook");
        child.stdin.take().unwrap().write_all(event).unwrap();
        child.wait_with_output().unwrap()
    }

    fn run(&self, event: &Value, mode: &str) -> Output {
        self.run_with(self.command(mode), event.to_string().as_bytes())
    }

    fn count(&self) -> PathBuf {
        self.tmp.join("count")
    }

    fn runs(&self) -> usize {
        std::fs::read(self.count()).map_or(0, |b| b.len())
    }

    fn log(&self) -> String {
        std::fs::read_to_string(self.state.join("greenrack-first-touch/log.jsonl"))
            .unwrap_or_default()
    }
}

impl Drop for Case {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.tmp); // a left temp folder costs disk only
    }
}

fn read(root: &Path, session: &str) -> Value {
    json!({
        "session_id": session,
        "cwd": root,
        "hook_event_name": "PreToolUse",
        "tool_name": "Read",
        "tool_input": {"file_path": root.join("src").join("a.ts")},
    })
}

fn start(cwd: &Path, session: &str, source: &str) -> Value {
    json!({"session_id": session, "cwd": cwd, "hook_event_name": "SessionStart", "source": source})
}

fn stdout(output: &Output) -> String {
    String::from_utf8_lossy(&output.stdout).into_owned()
}

fn quiet(output: &Output) -> bool {
    output.status.code() == Some(0) && output.stdout.is_empty()
}

fn gave(output: &Output) -> bool {
    output.status.code() == Some(0) && stdout(output).contains("INDEX BODY")
}

#[test]
fn protocol_answers_without_reading_stdin() {
    let mut child = Command::new(BIN)
        .arg("--protocol")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .unwrap();
    // stdin stays open: an answer that waited for it would hang here.
    let started = Instant::now();
    let status = loop {
        if let Some(status) = child.try_wait().unwrap() {
            break status;
        }
        assert!(
            started.elapsed() < Duration::from_secs(10),
            "--protocol waited for stdin"
        );
        std::thread::sleep(Duration::from_millis(20));
    };
    let output = child.wait_with_output().unwrap();
    assert_eq!(status.code(), Some(0));
    assert_eq!(String::from_utf8_lossy(&output.stdout).trim(), "1");
}

#[test]
fn a_forced_panic_exits_zero() {
    let case = Case::new();
    let root = case.repo("app", true);
    let mut command = case.command("ok");
    command.env("GREENRACK_FIRST_TOUCH_PANIC", "1");
    let output = case.run_with(command, read(&root, "s1").to_string().as_bytes());
    assert!(quiet(&output), "{output:?}");
}

#[test]
fn garbage_input_exits_zero() {
    let case = Case::new();
    for input in [
        &b"not json"[..],
        b"[1, 2]",
        b"",
        b"{\"session_id\": \"s\"} junk",
        b"{\"session_id\": ",
    ] {
        let output = case.run_with(case.command("ok"), input);
        assert!(quiet(&output), "{input:?}");
    }
}

#[test]
fn an_unsafe_session_id_exits_zero() {
    let case = Case::new();
    let root = case.repo("app", true);
    for id in ["../x", "a/b", ""] {
        assert!(quiet(&case.run(&read(&root, id), "ok")), "{id:?}");
    }
    assert_eq!(case.runs(), 0);
}

#[test]
fn outside_a_repository_prints_nothing() {
    let case = Case::new();
    let plain = case.tmp.join("plain");
    std::fs::create_dir_all(&plain).unwrap();
    let output = case.run(&start(&plain, "s1", "startup"), "ok");
    assert!(quiet(&output) && output.stderr.is_empty(), "{output:?}");
    let bash = json!({"session_id": "s1", "cwd": plain, "hook_event_name": "PreToolUse", "tool_name": "Bash", "tool_input": {"command": "ls"}});
    assert!(quiet(&case.run(&bash, "ok")));
}

#[test]
fn session_start_in_a_consumer_prints_once() {
    let case = Case::new();
    let root = case.repo("app", true);
    let first = case.run(&start(&root, "s1", "startup"), "ok");
    assert!(gave(&first), "{first:?}");
    assert!(stdout(&first).contains("event=SessionStart"));
    assert!(quiet(&case.run(&start(&root, "s1", "startup"), "ok")));
}

#[test]
fn resume_compact_and_clear_print_again() {
    let case = Case::new();
    let root = case.repo("app", true);
    case.run(&start(&root, "s1", "startup"), "ok");
    for source in ["resume", "compact", "clear"] {
        assert!(
            gave(&case.run(&start(&root, "s1", source), "ok")),
            "{source}"
        );
    }
    assert!(quiet(&case.run(&read(&root, "s1"), "ok")));
}

#[test]
fn a_compact_clears_the_session_markers() {
    let case = Case::new();
    let plain = case.tmp.join("plain");
    std::fs::create_dir_all(&plain).unwrap();
    let root = case.repo("app", true);
    assert!(gave(&case.run(&read(&root, "s1"), "ok")));
    assert!(quiet(&case.run(&read(&root, "s1"), "ok")));
    assert!(quiet(&case.run(&start(&plain, "s1", "compact"), "ok")));
    assert!(gave(&case.run(&read(&root, "s1"), "ok")));
}

#[test]
fn a_repo_with_its_own_hook_stays_silent_and_is_marked() {
    let case = Case::new();
    let root = case.repo("app", true);
    std::fs::create_dir_all(root.join(".claude/hooks")).unwrap();
    std::fs::write(root.join(".claude/hooks/greenrack-catalog.sh"), "").unwrap();
    assert!(quiet(&case.run(&start(&root, "s1", "startup"), "ok")));
    assert!(quiet(&case.run(&read(&root, "s1"), "ok")));
    assert_eq!(case.runs(), 0);
}

#[test]
fn a_subfolder_resolves_the_git_root() {
    let case = Case::new();
    let root = case.repo("app", true);
    let sub = root.join("packages/x");
    std::fs::create_dir_all(&sub).unwrap();
    let output = case.run(&start(&sub, "s1", "startup"), "ok");
    let want = if cfg!(windows) {
        let real = std::fs::canonicalize(&root)
            .unwrap()
            .to_string_lossy()
            .into_owned();
        let real = real.strip_prefix(r"\\?\").unwrap_or(&real).to_string();
        real.replace('\\', "/").to_lowercase()
    } else {
        root.display().to_string()
    };
    assert!(
        stdout(&output).contains(&format!("root={want}")),
        "{output:?}"
    );
    assert!(gave(&output));
}

#[test]
fn first_read_in_a_consumer_prints_once() {
    let case = Case::new();
    let root = case.repo("app", true);
    let mut command = case.command("ok");
    command.env("FAKE_COUNT", case.count());
    let first = case.run_with(command, read(&root, "s1").to_string().as_bytes());
    assert!(gave(&first), "{first:?}");
    assert!(stdout(&first).contains("event=PreToolUse"));
    assert!(quiet(&case.run(&read(&root, "s1"), "ok")));
    assert_eq!(case.runs(), 1);
}

#[test]
fn a_session_started_in_the_repo_is_not_told_twice() {
    let case = Case::new();
    let root = case.repo("app", true);
    case.run(&start(&root, "s1", "startup"), "ok");
    assert!(quiet(&case.run(&read(&root, "s1"), "ok")));
}

#[test]
fn a_subagent_gets_its_own_index() {
    let case = Case::new();
    let root = case.repo("app", true);
    case.run(&read(&root, "s1"), "ok");
    let mut event = read(&root, "s1");
    event["agent_id"] = json!("a1");
    assert!(gave(&case.run(&event, "ok")));
    assert!(quiet(&case.run(&event, "ok")));
}

#[test]
fn another_session_is_told_again() {
    let case = Case::new();
    let root = case.repo("app", true);
    case.run(&read(&root, "s1"), "ok");
    assert!(gave(&case.run(&read(&root, "s2"), "ok")));
}

#[test]
fn bash_uses_the_cwd() {
    let case = Case::new();
    let root = case.repo("app", true);
    let bash = json!({"session_id": "s1", "cwd": root, "hook_event_name": "PreToolUse", "tool_name": "Bash", "tool_input": {"command": "ls"}});
    assert!(gave(&case.run(&bash, "ok")));
}

#[test]
fn a_file_follows_its_own_repository() {
    let case = Case::new();
    let plain = case.tmp.join("plain");
    std::fs::create_dir_all(&plain).unwrap();
    let root = case.repo("app", true);
    let mut event = read(&root, "s1");
    event["cwd"] = json!(plain);
    assert!(gave(&case.run(&event, "ok")));
}

#[test]
fn a_write_into_a_new_folder() {
    let case = Case::new();
    let root = case.repo("app", true);
    let mut event = read(&root, "s1");
    event["tool_name"] = json!("Write");
    event["tool_input"] = json!({"file_path": root.join("new/deeper/file.ts"), "content": "x"});
    assert!(gave(&case.run(&event, "ok")));
}

#[test]
fn a_notebook_path() {
    let case = Case::new();
    let root = case.repo("app", true);
    let mut event = read(&root, "s1");
    event["tool_name"] = json!("NotebookEdit");
    event["tool_input"] = json!({"notebook_path": root.join("notes/a.ipynb")});
    assert!(gave(&case.run(&event, "ok")));
}

#[test]
fn a_relative_path_resolves_against_the_cwd() {
    let case = Case::new();
    let root = case.repo("app", true);
    let mut event = read(&root, "s1");
    event["tool_input"] = json!({"file_path": "src/a.ts"});
    assert!(gave(&case.run(&event, "ok")));
}

#[test]
fn escaped_characters_in_a_path_still_read() {
    let case = Case::new();
    let root = case.repo("app", true);
    let mut event = read(&root, "s1");
    event["tool_input"] = json!({"file_path": root.join("src").join("é \"q\".ts")});
    assert!(gave(&case.run(&event, "ok")));
}

#[test]
fn a_worktree_marks_its_root_with_a_dot_git_file() {
    let case = Case::new();
    let root = case.tmp.join("wt");
    std::fs::create_dir_all(&root).unwrap();
    std::fs::write(root.join(".git"), "gitdir: /nowhere/.git/worktrees/wt\n").unwrap();
    case.package(&root.join("package.json"));
    assert!(gave(&case.run(&read(&root, "s1"), "ok")));
}

#[cfg(unix)]
#[test]
fn a_symlinked_path_names_the_same_root() {
    let case = Case::new();
    let root = case.repo("app", true);
    let link = case.tmp.join("link");
    std::os::unix::fs::symlink(&root, &link).unwrap();
    case.run(&read(&root, "s1"), "ok");
    assert!(quiet(&case.run(&read(&link, "s1"), "ok")));
}

#[test]
fn a_repository_that_is_not_a_consumer_prints_nothing() {
    let case = Case::new();
    let root = case.repo("other", false);
    let mut command = case.command("ok");
    command.env("FAKE_COUNT", case.count());
    let output = case.run_with(command, read(&root, "s1").to_string().as_bytes());
    assert!(quiet(&output) && output.stderr.is_empty(), "{output:?}");
    assert_eq!(case.runs(), 0);
    assert!(case.log().contains("not a consumer"));
}

#[test]
fn the_consumer_test_looks_three_levels_down() {
    let case = Case::new();
    let deep = case.repo("deep", false);
    case.package(&deep.join("packages/ui/package.json"));
    assert!(gave(&case.run(&read(&deep, "s1"), "ok")));
    let hidden = case.repo("hidden", false);
    case.package(&hidden.join("node_modules/x/package.json"));
    assert!(quiet(&case.run(&read(&hidden, "s1"), "ok")));
    let too_deep = case.repo("toodeep", false);
    case.package(&too_deep.join("a/b/c/package.json"));
    assert!(quiet(&case.run(&read(&too_deep, "s1"), "ok")));
}

#[test]
fn nested_roots_keep_separate_markers() {
    let case = Case::new();
    let outer = case.repo("outer", true);
    let inner = outer.join("sub");
    std::fs::create_dir_all(inner.join(".git")).unwrap();
    case.package(&inner.join("package.json"));
    assert!(gave(&case.run(&read(&inner, "s1"), "ok")));
    assert!(gave(&case.run(&read(&outer, "s1"), "ok")));
}

#[test]
fn a_command_with_no_output_keeps_the_marker() {
    let case = Case::new();
    let root = case.repo("app", true);
    for _ in 0..2 {
        let mut command = case.command("empty");
        command.env("FAKE_COUNT", case.count());
        assert!(quiet(
            &case.run_with(command, read(&root, "s1").to_string().as_bytes())
        ));
    }
    assert_eq!(case.runs(), 1);
}

#[test]
fn output_over_the_cap_is_dropped() {
    let case = Case::new();
    let root = case.repo("app", true);
    assert!(quiet(&case.run(&read(&root, "s1"), "big")));
    assert!(case.log().contains("too large"));
}

#[test]
fn a_failing_command_exits_zero_and_retries() {
    let case = Case::new();
    let root = case.repo("app", true);
    let failed = case.run(&read(&root, "s1"), "fail");
    assert!(quiet(&failed), "{failed:?}");
    let err = String::from_utf8_lossy(&failed.stderr);
    assert_eq!(err.trim().lines().count(), 1, "{err}");
    assert!(err.contains("boom: registry unreachable"), "{err}");
    assert!(gave(&case.run(&read(&root, "s1"), "ok")));
}

#[test]
fn a_failure_reason_reaches_the_next_session_start() {
    let case = Case::new();
    let root = case.repo("app", true);
    case.run(&read(&root, "s1"), "fail");
    let output = case.run(&start(&root, "s2", "startup"), "ok");
    assert!(
        stdout(&output).contains("unavailable=exit 1: boom"),
        "{output:?}"
    );
}

#[test]
fn three_failures_back_off() {
    let case = Case::new();
    let root = case.repo("app", true);
    for _ in 0..5 {
        let mut command = case.command("fail");
        command.env("FAKE_COUNT", case.count());
        case.run_with(command, read(&root, "s1").to_string().as_bytes());
    }
    assert_eq!(case.runs(), 3);
}

#[test]
fn a_hanging_command_is_killed_at_the_timeout() {
    let case = Case::new();
    let root = case.repo("app", true);
    let mut command = case.command("hang");
    command.env("GREENRACK_FIRST_TOUCH_TIMEOUT_MS", "1000");
    let started = Instant::now();
    let output = case.run_with(command, read(&root, "s1").to_string().as_bytes());
    assert!(
        // The bound plus one second: the plan's promise.
        started.elapsed() < Duration::from_millis(1000) + Duration::from_secs(1),
        "{:?}",
        started.elapsed()
    );
    assert!(quiet(&output));
    assert!(gave(&case.run(&read(&root, "s1"), "ok")));
}

fn alive(pid: u32) -> bool {
    if cfg!(windows) {
        let out = Command::new("tasklist")
            .args(["/FI", &format!("PID eq {pid}"), "/NH"])
            .output()
            .unwrap();
        String::from_utf8_lossy(&out.stdout).contains(&pid.to_string())
    } else {
        Command::new("kill")
            .args(["-0", &pid.to_string()])
            .stderr(Stdio::null())
            .status()
            .is_ok_and(|s| s.success())
    }
}

#[test]
fn a_timeout_kills_the_commands_children_too() {
    let case = Case::new();
    let root = case.repo("app", true);
    let pid_file = case.tmp.join("child.pid");
    let mut command = case.command("hangchild");
    command
        .env("GREENRACK_FIRST_TOUCH_TIMEOUT_MS", "2000")
        .env("FAKE_PID", &pid_file);
    let started = Instant::now();
    let output = case.run_with(command, read(&root, "s1").to_string().as_bytes());
    // The bound plus one second: the plan's promise.
    assert!(started.elapsed() < Duration::from_millis(2000) + Duration::from_secs(1));
    assert!(quiet(&output));
    let pid: u32 = std::fs::read_to_string(&pid_file)
        .unwrap()
        .trim()
        .parse()
        .unwrap();
    let deadline = Instant::now() + Duration::from_secs(3);
    while alive(pid) {
        assert!(
            Instant::now() < deadline,
            "the grandchild {pid} outlived the timeout"
        );
        std::thread::sleep(Duration::from_millis(100));
    }
}

#[test]
fn output_that_is_not_utf8_still_gives_the_index() {
    let case = Case::new();
    let root = case.repo("app", true);
    let output = case.run(&read(&root, "s1"), "badbytes");
    assert!(gave(&output), "{output:?}");
    assert!(stdout(&output).contains('\u{fffd}'));
}

#[test]
fn a_missing_command_exits_zero() {
    let case = Case::new();
    let root = case.repo("app", true);
    let mut command = case.command("ok");
    command.env("GREENRACK_FIRST_TOUCH_NPX", case.tmp.join("no-such-npx"));
    let output = case.run_with(command, read(&root, "s1").to_string().as_bytes());
    assert!(quiet(&output));
    assert!(String::from_utf8_lossy(&output.stderr).contains("cannot start npx"));
}

#[test]
fn a_log_over_a_megabyte_is_cut() {
    let case = Case::new();
    let root = case.repo("app", true);
    let dir = case.state.join("greenrack-first-touch");
    std::fs::create_dir_all(&dir).unwrap();
    let lines: String = (0..30_000)
        .map(|n| format!("{}\n", json!({"n": n, "pad": "x".repeat(40)})))
        .collect();
    std::fs::write(dir.join("log.jsonl"), lines).unwrap();
    case.run(&read(&root, "fresh"), "ok");
    let log = case.log();
    let kept: Vec<&str> = log.lines().collect();
    assert_eq!(kept.len(), 2001);
    assert_eq!(serde_json::from_str::<Value>(kept[0]).unwrap()["n"], 28_000);
}

#[test]
fn parallel_calls_print_and_run_once() {
    let case = Case::new();
    let root = case.repo("app", true);
    let event = read(&root, "s1").to_string();
    let children: Vec<_> = (0..4)
        .map(|_| {
            let mut command = case.command("slow");
            command.env("FAKE_COUNT", case.count());
            let mut child = command.spawn().unwrap();
            child
                .stdin
                .take()
                .unwrap()
                .write_all(event.as_bytes())
                .unwrap();
            child
        })
        .collect();
    let printed = children
        .into_iter()
        .map(|c| c.wait_with_output().unwrap())
        .filter(|o| !o.stdout.is_empty())
        .count();
    assert_eq!(printed, 1);
    assert_eq!(case.runs(), 1);
}

#[test]
fn a_stale_claim_is_reclaimed_once() {
    let case = Case::new();
    let root = case.repo("app", true);
    let event = read(&root, "s1").to_string();
    // A claim left by a run killed outright: a hang, killed by the test.
    let mut stuck = case.command("hang");
    stuck.env("GREENRACK_FIRST_TOUCH_TIMEOUT_MS", "60000");
    let mut stuck = stuck.spawn().unwrap();
    stuck
        .stdin
        .take()
        .unwrap()
        .write_all(event.as_bytes())
        .unwrap();
    std::thread::sleep(Duration::from_millis(800));
    stuck.kill().unwrap();
    let _ = stuck.wait(); // killed above; its exit status is not under test
    std::thread::sleep(Duration::from_millis(400));
    let children: Vec<_> = (0..50)
        .map(|_| {
            let mut command = case.command("ok");
            command
                .env("FAKE_COUNT", case.count())
                .env("GREENRACK_FIRST_TOUCH_CLAIM_TTL_MS", "300");
            let mut child = command.spawn().unwrap();
            child
                .stdin
                .take()
                .unwrap()
                .write_all(event.as_bytes())
                .unwrap();
            child
        })
        .collect();
    let printed = children
        .into_iter()
        .map(|c| c.wait_with_output().unwrap())
        .filter(|o| !o.stdout.is_empty())
        .count();
    assert_eq!(printed, 1);
    assert_eq!(case.runs(), 1);
}

#[test]
fn a_hit_starts_no_process() {
    let case = Case::new();
    let root = case.repo("app", true);
    case.run(&read(&root, "s1"), "ok");
    // Once marked, a command that would fail is never reached.
    let mut command = case.command("fail");
    command.env("FAKE_COUNT", case.count());
    assert!(quiet(
        &case.run_with(command, read(&root, "s1").to_string().as_bytes())
    ));
    assert_eq!(case.runs(), 0);
}

/// Measured on a release build: `cargo test --release -- --ignored`. The
/// baseline is `sh` reading the same event: a process that takes the 1 MB in
/// and does nothing with it.
#[cfg(unix)]
#[test]
#[ignore]
fn a_hit_is_close_to_an_empty_start() {
    let case = Case::new();
    let root = case.repo("app", true);
    case.run(&read(&root, "s1"), "ok");
    let mut event = read(&root, "s1");
    event["tool_name"] = json!("Write");
    event["tool_input"] =
        json!({"file_path": root.join("src/a.ts"), "content": "y".repeat(1_000_000)});
    let bytes = event.to_string();
    let once = |argv: &[&str], input: &[u8]| {
        let started = Instant::now();
        let mut child = Command::new(argv[0])
            .args(&argv[1..])
            .env("XDG_STATE_HOME", &case.state)
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .spawn()
            .unwrap();
        let _ = child.stdin.take().unwrap().write_all(input); // a closed pipe shows as a fast run, never a slow one
        child.wait().unwrap();
        started.elapsed().as_secs_f64() * 1000.0
    };
    let (mut hits, mut empties) = (Vec::new(), Vec::new());
    for _ in 0..60 {
        hits.push(once(&[BIN], bytes.as_bytes()));
        empties.push(once(&["sh", "-c", "cat >/dev/null"], bytes.as_bytes()));
    }
    hits.sort_by(f64::total_cmp);
    empties.sort_by(f64::total_cmp);
    let overhead = hits[30] - empties[30];
    eprintln!(
        "hit p50 {:.1} ms, sh reading the event p50 {:.1} ms, overhead {overhead:.1} ms",
        hits[30], empties[30]
    );
    assert!(overhead < 10.0);
}

#[test]
fn the_cli_is_told_the_protocol() {
    let case = Case::new();
    let root = case.repo("app", true);
    assert!(stdout(&case.run(&read(&root, "s1"), "ok")).contains("protocol=1"));
}

#[test]
fn an_event_that_is_neither_start_nor_tool_prints_nothing() {
    let case = Case::new();
    let root = case.repo("app", true);
    let mut event = read(&root, "s1");
    event["hook_event_name"] = json!("PostToolUse");
    assert!(quiet(&case.run(&event, "ok")));
    // The marker was never claimed: the real first touch still gives the index.
    assert!(gave(&case.run(&read(&root, "s1"), "ok")));
}

#[test]
fn a_back_off_is_logged_and_reported_by_status() {
    let case = Case::new();
    let root = case.repo("app", true);
    for _ in 0..3 {
        case.run(&read(&root, "s1"), "fail");
    }
    assert!(quiet(&case.run(&read(&root, "s1"), "ok")));
    assert!(case.log().contains("\"backing off\""), "{}", case.log());
    let out = Command::new(BIN)
        .arg("--status")
        .env("XDG_STATE_HOME", &case.state)
        .env("LOCALAPPDATA", &case.state)
        .stdin(Stdio::null())
        .output()
        .unwrap();
    let status: Value = serde_json::from_slice(&out.stdout).unwrap();
    assert_eq!(status["protocol"], "1");
    let outcome = status["lastFailure"]["outcome"].as_str().unwrap();
    assert!(outcome.starts_with("failed: exit 1"), "{outcome}");
    assert_eq!(status["backingOff"].as_array().unwrap().len(), 1);
}

#[test]
fn answers_never_wait_on_stdin() {
    let case = Case::new();
    for flag in ["--version", "--help", "--status"] {
        let mut child = Command::new(BIN)
            .arg(flag)
            .env("XDG_STATE_HOME", &case.state)
            .env("LOCALAPPDATA", &case.state)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .spawn()
            .unwrap();
        // stdin stays open: an answer that read it would never end.
        let started = Instant::now();
        while child.try_wait().unwrap().is_none() {
            assert!(
                started.elapsed() < Duration::from_secs(10),
                "{flag} waited on stdin"
            );
            std::thread::sleep(Duration::from_millis(20));
        }
        let out = child.wait_with_output().unwrap();
        assert!(!out.stdout.is_empty(), "{flag} printed nothing");
    }
}
