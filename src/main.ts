process.env.FORCE_COLOR = '2';

import chalk from 'chalk';
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

    let scanInput: string | undefined;
    if (inputs.image) {
      scanInput = inputs.image;
    } else {
      scanInput = inputs.tarball;
    }

    let scanResult: trivy.ScanResult = {};
    await core.group(`Scanning ${scanInput} Docker image`, async () => {
      scanResult = await trivy.scan({
        Bin: trivyBin,
        Inputs: inputs
      });
      if (scanResult.json) {
        context.setOutput('json', scanResult.json);
      }
      if (scanResult.sarif) {
        context.setOutput('sarif', scanResult.sarif);
      }
    });

    await core.group(`Scan result`, async () => {
      if (scanResult.table) {
        core.info(fs.readFileSync(scanResult.table, {encoding: 'utf-8'}).trim());
      }
    });

    type Result = {
      severity?: trivy.Severity;
      annotationMsg?: string;
      unhealthyMsg?: string;
    };

    let result: Array<Result> = [];
    let isUnhealthy: boolean = false;

    if (scanResult.vulns) {
      await context.asyncForEach(scanResult.vulns, async v => {
        const vulnSeverity = trivy.SeverityName.get(v.Severity);
        if (vulnSeverity) {
          const res: Result = {
            severity: vulnSeverity,
            annotationMsg: `${v.VulnerabilityID} - ${v.Severity} severity - ${v.Title} vulnerability in ${v.PkgName}`
          };
          if (severityThreshold && vulnSeverity >= severityThreshold) {
            let vulnidColorized, vulnsevColorized;
            switch (vulnSeverity) {
              case trivy.Severity.Unknown: {
                vulnidColorized = chalk.gray(v.VulnerabilityID);
                vulnsevColorized = chalk.gray(v.Severity);
                break;
              }
              case trivy.Severity.Low: {
                vulnidColorized = chalk.blue(v.VulnerabilityID);
                vulnsevColorized = chalk.blue(v.Severity);
                break;
              }
              case trivy.Severity.Medium: {
                vulnidColorized = chalk.yellow(v.VulnerabilityID);
                vulnsevColorized = chalk.yellow(v.Severity);
                break;
              }
              case trivy.Severity.High: {
                vulnidColorized = chalk.red(v.VulnerabilityID);
                vulnsevColorized = chalk.red(v.Severity);
                break;
              }
              case trivy.Severity.Critical: {
                vulnidColorized = chalk.bold.redBright(v.VulnerabilityID);
                vulnsevColorized = chalk.bold.redBright(v.Severity);
                break;
              }
            }
            const pkgTxt = `${chalk.magenta(v.PkgName)}${new Array(40 - chalk.magenta(v.PkgName).length).join(' ')}`;
            const vulnidTxt = `${vulnidColorized}${new Array(30 - vulnidColorized.length).join(' ')}`;
            const vulnsevTxt = `${vulnsevColorized}${new Array(20 - vulnsevColorized.length).join(' ')}`;
            res.unhealthyMsg = `${pkgTxt} ${vulnidTxt} ${vulnsevTxt} ${v.Title}`;
            isUnhealthy = true;
          }
          result.push(res);
        }
      });
    }

    if (result.length == 0) {
      return;
    }

    if (inputs.annotations) {
      await core.group(`Generating GitHub annotations`, async () => {
        await context.asyncForEach(result, async res => {
          switch (res.severity) {
            case trivy.Severity.Unknown: {
              core.notice(res.annotationMsg);
              break;
            }
            case trivy.Severity.Low: {
              core.notice(res.annotationMsg);
              break;
            }
            case trivy.Severity.Medium: {
              core.warning(res.annotationMsg);
              break;
            }
            case trivy.Severity.High: {
              core.error(res.annotationMsg);
              break;
            }
            case trivy.Severity.Critical: {
              core.error(res.annotationMsg);
              break;
            }
          }
        });
      });
    }

    await context.asyncForEach(result, async res => {
      if (res.unhealthyMsg) {
        core.info(res.unhealthyMsg);
      }
    });
    if (isUnhealthy) {
      core.setFailed(`Docker image is unhealthy. Following your desired severity threshold (${inputs.severityThreshold}), the job has been marked as failed.`);
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
