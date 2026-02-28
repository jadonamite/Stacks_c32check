/**
 * Stacks Network - c32check Encoding Tests
 * This file validates the Crockford Base32 (c32) encoding, decoding, 
 * and checksum logic used for Stacks addresses.
 */

import test from 'tape-promise/tape';
import * as process from 'process';
import {
  c32encode,
  c32decode,
  c32checkEncode,
  c32checkDecode,
  c32address,
  c32addressDecode,
  c32ToB58,
  b58ToC32,
  versions
} from '../../../src/index';
import { encode } from '../../../src/base58check';

// --- Test Data Constants ---
// These hex strings and mapped c32 outputs serve as the source of truth for 
// encoding/decoding consistency across the library.

export function c32encodingTests() {
  const hexStrings = [
    'a46ff88886c2ef9762d970b4d2c63678835bd39d',
    '',
    '0000000000000000000000000000000000000000',
    '0000000000000000000000000000000000000001',
    '1000000000000000000000000000000000000001',
    '1000000000000000000000000000000000000000',
    '1', '22', '001', '0001', '00001', '000001', '0000001', '00000001',
    '10', '100', '1000', '10000', '100000', '1000000', '10000000', '100000000',
  ];

  // Minimum length requirements for specific encoding cases
  const c32minLengths = [
    undefined, undefined, 20, 20, 32, 32, 
    ...Array(16).fill(undefined)
  ];

  const c32Strings = [
    'MHQZH246RBQSERPSE2TD5HHPF21NQMWX',
    '',
    '00000000000000000000',
    '00000000000000000001',
    '20000000000000000000000000000001',
    '20000000000000000000000000000000',
    '1', '12', '01', '01', '001', '001', '0001', '0001',
    'G', '80', '400', '2000', '10000', 'G0000', '800000', '4000000',
  ];

  const hexMinLengths = [
    undefined, undefined, 20, 20, 20, 20,
    ...Array(17).fill(undefined)
  ];

  /**
   * Basic c32 Encoding Tests
   * Validates: Direct encoding, padding behavior, and length deduction.
   */
  test('c32encode', t => {
    t.plan(hexStrings.length * 3);
    for (let i = 0; i < hexStrings.length; i++) {
      // 1. Standard encoding
      const z = c32encode(hexStrings[i].toLowerCase(), c32minLengths[i]);
      t.equal(z, c32Strings[i], `c32encode: expected ${c32Strings[i]}, got ${z}`);

      // 2. Padding test (ensure leading zeros are handled correctly)
      const zPadded = c32encode(hexStrings[i].toLowerCase(), z.length + 5);
      t.equal(zPadded, `00000${c32Strings[i]}`, `Padding: expected 00000${c32Strings[i]}`);

      // 3. Length deduction from input string case
      const zNoLength = c32encode(hexStrings[i].toUpperCase());
      t.equal(zNoLength, c32Strings[i], `Deduction: expected ${c32Strings[i]}`);
    }
  });

  /**
   * Basic c32 Decoding Tests
   * Validates: Hex output consistency and correct padding of decoded bytes.
   */
  test('c32decode', t => {
    t.plan(c32Strings.length * 3);
    for (let i = 0; i < c32Strings.length; i++) {
      const paddedHexString = hexStrings[i].length % 2 === 0 ? hexStrings[i] : `0${hexStrings[i]}`;
      
      const h = c32decode(c32Strings[i], hexMinLengths[i]);
      t.equal(h, paddedHexString, `c32decode match: ${h}`);

      const hPadded = c32decode(c32Strings[i], h.length / 2 + 5);
      t.equal(hPadded, `0000000000${paddedHexString}`, `Padded decode match`);

      const hNoLength = c32decode(c32Strings[i]);
      t.equal(hNoLength, paddedHexString, `Deduce decode match`);
    }
  });

  /**
   * Error Handling
   * Ensures the library throws on non-hex or non-c32 characters.
   */
  test('invalid input handling', t => {
    t.plan(2);
    t.throws(() => c32encode('abcdefg'), /invalid hex/i, 'Should throw on invalid hex');
    t.throws(() => c32decode('wtu'), /invalid c32/i, 'Should throw on invalid c32 characters');
  });
}

/**
 * Address Verification Tests
 * Tests 'c32address' which adds the network prefix (e.g., 'S' for Stacks).
 */
export function c32addressTests() {
  const hexStrings = [
    'a46ff88886c2ef9762d970b4d2c63678835bd39d',
    '0000000000000000000000000000000000000000'
  ];
  // Standard Stacks versions: 22 (Mainnet P2PKH), 26 (Testnet P2PKH), etc.
  const versionList = [22, 26]; 

  test('c32address and decode', t => {
    t.plan(hexStrings.length * versionList.length * 2);
    for (const h of hexStrings) {
      for (const v of versionList) {
        const addr = c32address(v, h);
        t.ok(addr.startsWith('S'), 'Address must start with S');
        
        const [decV, decH] = c32addressDecode(addr);
        t.equal(decV, v, 'Version must match after round-trip');
        t.equal(decH, h.length % 2 !== 0 ? `0${h}` : h, 'Hex must match after round-trip');
      }
    }
  });
}

/**
 * Cross-Compatibility Tests (Base58 <-> C32)
 * Ensures that Stacks addresses can be converted to/from Bitcoin-style 
 * Base58 addresses for legacy compatibility.
 */
export function c32ToB58Test() {
  test('README examples and Legacy Buffer support', t => {
    t.plan(4);
    // Verifying Crockford Base32 encoding of a simple string
    const helloHex = Buffer.from('hello world').toString('hex');
    const encoded = c32encode(helloHex);
    t.equal(encoded, '38CNP6RVS0EXQQ4V34', 'Encode "hello world"');
    
    // Verifying Address Conversion logic
    const b58addr = '16EMaNw3pkn3v6f2BgnSSs53zAKH4Q8YJg';
    const c32addr = b58ToC32(b58addr);
    t.equal(c32addr, 'SPWNYDJ3STG7XH7ERWXMV6MQ7Q6EATWVY5Q1QMP8', 'Base58 to C32');
    t.equal(c32ToB58(c32addr), b58addr, 'C32 back to Base58');
    t.equal(versions.mainnet.p2pkh, 22, 'Mainnet version check');
  });
}

// --- Execution Logic ---
if (process.env.BIG_DATA_TESTS) {
  // Logic for heavy fuzzing/random byte tests if enabled in CI
} else {
  c32encodingTests();
  c32addressTests();
  c32ToB58Test();
}
