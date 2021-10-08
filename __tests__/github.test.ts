import * as github from '../src/github';

describe('github', () => {
  it('returns latest trivy GitHub release', async () => {
    const release = await github.getRelease('latest');
    console.log(release);
    expect(release).not.toBeNull();
    expect(release?.tag_name).not.toEqual('');
  });

  it('returns v0.19.2 trivy GitHub release', async () => {
    const release = await github.getRelease('v0.19.2');
    console.log(release);
    expect(release).not.toBeNull();
    expect(release?.tag_name).toEqual('v0.19.2');
  });
});
