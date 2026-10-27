import assert from 'node:assert/strict'
import test from 'node:test'
import { selectLanIPv4 } from './build-android.mjs'

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
