import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  publishSingleApk,
  releaseApkPath,
  releaseGradleCommand,
  selectLanIPv4,
  validateProductionOrigin,
} from './build-android.mjs'

test('uses an explicit Android backend host first', () => {
  assert.equal(selectLanIPv4({
    override: '192.168.1.50',
    interfaces: { 'Wi-Fi': [{ family: 'IPv4', internal: false, address: '10.0.0.3' }] },
  }), '192.168.1.50')
})

test('skips loopback and virtual adapters when choosing a LAN host', () => {
  assert.equal(selectLanIPv4({
    interfaces: {
      'VMware Network Adapter VMnet1': [{ family: 'IPv4', internal: false, address: '192.168.25.1' }],
      'vEthernet (Default Switch)': [{ family: 'IPv4', internal: false, address: '172.20.0.1' }],
      'WLAN 2': [{ family: 'IPv4', internal: false, address: '10.127.216.179' }],
    },
  }), '10.127.216.179')
})

test('falls back to the Android emulator host when no LAN adapter exists', () => {
  assert.equal(selectLanIPv4({ interfaces: {} }), '10.0.2.2')
})

test('accepts only an HTTPS production API origin', () => {
  assert.equal(validateProductionOrigin('https://api.example.test'), 'https://api.example.test')
  assert.equal(validateProductionOrigin(' https://api.example.test/ '), 'https://api.example.test')
  assert.throws(() => validateProductionOrigin('http://10.0.0.2:8080'), /HTTPS/)
  assert.throws(() => validateProductionOrigin('https://api.example.test/v1'), /path/)
  assert.throws(() => validateProductionOrigin('https://user:pass@api.example.test'), /credentials/)
})

test('release pipeline uses the release Gradle task and release APK output', () => {
  assert.deepEqual(releaseGradleCommand(), ['gradlew.bat', 'assembleRelease'])
  assert.equal(
    releaseApkPath('C:\\project'),
    join('C:\\project', 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'),
  )
})

test('publishes exactly one APK without deleting anything outside the delivery directory', () => {
  const root = mkdtempSync(join(tmpdir(), 'zhiya-release-'))
  const source = join(root, 'app-release.apk')
  const output = join(root, '运行文件')
  const sibling = join(root, '签名')
  mkdirSync(output)
  mkdirSync(sibling)
  writeFileSync(source, 'signed-apk')
  writeFileSync(join(output, 'old.apk'), 'old')
  writeFileSync(join(output, 'notes.txt'), 'old')
  writeFileSync(join(sibling, 'keep.jks'), 'keep')

  const published = publishSingleApk(source, output)

  assert.equal(published, join(output, '智芽.apk'))
  assert.equal(readFileSync(published, 'utf8'), 'signed-apk')
  assert.deepEqual(readdirSync(output), ['智芽.apk'])
  assert.equal(existsSync(join(sibling, 'keep.jks')), true)
})

test('release manifest exposes only required permissions and app-specific files', () => {
  const root = new URL('../android/app/src/main/', import.meta.url)
  const manifest = readFileSync(new URL('AndroidManifest.xml', root), 'utf8')
  const filePaths = readFileSync(new URL('res/xml/file_paths.xml', root), 'utf8')

  assert.match(manifest, /android:allowBackup="false"/)
  assert.doesNotMatch(manifest, /READ_MEDIA_IMAGES/)
  assert.doesNotMatch(manifest, /READ_EXTERNAL_STORAGE/)
  assert.doesNotMatch(filePaths, /external-path[^>]*path="\."/)
  assert.match(filePaths, /external-files-path/)
})

test('release build enables code and resource shrinking', () => {
  const buildGradle = readFileSync(new URL('../android/app/build.gradle', import.meta.url), 'utf8')

  assert.match(buildGradle, /minifyEnabled\s+true/)
  assert.match(buildGradle, /shrinkResources\s+true/)
})
