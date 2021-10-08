import fs from 'fs';
import * as context from './context';
import * as github from './github';
import * as trivy from './trivy';
import * as stateHelper from './state-helper';
import * as core from '@actions/core';
import {ScanResult} from './trivy';

async function run(): Promise<void> {
  try {
    const inputs: context.Inputs = await context.getInputs();

    if (!inputs.image && !inputs.tarball) {
      core.setFailed('image or tarball input required');
      return;
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

    let scanResult: ScanResult;
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

    if (inputs.annotations) {
      await core.group(`Generating GitHub annotations`, async () => {
        if (scanResult.json) {
          await github.setAnnotations(fs.readFileSync(scanResult.json, {encoding: 'utf-8'}).trim());
        }
      });
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
