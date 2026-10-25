// Builds, signs, checks and optionally installs the Android release APK in one fixed sequence.
//   npm run release:apk -- [--tag <label>] [--install <adb-serial>]
// The APK lands in artifacts/android/<version>/ and is never overwritten. `npm run build:apk` remains a
// debug build for development; a debuggable APK is refused here so it cannot become the daily install.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const android = join(root, 'android');
// The SDK debug keystore is this project's established signing key; every public and daily APK uses it.
const CERTIFICATE = '85cdf5d43e349441519a6e647372d48fa3db8cd85be3ad35a26c87754b135bba';
const PACKAGE = 'com.wordmaster.app';

const args = process.argv.slice(2);
const option = name => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const tag = option('--tag'), serial = option('--install');
if (tag !== undefined && !/^[a-z0-9-]+$/.test(tag)) fail('--tag 只能包含小写字母、数字和连字符');

function fail(message) { console.error('✖ ' + message); process.exit(1); }
function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, { encoding: 'utf8', stdio: options.capture ? 'pipe' : 'inherit', ...options });
  if (result.status !== 0) fail(`${command} ${commandArgs.join(' ')} 失败${result.stderr ? '：\n' + result.stderr : ''}`);
  return result.stdout ?? '';
}
const shell = (line, cwd = root) => run('cmd.exe', ['/d', '/s', '/c', line], { cwd });
const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex');

if (process.platform !== 'win32') fail('此脚本按 Windows 工作站编写');
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || join(process.env.LOCALAPPDATA, 'Android', 'Sdk');
const buildTools = join(sdk, 'build-tools', readdirSync(join(sdk, 'build-tools')).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1));
const adb = join(sdk, 'platform-tools', 'adb.exe');

const gradle = readFileSync(join(android, 'app', 'build.gradle'), 'utf8');
const versionCode = gradle.match(/versionCode\s+(\d+)/)?.[1], versionName = gradle.match(/versionName\s+"([^"]+)"/)?.[1];
const packageVersion = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
if (!versionCode || versionName !== packageVersion) fail(`版本不一致：package.json ${packageVersion}，build.gradle ${versionName}/${versionCode}`);
const outputDir = join(root, 'artifacts', 'android', versionName);
const output = join(outputDir, `EnglishWordMaster-${versionName}-code${versionCode}${tag ? '-' + tag : ''}.apk`);
if (existsSync(output)) fail(`已有同名安装包，不覆盖：${output}（请换一个 --tag）`);

console.log(`▶ 构建 ${versionName}/code${versionCode}`);
shell('npx vite build');
shell('npx cap sync android');
// In agent shells the JDK's AF_UNIX selector pipe fails under long temp paths; a short socket directory avoids it.
if (!process.env.JAVA_TOOL_OPTIONS) { mkdirSync('C:\\t', { recursive: true }); process.env.JAVA_TOOL_OPTIONS = '-Djdk.net.unixdomain.tmpdir=C:\\t'; }
// An explicit path: cmd may be told not to search the current directory (NoDefaultCurrentDirectoryInExePath).
shell('.\\gradlew.bat --no-daemon assembleRelease', android);

const unsigned = join(android, 'app', 'build', 'outputs', 'apk', 'release', 'app-release-unsigned.apk');
run(join(buildTools, 'zipalign.exe'), ['-c', '-p', '4', unsigned]);
mkdirSync(outputDir, { recursive: true });
const apksigner = (...commandArgs) => run('java', ['-jar', join(buildTools, 'lib', 'apksigner.jar'), ...commandArgs], { capture: true });
apksigner('sign', '--ks', join(homedir(), '.android', 'debug.keystore'), '--ks-key-alias', 'androiddebugkey',
  '--ks-pass', 'pass:android', '--key-pass', 'pass:android', '--out', output, unsigned);

const verify = apksigner('verify', '--verbose', '--print-certs', output);
if (!/v2 scheme \(APK Signature Scheme v2\): true/.test(verify)) fail('v2 签名校验未通过');
if (!verify.includes(`certificate SHA-256 digest: ${CERTIFICATE}`)) fail('签名证书与既有发布证书不同');
const badging = run(join(buildTools, 'aapt2.exe'), ['dump', 'badging', output], { capture: true });
if (!badging.includes(`package: name='${PACKAGE}' versionCode='${versionCode}' versionName='${versionName}'`)) fail('安装包的包名或版本不符');
if (badging.includes('application-debuggable')) fail('安装包可调试，不能作为发布包');
const digest = sha256(output);
console.log(`✔ 发布包已校验\n  ${output}\n  SHA-256 ${digest}`);

if (serial) {
  const state = () => {
    const dump = run(adb, ['-s', serial, 'shell', 'dumpsys', 'package', PACKAGE], { capture: true });
    // Several users/sections may print their own install times; keep them all for the comparison.
    const fields = name => [...dump.matchAll(new RegExp(`${name}=(\\S+(?: [0-9:]+)?)`, 'g'))].map(match => match[1]).join(', ') || null;
    return { versionCode: dump.match(/versionCode=(\d+)/)?.[1] ?? null, versionName: dump.match(/versionName=(\S+)/)?.[1] ?? null,
      dataDir: dump.match(/dataDir=(\/\S+)/)?.[1] ?? null, firstInstallTime: fields('firstInstallTime'), lastUpdateTime: fields('lastUpdateTime'),
      debuggable: /pkgFlags=\[[^\]]*DEBUGGABLE/.test(dump) };
  };
  const before = state();
  const installOutput = run(adb, ['-s', serial, 'install', '-r', output], { capture: true }).trim();
  const after = state();
  const installedPath = run(adb, ['-s', serial, 'shell', 'pm', 'path', PACKAGE], { capture: true }).trim().replace(/^package:/, '');
  const installedSha256 = run(adb, ['-s', serial, 'shell', 'sha256sum', installedPath], { capture: true }).split(/\s+/)[0];
  const identityPreserved = !before.dataDir || (before.dataDir === after.dataDir && before.firstInstallTime === after.firstInstallTime);
  const receipt = { date: new Date().toISOString(), device: serial, package: PACKAGE, apk: output, sha256: digest, operation: 'adb install -r',
    uninstalled: false, dataCleared: false, before, after, installOutput, installedSha256, identityPreserved };
  const receiptDir = join(root, 'results', 'apk-installations');
  mkdirSync(receiptDir, { recursive: true });
  const receiptFile = join(receiptDir, `${new Date().toISOString().slice(0, 10)}-code${versionCode}${tag ? '-' + tag : ''}.json`);
  writeFileSync(receiptFile, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  if (installedSha256 !== digest || after.versionCode !== versionCode || after.versionName !== versionName || after.debuggable || !identityPreserved) {
    fail(`安装结果与发布包不符，详见 ${receiptFile}`);
  }
  console.log(`✔ 已覆盖安装到 ${serial}，数据保留\n  回执 ${receiptFile}`);
}
