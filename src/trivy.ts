import fs from 'fs';
import * as path from 'path';
import * as semver from 'semver';
import * as util from 'util';
import * as context from './context';
import * as github from './github';
import {JSONReport, Vulnerability} from './trivy-report';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as tc from '@actions/tool-cache';

export type ScanResult = {
  table?: string;
  json?: string;
  sarif?: string;
  vulns?: Vulnerability[];
};

export enum ScanFormat {
  Table = 'table',
  Json = 'json',
  Sarif = 'sarif'
}

export enum Severity {
  Unknown = 1,
  Low,
  Medium,
  High,
  Critical
}

export const SeverityName = new Map<string, Severity>([
  ['UNKNOWN', Severity.Unknown],
  ['LOW', Severity.Low],
  ['MEDIUM', Severity.Medium],
  ['HIGH', Severity.High],
  ['CRITICAL', Severity.Critical]
]);

export const getSeverityName = async (status: Severity): Promise<string | undefined> => {
  for await (let [key, val] of SeverityName) {
    if (val == status) return key;
  }
};

export async function scan(bin: string, inputs: context.Inputs): Promise<ScanResult> {
  const tableFile = await scanTable(bin, inputs);
  const jsonFile = await scanJson(bin, inputs);
  const sarifFile = await scanSarif(bin, inputs);
  const report: JSONReport = <JSONReport>JSON.parse(fs.readFileSync(jsonFile, {encoding: 'utf-8'}).trim());
  let vulns: Array<Vulnerability> = [];
  if (report.Results.length > 0) {
    for (const result of report.Results) {
      if (result.Vulnerabilities.length == 0) {
        continue;
      }
      vulns.push(...result.Vulnerabilities);
    }
  }
  return {
    table: tableFile,
    json: jsonFile,
    sarif: sarifFile,
    vulns: vulns
  };
}

async function scanTable(bin: string, inputs: context.Inputs): Promise<string> {
  return scanFormat(ScanFormat.Table, bin, inputs, false);
}

async function scanJson(bin: string, inputs: context.Inputs): Promise<string> {
  return await scanFormat(ScanFormat.Json, bin, inputs, true);
}

async function scanSarif(bin: string, inputs: context.Inputs): Promise<string> {
  return await scanFormat(ScanFormat.Sarif, bin, inputs, true);
}

async function scanFormat(format: ScanFormat, bin: string, inputs: context.Inputs, silent: boolean): Promise<string> {
  const resFile = path.join(context.tmpDir(), `result.${format}`).split(path.sep).join(path.posix.sep);

  let scanArgs: Array<string> = ['image', '--no-progress', '--output', resFile];
  if (inputs.severity) {
    scanArgs.push('--severity', inputs.severity);
  }
  switch (format) {
    case ScanFormat.Table:
      scanArgs.push('--format', 'table');
      break;
    case ScanFormat.Json:
      scanArgs.push('--format', 'json');
      break;
    case ScanFormat.Sarif:
      scanArgs.push('--format', 'template');
      scanArgs.push('--template', `@${path.join(path.dirname(bin), 'contrib', 'sarif.tpl')}`);
      break;
  }
  if (inputs.image) {
    scanArgs.push(inputs.image);
  } else if (inputs.tarball) {
    scanArgs.push('--input', inputs.tarball);
  }

  return await exec
    .getExecOutput(bin, scanArgs, {
      ignoreReturnCode: true,
      silent: silent,
      env: {
        GITHUB_TOKEN: inputs.githubToken
      }
    })
    .then(res => {
      if (res.stderr.length > 0 && res.exitCode != 0) {
        throw new Error(res.stderr.trim());
      }
      if (!fs.existsSync(resFile)) {
        throw new Error(`Scan result not found for ${format} output format`);
      }
      return resFile;
    });
}

export async function getVersion(): Promise<string> {
  return await exec
    .getExecOutput(`trivy`, ['--version'], {
      ignoreReturnCode: true,
      silent: true
    })
    .then(res => {
      if (res.stderr.length > 0 && res.exitCode != 0) {
        throw new Error(res.stderr.trim());
      }
      return parseVersion(res.stdout.trim());
    });
}

export function parseVersion(stdout: string): string {
  for (const line of stdout.split(`\n`)) {
    const [key, ...rest] = line.split(':');
    const value = rest.map(v => v.trim()).join(':');
    if (key.length == 0 || value.length == 0) {
      continue;
    }
    switch (key) {
      case 'Version': {
        return value;
      }
    }
  }
  throw new Error(`Cannot parse trivy version`);
}

export function satisfies(version: string, range: string): boolean {
  return semver.satisfies(version, range) || /^[0-9a-f]{7}$/.exec(version) !== null;
}

export async function install(inputVersion: string): Promise<string> {
  const release: github.GitHubRelease | null = await github.getRelease(inputVersion);
  if (!release) {
    throw new Error(`Cannot find trivy ${inputVersion} release`);
  }
  core.debug(`Release ${release.tag_name} found`);
  const version = release.tag_name.replace(/^v+|v+$/g, '');

  let toolPath: string;
  toolPath = tc.find('trivy', version);
  if (!toolPath) {
    const c = semver.clean(version) || '';
    if (!semver.valid(c)) {
      throw new Error(`Invalid trivy version "${version}".`);
    }
    toolPath = await download(version);
  }

  const exePath: string = path.join(toolPath, context.osPlat == 'win32' ? 'trivy.exe' : 'trivy');
  core.debug(`Exe path is ${exePath}`);

  core.info('Fixing perms');
  fs.chmodSync(exePath, '0755');

  return exePath;
}

async function download(version: string): Promise<string> {
  const downloadUrl: string = util.format('https://github.com/aquasecurity/trivy/releases/download/v%s/%s', version, getFilename(version));

  core.info(`Downloading ${downloadUrl}`);
  const downloadPath: string = await tc.downloadTool(downloadUrl);
  core.debug(`Downloaded to ${downloadPath}`);

  core.info('Extracting trivy');
  let extPath: string;
  if (context.osPlat == 'win32') {
    extPath = await tc.extractZip(downloadPath);
  } else {
    extPath = await tc.extractTar(downloadPath);
  }
  core.debug(`Extracted to ${extPath}`);

  const cachePath: string = await tc.cacheDir(extPath, 'trivy', version);
  core.debug(`Cached to ${cachePath}`);

  return cachePath;
}

const getFilename = (version: string): string => {
  const platform: string = context.osPlat == 'win32' ? 'Windows' : context.osPlat == 'darwin' ? 'macOS' : 'Linux';
  const arch: string = context.osArch == 'x64' ? '64bit' : context.osArch == 'ia32' ? '32bit' : context.osArch;
  const ext: string = context.osPlat == 'win32' ? '.zip' : '.tar.gz';
  return util.format('trivy_%s_%s-%s%s', version, platform, arch, ext);
};
