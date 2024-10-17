import fs from 'fs';
import * as os from 'os';
import path from 'path';
import * as tmp from 'tmp';
import * as core from '@actions/core';

let _tmpDir: string;
export const osPlat: string = os.platform();
export const osArch: string = os.arch();

export function tmpDir(): string {
  if (!_tmpDir) {
    _tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'container-scan-')).split(path.sep).join(path.posix.sep);
  }
  return _tmpDir;
}

export function tmpNameSync(options?: tmp.TmpNameOptions): string {
  return tmp.tmpNameSync(options);
}

export interface Inputs {
  trivyVersion?: string;
  image?: string;
  tarball?: string;
  dockerfile?: string;
  severity?: string;
  severityThreshold?: string;
  annotations?: boolean;
  githubToken?: string;
  ignoreUnfixed?: boolean;
}

export async function getInputs(): Promise<Inputs> {
  return {
    trivyVersion: core.getInput('trivy_version') || 'latest',
    image: core.getInput('image'),
    tarball: core.getInput('tarball'),
    dockerfile: core.getInput('dockerfile'),
    severity: core.getInput('severity'),
    severityThreshold: core.getInput('severity_threshold'),
    annotations: core.getBooleanInput('annotations'),
    githubToken: core.getInput('github_token'),
    ignoreUnfixed: core.getBooleanInput('ignore_unfixed')
  };
}

export const asyncForEach = async (array, callback) => {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
};
