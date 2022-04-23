import {describe, expect, it, test} from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as semver from 'semver';
import * as trivy from '../src/trivy';

describe('getVersion', () => {
  it('valid', async () => {
    const trivyBin = await trivy.install('latest');
    process.env[`PATH`] = `${path.dirname(trivyBin)}:${process.env[`PATH`]}`;
    expect(fs.existsSync(trivyBin)).toBe(true);
    const version = await trivy.getVersion();
    expect(semver.valid(version)).not.toBeNull();
  }, 100000);
});

describe('parseVersion', () => {
  it('valid', async () => {
    expect(
      trivy.parseVersion(`Version: 0.19.2
Vulnerability DB:
  Type: Light
  Version: 1
  UpdatedAt: 2021-10-07 12:05:28.644797134 +0000 UTC
  NextUpdate: 2021-10-07 18:05:28.644796934 +0000 UTC
  DownloadedAt: 2021-10-07 14:13:53.4197888 +0000 UTC`)
    ).toEqual('0.19.2');
  });
});

describe('satisfies', () => {
  test.each([
    ['0.20.0', '>=0.19.2', true],
    ['0.20.0', '<0.19.2', false]
  ])('given %p', async (version, range, expected) => {
    expect(trivy.satisfies(version, range)).toBe(expected);
  });
});

describe('install', () => {
  it('acquires latest version of trivy', async () => {
    const trivyBin = await trivy.install('latest');
    expect(fs.existsSync(trivyBin)).toBe(true);
  }, 100000);
  it('acquires v0.19.2 version of trivy', async () => {
    const trivyBin = await trivy.install('v0.19.2');
    expect(fs.existsSync(trivyBin)).toBe(true);
  }, 100000);
});

describe('scan', () => {
  it('scans alpine:3.9 image', async () => {
    const trivyBin = await trivy.install('latest');
    expect(fs.existsSync(trivyBin)).toBe(true);
    const scanResult = await trivy.scan({
      Bin: trivyBin,
      Inputs: {
        trivyVersion: 'latest',
        image: 'alpine:3.9',
        dockerfile: path.join(__dirname, 'fixtures', 'Dockerfile')
      }
    });
    expect(scanResult.table).not.toBeUndefined();
    expect(scanResult.json).not.toBeUndefined();
    expect(scanResult.sarif).not.toBeUndefined();
    expect(scanResult.vulns).not.toBeUndefined();
  }, 500000);
});
