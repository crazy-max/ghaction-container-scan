import * as core from '@actions/core';

export const IsPost = !!process.env['STATE_isPost'];

if (!IsPost) {
  core.saveState('isPost', 'true');
}
