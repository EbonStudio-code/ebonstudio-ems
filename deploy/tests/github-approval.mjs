import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

export function verifyPolicy(repository, environment, branches) {
  assert.equal(repository.private, true, 'Repository must remain private');
  const rule = environment.protection_rules?.find(item => item.type === 'required_reviewers');
  assert.ok(rule?.reviewers?.length, 'Configure required environment reviewers first');
  assert.equal(rule.prevent_self_review, true, 'Prevent self-review in the environment');
  assert.equal(environment.deployment_branch_policy?.custom_branch_policies, true, 'Use selected deployment branches');
  assert.equal(environment.deployment_branch_policy?.protected_branches, false);
  assert.equal(branches.total_count, 1, 'Allow only the main branch, not tags or wildcards');
  assert.equal(branches.branch_policies?.[0]?.name, 'main');
  assert.equal(branches.branch_policies?.[0]?.type, 'branch');
}

export function verifyApproval(reviews, environment, actor) {
  const matching = reviews.filter(review => review.environments?.some(item => item.id === environment.id));
  assert.equal(matching.length, 1, 'Require one unambiguous approval on a fresh dispatch');
  const latest = matching[0];
  assert.equal(latest.state, 'approved', 'Latest environment review must approve this run');
  assert.ok(latest.user?.login && latest.user.login !== actor, 'Approval must come from a different person');
}

async function main() {
  const { GITHUB_REPOSITORY: repo, GITHUB_TOKEN: token, GITHUB_REF: ref,
    GITHUB_EVENT_NAME: event, GITHUB_RUN_ID: run, GITHUB_ACTOR: actor } = process.env;
  const [environmentName, mode] = process.argv.slice(2);
  assert.ok(['release', 'production'].includes(environmentName));
  assert.ok(['policy', 'approved'].includes(mode));
  assert.equal(ref, 'refs/heads/main');
  assert.equal(event, 'workflow_dispatch');
  assert.equal(process.env.GITHUB_RUN_ATTEMPT, '1', 'Dispatch a new run instead of reusing old approvals');
  assert.match(repo || '', /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);
  assert.ok(token);
  const get = async path => {
    const response = await fetch(`https://api.github.com/repos/${repo}${path ? '/' + path : ''}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      redirect: 'error', signal: AbortSignal.timeout(15000),
    });
    // Never log response bodies or request headers.
    if (!response.ok) throw new Error(`GitHub approval verification unavailable (HTTP ${response.status})`);
    return response.json();
  };
  const [repository, environment, branches] = await Promise.all([
    get(''), get(`environments/${environmentName}`),
    get(`environments/${environmentName}/deployment-branch-policies?per_page=100`),
  ]);
  verifyPolicy(repository, environment, branches);
  if (mode === 'approved') {
    assert.match(run || '', /^\d+$/);
    verifyApproval(await get(`actions/runs/${run}/approvals`), environment, actor);
  }
  console.log(`Verified private repository and ${environmentName} ${mode}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await main(); }
  catch (error) {
    console.error(error.message.startsWith('GitHub approval verification') ? error.message
      : 'Approval gate refused: verify private repository, main-only environment, required independent reviewers and this run approval.');
    process.exitCode = 1;
  }
}
