import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyPolicy, verifyApproval } from './github-approval.mjs';

const repository = { private: true };
const environment = { id: 1, protection_rules: [{ type: 'required_reviewers', prevent_self_review: true, reviewers: [{ id: 2 }] }],
  deployment_branch_policy: { custom_branch_policies: true, protected_branches: false } };
const branches = { total_count: 1, branch_policies: [{ name: 'main', type: 'branch' }] };
const approved = { state: 'approved', user: { login: 'reviewer' }, environments: [{ id: 1 }] };
test('Approval policy requires a private repository and main-only independent reviewers', () => {
  verifyPolicy(repository, environment, branches);
  assert.throws(() => verifyPolicy({ private: false }, environment, branches));
  assert.throws(() => verifyPolicy(repository, { ...environment, protection_rules: [] }, branches));
  assert.throws(() => verifyPolicy(repository, { ...environment, protection_rules: [{ ...environment.protection_rules[0], prevent_self_review: false }] }, branches));
  assert.throws(() => verifyPolicy(repository, environment, { ...branches, total_count: 2 }));
  for (const policy of [{ name: '*', type: 'branch' }, { name: 'main', type: 'tag' }]) {
    assert.throws(() => verifyPolicy(repository, environment, { total_count: 1, branch_policies: [policy] }));
  }
});
test('An environment name or bypass is insufficient without this run approval', () => {
  verifyApproval([approved], environment, 'requester');
  for (const reviews of [[], [{ ...approved, environments: [{ id: 2 }] }], [approved, { ...approved, state: 'rejected' }]]) {
    assert.throws(() => verifyApproval(reviews, environment, 'requester'));
  }
  assert.throws(() => verifyApproval([approved], environment, 'reviewer'));
});
