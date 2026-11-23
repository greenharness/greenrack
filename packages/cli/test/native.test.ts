import {mkdtempSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {describe, expect, it} from 'vitest'
import {PLATFORM_TARGETS, firstTouchBinary, targetFor} from '../src/native.js'

describe('the first-touch platform packages', () => {
  it('are the six the release builds, one per target', () => {
    expect(PLATFORM_TARGETS.map((t) => t.target).sort()).toEqual([
      'aarch64-apple-darwin',
      'aarch64-unknown-linux-gnu',
      'x86_64-apple-darwin',
      'x86_64-pc-windows-msvc',
      'x86_64-unknown-linux-gnu',
      'x86_64-unknown-linux-musl',
    ])
    for (const t of PLATFORM_TARGETS) {
      expect(t.pkg).toMatch(
        /^@greenharness\/greenrack-first-touch-(darwin|linux|win32)-(arm64|x64)/,
      )
    }
    expect(new Set(PLATFORM_TARGETS.map((t) => t.pkg)).size).toBe(6)
  })

  it('pick the package by platform, cpu and libc, and refuse what is not built', () => {
    const pkg = (platform: string, arch: string, libc?: 'glibc' | 'musl') =>
      targetFor({platform, arch, libc})?.pkg
    expect(pkg('darwin', 'arm64')).toBe('@greenharness/greenrack-first-touch-darwin-arm64')
    expect(pkg('darwin', 'x64')).toBe('@greenharness/greenrack-first-touch-darwin-x64')
    expect(pkg('linux', 'x64', 'glibc')).toBe('@greenharness/greenrack-first-touch-linux-x64-gnu')
    expect(pkg('linux', 'x64', 'musl')).toBe('@greenharness/greenrack-first-touch-linux-x64-musl')
    expect(pkg('linux', 'arm64', 'glibc')).toBe(
      '@greenharness/greenrack-first-touch-linux-arm64-gnu',
    )
    // Never the glibc build on Alpine: it would install and never run.
    expect(pkg('linux', 'arm64', 'musl')).toBeUndefined()
    expect(pkg('win32', 'x64')).toBe('@greenharness/greenrack-first-touch-win32-x64')
    expect(pkg('win32', 'arm64')).toBeUndefined()
    expect(pkg('freebsd', 'x64')).toBeUndefined()
  })
})

describe('firstTouchBinary', () => {
  const file = () => {
    const path = join(mkdtempSync(join(tmpdir(), 'greenrack-native-')), 'greenrack-first-touch')
    writeFileSync(path, '')
    return path
  }
  const mac = {platform: 'darwin', arch: 'arm64'}

  it('takes GREENRACK_FIRST_TOUCH_BIN first, and says when it names nothing', () => {
    const path = file()
    expect(firstTouchBinary({GREENRACK_FIRST_TOUCH_BIN: path}, mac)).toEqual({path})
    const missing = firstTouchBinary({GREENRACK_FIRST_TOUCH_BIN: '/nowhere/hook'}, mac)
    expect('error' in missing && missing.error).toMatch(
      /names \/nowhere\/hook, which does not exist/,
    )
  })

  it('resolves the platform package, and names it when it is not installed', () => {
    const path = file()
    const resolved: string[] = []
    const found = firstTouchBinary({}, mac, (id) => {
      resolved.push(id)
      return path
    })
    expect(found).toEqual({path})
    expect(resolved).toEqual([
      '@greenharness/greenrack-first-touch-darwin-arm64/bin/greenrack-first-touch',
    ])
    const absent = firstTouchBinary({}, mac, () => {
      throw new Error('Cannot find module')
    })
    expect('error' in absent && absent.error).toMatch(
      /greenrack-first-touch-darwin-arm64 is not installed/,
    )
  })

  it('names the .exe on Windows and refuses a host with no build', () => {
    const seen: string[] = []
    firstTouchBinary({}, {platform: 'win32', arch: 'x64'}, (id) => {
      seen.push(id)
      throw new Error('absent')
    })
    expect(seen[0]).toBe(
      '@greenharness/greenrack-first-touch-win32-x64/bin/greenrack-first-touch.exe',
    )
    const none = firstTouchBinary({}, {platform: 'linux', arch: 'arm64', libc: 'musl'})
    expect('error' in none && none.error).toMatch(
      /no first-touch binary is built for linux\/arm64\/musl/,
    )
  })
})
