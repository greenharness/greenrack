import {existsSync} from 'node:fs'
import {createRequire} from 'node:module'

/** The first-touch hook binary's file name, without `.exe`. */
export const FIRST_TOUCH_BIN = 'greenrack-first-touch'

export interface PlatformTarget {
  /** The Rust target the release builds. */
  target: string
  /** The npm package that carries the binary for it. */
  pkg: string
  os: 'darwin' | 'linux' | 'win32'
  cpu: 'arm64' | 'x64'
  libc?: 'glibc' | 'musl'
}

/**
 * The six targets the release builds, the way npm spells them. The release's
 * packaging script imports this table, so the two never disagree. linux-arm64
 * on musl and windows on arm64 are not built: a package that installs and
 * cannot run is worse than none.
 */
export const PLATFORM_TARGETS: readonly PlatformTarget[] = [
  {
    target: 'aarch64-apple-darwin',
    pkg: '@greenharness/greenrack-first-touch-darwin-arm64',
    os: 'darwin',
    cpu: 'arm64',
  },
  {
    target: 'x86_64-apple-darwin',
    pkg: '@greenharness/greenrack-first-touch-darwin-x64',
    os: 'darwin',
    cpu: 'x64',
  },
  {
    target: 'aarch64-unknown-linux-gnu',
    pkg: '@greenharness/greenrack-first-touch-linux-arm64-gnu',
    os: 'linux',
    cpu: 'arm64',
    libc: 'glibc',
  },
  {
    target: 'x86_64-unknown-linux-gnu',
    pkg: '@greenharness/greenrack-first-touch-linux-x64-gnu',
    os: 'linux',
    cpu: 'x64',
    libc: 'glibc',
  },
  {
    target: 'x86_64-unknown-linux-musl',
    pkg: '@greenharness/greenrack-first-touch-linux-x64-musl',
    os: 'linux',
    cpu: 'x64',
    libc: 'musl',
  },
  {
    target: 'x86_64-pc-windows-msvc',
    pkg: '@greenharness/greenrack-first-touch-win32-x64',
    os: 'win32',
    cpu: 'x64',
  },
]

export interface Host {
  platform: string
  arch: string
  libc?: 'glibc' | 'musl'
}

/** glibc or musl on Linux, from Node's own report; nothing elsewhere. */
export function hostLibc(): 'glibc' | 'musl' | undefined {
  if (process.platform !== 'linux') return undefined
  const report = process.report?.getReport() as {header?: {glibcVersionRuntime?: string}}
  return report?.header?.glibcVersionRuntime ? 'glibc' : 'musl'
}

export function currentHost(): Host {
  return {platform: process.platform, arch: process.arch, libc: hostLibc()}
}

/** The target for a host, or undefined when the release builds none for it. */
export function targetFor(host: Host): PlatformTarget | undefined {
  return PLATFORM_TARGETS.find(
    (t) =>
      t.os === host.platform &&
      t.cpu === host.arch &&
      (t.libc === undefined || t.libc === host.libc),
  )
}

/** The binary, or why there is none and, when a person can act, what to do. */
export type FoundBinary = {path: string} | {error: string; fix?: string}

const nodeRequire = createRequire(import.meta.url)

/**
 * The installed first-touch binary for this host. `GREENRACK_FIRST_TOUCH_BIN`
 * names one first (a local build, before a release exists); else the platform
 * package npm installed as an optional dependency, resolved with Node's own
 * resolver because pnpm does not hoist it.
 */
export function firstTouchBinary(
  env: NodeJS.ProcessEnv = process.env,
  host: Host = currentHost(),
  resolve: (id: string) => string = (id) => nodeRequire.resolve(id),
): FoundBinary {
  const override = env.GREENRACK_FIRST_TOUCH_BIN
  if (override) {
    return existsSync(override)
      ? {path: override}
      : {error: `GREENRACK_FIRST_TOUCH_BIN names ${override}, which does not exist`}
  }
  const target = targetFor(host)
  const where = `${host.platform}/${host.arch}${host.libc ? `/${host.libc}` : ''}`
  if (target === undefined) return {error: `no first-touch binary is built for ${where}`}
  const exe = host.platform === 'win32' ? `${FIRST_TOUCH_BIN}.exe` : FIRST_TOUCH_BIN
  try {
    const path = resolve(`${target.pkg}/bin/${exe}`)
    if (existsSync(path)) return {path}
  } catch {
    // Not installed: an install that skipped optional dependencies.
  }
  return {
    error: `${target.pkg} is not installed`,
    fix: 'reinstall @greenharness/greenrack-cli without --no-optional',
  }
}
