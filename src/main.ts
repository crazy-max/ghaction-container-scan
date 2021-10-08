import fs from 'fs';
import * as context from './context';
import * as trivy from './trivy';
import * as stateHelper from './state-helper';
import * as core from '@actions/core';

async function run(): Promise<void> {
  try {
    const inputs: context.Inputs = await context.getInputs();

    if (!inputs.image && !inputs.tarball) {
      core.setFailed('image or tarball input required');
      return;
    }

    let severityThreshold: trivy.Severity | undefined = undefined;
    if (inputs.severityThreshold) {
      severityThreshold = trivy.SeverityName.get(inputs.severityThreshold);
      if (severityThreshold === undefined) {
        core.setFailed(`severity ${inputs.severityThreshold} does not exist`);
        return;
      }
    }

    let trivyBin: string;
    await core.group(`Download and install trivy`, async () => {
      trivyBin = await trivy.install(inputs.trivyVersion || 'latest');
    });

    let scanInput: string;
    if (inputs.image) {
      scanInput = inputs.image;
    } else {
      scanInput = inputs.tarball;
    }

    let scanResult: trivy.ScanResult = {};
    await core.group(`Scanning ${scanInput} Docker image`, async () => {
      scanResult = await trivy.scan(trivyBin, inputs);
      context.setOutput('json', scanResult.json);
      context.setOutput('sarif', scanResult.sarif);
    });

    await core.group(`Scan result (table)`, async () => {
      if (scanResult.table) {
        core.info(fs.readFileSync(scanResult.table, {encoding: 'utf-8'}).trim());
      }
    });

    await core.group(`Scan result (json)`, async () => {
      if (scanResult.json) {
        core.info(fs.readFileSync(scanResult.json, {encoding: 'utf-8'}).trim());
      }
    });

    await core.group(`Scan result (sarif)`, async () => {
      if (scanResult.sarif) {
        core.info(fs.readFileSync(scanResult.sarif, {encoding: 'utf-8'}).trim());
      }
    });

    let unhealthy: Array<string> = [];
    let vulns: Map<trivy.Severity, string> = new Map();
    if (scanResult.vulns) {
      await context.asyncForEach(scanResult.vulns, async vuln => {
        const vulnSeverity = trivy.SeverityName.get(vuln.Severity);
        const vulnMsg = `${vuln.VulnerabilityID}) ${vuln.Severity} severity - ${vuln.Title} vulnerability in ${vuln.PkgName}`;
        if (vulnSeverity) {
          vulns.set(vulnSeverity, vulnMsg);
          if (severityThreshold && vulnSeverity >= severityThreshold) {
            unhealthy.push(vulnMsg);
          }
        }
      });
    }

    if (vulns.size > 0 && inputs.annotations) {
      await core.group(`Generating GitHub annotations`, async () => {
        await context.asyncForEach(vulns, async vuln => {
          switch (vuln.key) {
            case trivy.Severity.Unknown: {
              core.notice(vuln.value);
              break;
            }
            case trivy.Severity.Low: {
              core.info(vuln.value);
              break;
            }
            case trivy.Severity.Medium: {
              core.warning(vuln.value);
              break;
            }
            case trivy.Severity.High: {
              core.error(vuln.value);
              break;
            }
            case trivy.Severity.Critical: {
              core.error(vuln.value);
              break;
            }
          }
        });
      });
    }

    if (unhealthy.length > 0) {
      await core.group(`Checking severities`, async () => {
        await context.asyncForEach(unhealthy, async msg => {
          core.info(`  • ${msg}`);
        });
      });
      core.setFailed(`Docker image is unhealthy. Following your criteria, the job has been marked as failed.`);
      return;
    }
  } catch (error: any) {
    core.setFailed(error.message);
  }
}

async function cleanup(): Promise<void> {
  return;
}

if (!stateHelper.IsPost) {
  run();
} else {
  cleanup();
}
