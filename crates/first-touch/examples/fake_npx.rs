//! A stand-in for `npx … hook first-touch` in the contract tests, chosen by
//! `GREENRACK_FIRST_TOUCH_NPX`. `FAKE_MODE` picks the behaviour; `FAKE_COUNT`
//! names a file that gets one byte per run; `FAKE_PID` receives a child's pid.

use std::io::{Read, Write};
use std::time::Duration;

fn main() {
    let mut event = Vec::new();
    let _ = std::io::stdin().read_to_end(&mut event);
    if let Ok(path) = std::env::var("FAKE_COUNT") {
        if let Ok(mut file) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)
        {
            let _ = file.write_all(b"x");
        }
    }
    let var = |name: &str| std::env::var(name).unwrap_or_default();
    let body = || {
        format!(
            "INDEX BODY root={} event={} unavailable={} bytes={}\n",
            var("GREENRACK_FIRST_TOUCH_ROOT"),
            var("GREENRACK_FIRST_TOUCH_EVENT"),
            var("GREENRACK_FIRST_TOUCH_UNAVAILABLE"),
            event.len(),
        )
    };
    let mut out = std::io::stdout();
    match var("FAKE_MODE").as_str() {
        "fail" => {
            eprintln!("boom: registry unreachable");
            std::process::exit(1);
        }
        "hang" => std::thread::sleep(Duration::from_secs(30)),
        "slow" => {
            std::thread::sleep(Duration::from_millis(800));
            let _ = out.write_all(body().as_bytes());
        }
        "empty" => {}
        "big" => {
            let _ = out.write_all("x".repeat(12_000).as_bytes());
        }
        "badbytes" => {
            let _ = out.write_all(b"\xff\xfe INDEX BODY\n");
        }
        "hangchild" => {
            let me = std::env::current_exe().expect("own path");
            let mut child = std::process::Command::new(me)
                .env("FAKE_MODE", "hang")
                .env_remove("FAKE_COUNT")
                .stdin(std::process::Stdio::null())
                .spawn()
                .expect("spawn the grandchild");
            let _ = std::fs::write(var("FAKE_PID"), child.id().to_string());
            // The hook's timeout kills this tree long before the sleep ends.
            std::thread::sleep(Duration::from_secs(30));
            let _ = child.wait();
        }
        _ => {
            let _ = out.write_all(body().as_bytes());
        }
    }
}
