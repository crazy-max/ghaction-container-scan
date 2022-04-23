import {describe, expect, it} from '@jest/globals';
import * as github from '../src/github';

describe('github', () => {
  it('returns latest trivy GitHub release', async () => {
    const release = await github.getRelease('latest');
    expect(release).not.toBeNull();
    expect(release?.tag_name).not.toEqual('');
  });

  it('returns v0.19.2 trivy GitHub release', async () => {
    const release = await github.getRelease('v0.19.2');
    expect(release).not.toBeNull();
    expect(release?.tag_name).toEqual('v0.19.2');
  });
});
