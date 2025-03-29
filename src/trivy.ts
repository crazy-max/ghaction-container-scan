import fs from 'fs';
import * as path from 'path';
import * as semver from 'semver';
import * as util from 'util';
import truncate from 'lodash.truncate';
import * as context from './context';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as httpm from '@actions/http-client';
import * as tc from '@actions/tool-cache';

export type ScanOptions = {
  Bin: string;
  Inputs: context.Inputs;
};

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

export interface Vulnerability {
  VulnerabilityID: string;
  PkgName: string;
  InstalledVersion: string;
  FixedVersion?: string;
  SeveritySource?: string;
  PrimaryURL?: string;
  Title?: string;
  Description?: string;
  Severity: string;
  PublishedDate?: Date;
  LastModifiedDate?: Date;
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

export async function scan(opts: ScanOptions): Promise<ScanResult> {
  const jsonFile = await scanJson(opts);
  const sarifFile = await scanSarif(opts);
  const tableFile = await scanTable(opts);
  const vulns: Array<Vulnerability> = [];

  const parsed = JSON.parse(fs.readFileSync(jsonFile, {encoding: 'utf-8'}).trim());
  if (parsed.Results) {
    for (const result of parsed.Results) {
      if (!result.Vulnerabilities) {
        continue;
      }
      for (const vuln of result.Vulnerabilities) {
        if (!vuln.Title && vuln.Description) {
          vuln.Title = truncate(vuln.Description, {length: 48});
        }
        vulns.push(vuln);
      }
    }
  }

  return {
    table: tableFile,
    json: jsonFile,
    sarif: sarifFile,
    vulns: vulns
  };
}

async function scanTable(opts: ScanOptions): Promise<string> {
  return scanFormat(ScanFormat.Table, opts);
}

async function scanJson(opts: ScanOptions): Promise<string> {
  return await scanFormat(ScanFormat.Json, opts);
}

async function scanSarif(opts: ScanOptions): Promise<string> {
  return await scanFormat(ScanFormat.Sarif, opts);
}

async function scanFormat(format: ScanFormat, opts: ScanOptions): Promise<string> {
  core.info(`\nStarting scan (${format} format)\n=============================`);

  if (format == ScanFormat.Sarif && !opts.Inputs.dockerfile) {
    core.warning('Dockerfile not provided. Skipping sarif scan result.');
    return '';
  }

  const resFile = path.join(context.tmpDir(), `result.${format}`).split(path.sep).join(path.posix.sep);

  const scanArgs: Array<string> = ['image', '--no-progress', '--output', resFile];
  if (opts.Inputs.severity) {
    scanArgs.push('--severity', opts.Inputs.severity);
  }
  if (opts.Inputs.ignoreUnfixed) {
    scanArgs.push('--ignore-unfixed');
  }
  switch (format) {
    case ScanFormat.Table:
      scanArgs.push('--format', 'table');
      break;
    case ScanFormat.Json:
      scanArgs.push('--format', 'json');
      break;
    case ScanFormat.Sarif:
      scanArgs.push('--format', 'sarif');
      break;
  }
  if (opts.Inputs.image) {
    scanArgs.push(opts.Inputs.image);
  } else if (opts.Inputs.tarball) {
    scanArgs.push('--input', opts.Inputs.tarball);
  }

  return await exec
    .getExecOutput(opts.Bin, scanArgs, {
      ignoreReturnCode: true,
      silent: false,
      env: Object.assign({}, process.env, {
        GITHUB_TOKEN: opts.Inputs.githubToken || process.env.GITHUB_TOKEN || ''
      }) as {
        [key: string]: string;
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

export interface GitHubRelease {
  id: number;
  tag_name: string;
  html_url: string;
  assets: Array<string>;
}

export const getRelease = async (version: string): Promise<GitHubRelease> => {
  const url = `https://raw.githubusercontent.com/crazy-max/ghaction-container-scan/master/.github/trivy-releases.json`;
  const http: httpm.HttpClient = new httpm.HttpClient('ghaction-container-scan');
  const resp: httpm.HttpClientResponse = await http.get(url);
  const body = await resp.readBody();
  const statusCode = resp.message.statusCode || 500;
  if (statusCode >= 400) {
    throw new Error(`Failed to get Trivy release ${version} from ${url} with status code ${statusCode}: ${body}`);
  }
  const releases = <Record<string, GitHubRelease>>JSON.parse(body);
  if (!releases[version]) {
    throw new Error(`Cannot find Trivy release ${version} in ${url}`);
  }
  return releases[version];
};

export async function install(inputVersion: string): Promise<string> {
  const release: GitHubRelease = await getRelease(inputVersion);
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
