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
    await core.group(`Scanning ${scanInput} container image`, async () => {
      scanResult = await trivy.scan({
        Bin: trivyBin,
        Inputs: inputs
      });
      if (scanResult.json) {
        const resJson = fs.readFileSync(scanResult.json, {encoding: 'utf-8'}).trim();
        if (resJson.length > 0) {
          core.setOutput('json', scanResult.json);
        }
      }
      if (scanResult.sarif) {
        const resSarif = fs.readFileSync(scanResult.sarif, {encoding: 'utf-8'}).trim();
        if (resSarif.length > 0) {
          core.setOutput('sarif', scanResult.sarif);
        }
      }
    });

    await core.group(`Scan result`, async () => {
      if (scanResult.table) {
        const resTable = fs.readFileSync(scanResult.table, {encoding: 'utf-8'}).trim();
        if (resTable.length > 0) {
          core.info(resTable);
        } else {
          core.info(`No vulnerability found`);
        }
      }
    });

    type Result = {
      severity?: trivy.Severity;
      annotationMsg?: string;
      unhealthyMsg?: string;
    };

    const result: Array<Result> = [];
    let isUnhealthy = false;

    if (scanResult.vulns) {
      await context.asyncForEach(scanResult.vulns, async v => {
        const vulnSeverity = trivy.SeverityName.get(v.Severity);
        if (vulnSeverity) {
          const res: Result = {
            severity: vulnSeverity,
            annotationMsg: `${v.VulnerabilityID} - ${v.Severity} severity - ${v.Title} vulnerability in ${v.PkgName}`
          };
          if (severityThreshold && vulnSeverity >= severityThreshold) {
            let vulnidColorized,
              vulnsevColorized = '';
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
            if (vulnidColorized.length > 0 && vulnsevColorized.length > 0) {
              const pkgTxt = `${chalk.magenta(v.PkgName).padEnd(40)}`;
              const vulnidTxt = `${vulnidColorized.padEnd(40)}`;
              const vulnsevTxt = `${vulnsevColorized.padEnd(30)}`;
              res.unhealthyMsg = `${pkgTxt} ${vulnidTxt} ${vulnsevTxt} ${v.Title}`;
              isUnhealthy = true;
            }
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
      core.setFailed(`Container image is unhealthy. Following your desired severity threshold (${inputs.severityThreshold}), the job has been marked as failed.`);
    }
  } catch (error) {
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
