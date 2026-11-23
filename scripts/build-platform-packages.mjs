#!/usr/bin/env node
// Lay out the six first-touch platform packages from archives already built,
// and point the CLI at them.
//
//   node scripts/build-platform-packages.mjs <version> <archive-dir> <out-dir>
//   node scripts/build-platform-packages.mjs --inject <cli-package-dir> <version>
//
// The first form checks every archive against `<archive-dir>/SHA256SUMS`, then
// writes `<out-dir>/<package>/{package.json,bin/}` per target. Nothing is
// compiled here: npm carries the bytes the release checksummed, so a resumed
// run publishes the same binaries, never a rebuild.
//
// The second form sets the six names as optional dependencies of the packed
// CLI at the exact version. They are not in the committed package.json: a
// local `pnpm install` would ask npm for packages a release has not made yet.
//
// The target table is the CLI's own (`packages/cli/src/native.ts`), imported
// from its build, so the packages and the resolver that finds them agree.
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const {PLATFORM_TARGETS, FIRST_TOUCH_BIN} = await import(
  // A URL, not a path: Windows refuses `import()` of `C:\...`.
  pathToFileURL(join(here, '../packages/cli/dist/native.js')).href
)

const die = (message) => {
  process.stderr.write(`build-platform-packages: ${message}\n`)
  process.exit(1)
}

const archiveName = (version, target) =>
  `${FIRST_TOUCH_BIN}-${version}-${target}${target.includes('windows') ? '.zip' : '.tar.gz'}`

function checkSums(dir, names) {
  const sumsPath = join(dir, 'SHA256SUMS')
  if (!existsSync(sumsPath)) die(`${sumsPath} is missing`)
  const sums = new Map(
    readFileSync(sumsPath, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [sum, file] = line.trim().split(/\s+\*?/)
        return [file, sum]
      }),
  )
  for (const name of names) {
    const path = join(dir, name)
    if (!existsSync(path)) die(`no archive ${name} in ${dir}`)
    const actual = createHash('sha256').update(readFileSync(path)).digest('hex')
    if (sums.get(name) !== actual) die(`${name} does not match SHA256SUMS`)
  }
}

function layout(version, archives, out) {
  const template = readFileSync(join(here, '../npm/platform/package.json.in'), 'utf8')
  const names = PLATFORM_TARGETS.map((t) => archiveName(version, t.target))
  checkSums(archives, names)
  rmSync(out, {recursive: true, force: true})
  for (const t of PLATFORM_TARGETS) {
    const scratch = join(out, '.unpack', t.target)
    mkdirSync(scratch, {recursive: true})
    const archive = join(archives, archiveName(version, t.target))
    if (archive.endsWith('.zip')) execFileSync('unzip', ['-q', archive, '-d', scratch])
    else execFileSync('tar', ['-xzf', archive, '-C', scratch])
    const exe = t.os === 'win32' ? `${FIRST_TOUCH_BIN}.exe` : FIRST_TOUCH_BIN
    const source = join(scratch, `${FIRST_TOUCH_BIN}-${version}-${t.target}`, exe)
    if (!existsSync(source)) die(`${archive} holds no ${exe}`)
    const dir = join(out, t.pkg)
    mkdirSync(join(dir, 'bin'), {recursive: true})
    copyFileSync(source, join(dir, 'bin', exe))
    // npm keeps a file's mode; a binary without +x fails at its first run.
    chmodSync(join(dir, 'bin', exe), 0o755)
    // `libc` alone tells the two linux-x64 packages apart.
    const libc = t.libc ? `  "libc": [\n    "${t.libc}"\n  ],` : ''
    const json = template
      .replaceAll('__PKG__', t.pkg)
      .replaceAll('__VERSION__', version)
      .replaceAll('__OS__', t.os)
      .replaceAll('__CPU__', t.cpu)
      .replace('__LIBC__', libc)
      .split('\n')
      .filter((line) => line.trim() !== '')
      .join('\n')
    JSON.parse(json)
    writeFileSync(join(dir, 'package.json'), `${json}\n`)
    process.stdout.write(`  ${t.pkg}  (${t.target})\n`)
  }
  rmSync(join(out, '.unpack'), {recursive: true, force: true})
}

function inject(cliDir, version) {
  const path = join(cliDir, 'package.json')
  const pkg = JSON.parse(readFileSync(path, 'utf8'))
  pkg.optionalDependencies = Object.fromEntries(PLATFORM_TARGETS.map((t) => [t.pkg, version]))
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`)
  process.stdout.write(
    `  ${pkg.name}: ${PLATFORM_TARGETS.length} optional dependencies at ${version}\n`,
  )
}

const args = process.argv.slice(2)
if (args[0] === '--inject') {
  const [, cliDir, version] = args
  if (!cliDir || !version) die('usage: --inject <cli-package-dir> <version>')
  inject(cliDir, version)
} else {
  const [version, archives, out] = args
  if (!version || !archives || !out) die('usage: <version> <archive-dir> <out-dir>')
  layout(version, archives, out)
}
