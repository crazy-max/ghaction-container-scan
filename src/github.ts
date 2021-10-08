import {JSONReport} from './trivy-report';
import * as core from '@actions/core';
import * as httpm from '@actions/http-client';

export interface GitHubRelease {
  id: number;
  tag_name: string;
}

export const getRelease = async (version: string): Promise<GitHubRelease | null> => {
  const url: string = `https://github.com/aquasecurity/trivy/releases/${version}`;
  const http: httpm.HttpClient = new httpm.HttpClient('scan');
  return (await http.getJson<GitHubRelease>(url)).result;
};

export async function setAnnotations(jsonOutput: string): Promise<void> {
  const jsonRep: JSONReport = <JSONReport>JSON.parse(jsonOutput);
  if (jsonRep.Results.length == 0) {
    return;
  }
  for (const result of jsonRep.Results) {
    if (result.Vulnerabilities.length == 0) {
      continue;
    }
    for (const vuln of result.Vulnerabilities) {
      core.warning(`(${vuln.VulnerabilityID}) ${vuln.Severity} severity - ${vuln.Title} vulnerability in ${vuln.PkgName}`);
    }
  }
}
