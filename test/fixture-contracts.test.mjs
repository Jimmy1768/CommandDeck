import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { validateCommandPack } from '../packages/shell-core/index.mjs';
import { ALLOWLISTED_LOCAL_RUNNER_ACTIONS } from '../packages/shell-core/local-runner.mjs';

const root = path.resolve(import.meta.dirname, '..');

async function readJson(relativePath) {
  const contents = await readFile(path.join(root, relativePath), 'utf8');
  return JSON.parse(contents);
}

const forbiddenEffects = new Set([
  'payment',
  'production_deploy',
  'production_restart',
  'migration',
  'customer_data_mutation',
  'public_message',
  'external_party_contact',
  'infrastructure_mutation',
  'secret_write',
  'execute_now',
  'execute_without_approval'
]);

test('permission contract keeps execute-now disabled', async () => {
  const permissions = await readJson('contracts/permissions/permission-levels.json');
  assert.equal(permissions.execute_now_default, 'disabled');

  const executeNow = permissions.levels.find((level) => level.id === 'execute-now');
  assert.ok(executeNow);
  assert.equal(executeNow.enabled, false);
});

test('MVP command pack contains the first five commands only', async () => {
  const pack = await readJson('contracts/commands/mvp-commands.cdeck-pack.json');
  assert.equal(pack.schema_version, '0.1');
  assert.equal(pack.commands.length, 5);

  const ids = pack.commands.map((command) => command.command_id);
  assert.deepEqual(ids, [
    'mvp.next_sourcegrid_task',
    'mvp.operator_queue_today',
    'mvp.draft_handoff',
    'mvp.operatorkit_dry_run',
    'mvp.apprelay_changes_today'
  ]);
});

test('command pack schema documents the Phase 1 loading boundary', async () => {
  const schema = await readJson('contracts/commands/command-pack.schema.json');

  assert.equal(schema.contract_kind, 'command-pack');
  assert.equal(schema.execute_now_enabled, false);
  assert.equal(schema.manifest_file_extension, '.cdeck-pack.json');
  assert.equal(schema.selector_target, 'pack_manifest_file');
  assert.equal(schema.selector_filter, '*.cdeck-pack.json');
  assert.ok(schema.required.includes('schema_version'));
  assert.deepEqual(schema.allowed_permission_levels, ['read-only', 'draft-only', 'approval-required']);
  assert.deepEqual(schema.allowed_source_roots, ['evals/fixtures/', 'local://']);
  assert.ok(schema.optional_pack_fields.includes('action_requirements'));
  assert.ok(schema.optional_command_fields.includes('runner_action'));
  assert.equal(schema.local_exact_runner.enabled_for_read_only, true);
  assert.equal(schema.local_exact_runner.execution_boundary, 'allowlisted_local_runner');
  assert.equal(schema.custom_pack_enforcement.default_policy, 'deny_by_default');
  assert.equal(schema.custom_pack_enforcement.pack_defined_runner_routes_allowed, false);
  assert.equal(schema.custom_pack_enforcement.arbitrary_shell_passthrough_allowed, false);
  assert.equal(schema.custom_pack_enforcement.hidden_script_execution_allowed, false);
  assert.equal(
    schema.custom_pack_enforcement.rejection_behavior.unsafe_runtime_request,
    'execution_blocked_before_side_effects'
  );
  assert.equal(schema.custom_pack_enforcement.rejection_behavior.fallback_execution_allowed, false);
  assert.equal(schema.custom_pack_enforcement.audit_event, 'pack_command_rejected');
  assert.equal(
    schema.custom_pack_enforcement.audit_contract,
    'contracts/records/pack-rejection-audit.schema.json'
  );
  assert.equal(schema.custom_pack_enforcement.audit_write_rule, 'opt_in_local_write_only');
  assert.equal(schema.action_requirements.schema, 'contracts/commands/action-requirements.schema.json');
  assert.equal(schema.action_requirements.core_requirements, 'contracts/commands/core-action-requirements.json');
  assert.equal(schema.action_requirements.core_runtime_source, 'contracts/commands/core-action-requirements.json');
  assert.equal(schema.action_requirements.pack_extension_allowed, true);
  assert.equal(schema.action_requirements.pack_runtime_scope, 'active_command_pack_only');
  assert.equal(schema.action_requirements.pack_runtime_authority, 'clarification_metadata_only');
  assert.equal(
    schema.action_requirements.pack_resume_rule,
    'resumed_command_must_resolve_to_allowed_active_pack_command'
  );
  assert.equal(schema.action_requirements.missing_required_slot_behavior, 'concept_checking_question');
  assert.ok(schema.forbidden_command_fields.includes('handler'));
  assert.equal(schema.real_pack_locations.sourcegrid, 'sourcegrid-labs');
  assert.equal(schema.real_pack_locations.commanddeck_repo, 'generic examples and tests only');
});

test('pack rejection audit schema is opt-in and redacted', async () => {
  const schema = await readJson('contracts/records/pack-rejection-audit.schema.json');

  assert.equal(schema.contract_kind, 'pack-rejection-audit');
  assert.equal(schema.event, 'pack_command_rejected');
  assert.equal(schema.storage_default, '.commanddeck/audit/pack-rejections');
  assert.equal(schema.write_rule, 'opt_in_local_write_only');
  assert.equal(schema.redaction_rule, 'secret_like_values_redacted_no_script_contents_stored');
  assert.ok(schema.required.includes('errors'));
  assert.ok(schema.allowed_rejection_phases.includes('pack_load'));
  assert.ok(schema.forbidden_payloads.includes('script_contents'));
  assert.ok(schema.forbidden_payloads.includes('secrets'));
});

test('action requirements schema allows core and pack actions with CCQ fallback', async () => {
  const schema = await readJson('contracts/commands/action-requirements.schema.json');

  assert.equal(schema.contract_kind, 'action-requirements');
  assert.deepEqual(schema.allowed_capability_sources, ['core', 'pack']);
  assert.deepEqual(schema.allowed_slots, ['device_code', 'action', 'object', 'context', 'end_code']);
  assert.deepEqual(schema.allowed_risk_tiers, [
    'informational',
    'local_control',
    'workspace_mutation',
    'delegated_agentic'
  ]);
  assert.ok(schema.action_required_fields.includes('missing_required_slot_ccq'));
  assert.equal(
    schema.defaulting_rule,
    'defaults_allowed_only_when_exactly_one_safe_active_context_candidate_exists'
  );
  assert.equal(
    schema.ccq_rule,
    'missing_required_or_non_defaultable_conditional_slots_force_concept_checking_question'
  );
  assert.equal(
    schema.core_runtime_source_rule,
    'deterministic_core_ccq_policy_loads_contracts_commands_core_action_requirements_json'
  );
  assert.equal(
    schema.pack_extension_rule,
    'packs_may_declare_action_requirements_but_commanddeck_validates_against_this_schema'
  );
});

test('core action requirements define V1 spoken slot needs', async () => {
  const requirements = await readJson('contracts/commands/core-action-requirements.json');
  const actions = new Map(requirements.actions.map((action) => [action.action, action]));

  assert.equal(requirements.contract_kind, 'action-requirements');
  assert.equal(requirements.owner, 'command-deck');
  assert.deepEqual([...actions.keys()], ['open', 'close', 'find', 'start', 'stop', 'play', 'pause']);

  for (const action of actions.values()) {
    assert.equal(action.capability_source, 'core');
    assert.deepEqual(action.required_slots, ['device_code', 'action', 'object']);
    assert.ok(action.optional_slots.includes('context'));
    assert.ok(action.optional_slots.includes('end_code'));
    assert.equal(typeof action.missing_required_slot_ccq, 'string');
    assert.notEqual(action.missing_required_slot_ccq.length, 0);
  }

  assert.equal(actions.get('open').risk_tier, 'local_control');
  assert.equal(actions.get('find').risk_tier, 'informational');
  assert.equal(actions.get('start').risk_tier, 'workspace_mutation');
  assert.ok(actions.get('start').conditionally_required_slots.length > 0);
});

test('local exact command pack declares allowlisted runner actions only', async () => {
  const pack = await readJson('contracts/commands/local-exact-commands.cdeck-pack.json');
  const routes = await readJson('contracts/routes/route-contracts.json');
  const permissions = await readJson('contracts/permissions/permission-levels.json');
  const errors = validateCommandPack(pack, { routes, permissions });

  assert.equal(pack.pack_id, 'commanddeck.local-exact.slice2');
  assert.deepEqual(errors, []);
  assert.equal(pack.action_requirements.length, 1);
  assert.equal(pack.action_requirements[0].action, 'check');
  assert.equal(pack.action_requirements[0].capability_source, 'pack');
  assert.equal(pack.action_requirements[0].missing_required_slot_ccq, 'What should I check?');
  assert.equal(pack.commands.length, 4);
  assert.ok(pack.commands.every((command) => command.route === 'local.exact_read'));
  assert.ok(pack.commands.every((command) => ALLOWLISTED_LOCAL_RUNNER_ACTIONS.includes(command.runner_action)));
  assert.ok(pack.commands.every((command) => command.sources.every((source) => source.startsWith('local://'))));
});

test('local approved command pack stays approval-gated and allowlisted', async () => {
  const pack = await readJson('contracts/commands/local-approved-commands.cdeck-pack.json');
  const routes = await readJson('contracts/routes/route-contracts.json');
  const permissions = await readJson('contracts/permissions/permission-levels.json');
  const errors = validateCommandPack(pack, { routes, permissions });

  assert.equal(pack.pack_id, 'commanddeck.local-approved.slice2');
  assert.deepEqual(errors, []);
  assert.equal(pack.commands.length, 2);
  assert.ok(pack.commands.every((command) => command.route === 'local.exact_control'));
  assert.ok(pack.commands.every((command) => command.permission_level === 'approval-required'));
  assert.ok(pack.commands.every((command) => ALLOWLISTED_LOCAL_RUNNER_ACTIONS.includes(command.runner_action)));
  assert.ok(pack.commands.every((command) => command.approval_prompt));
});

test('pack discovery schema is metadata-only and non-executing', async () => {
  const schema = await readJson('contracts/commands/pack-discovery.schema.json');

  assert.equal(schema.contract_kind, 'pack-discovery');
  assert.equal(schema.real_execution_enabled, false);
  assert.equal(schema.execute_now_enabled, false);
  assert.deepEqual(schema.allowed_discovery_modes, ['metadata_only']);
  assert.equal(schema.active_pack_policy, 'single_active_pack_per_invocation');
  assert.equal(schema.active_pack_source_field, 'default_command_pack');
  assert.equal(schema.pack_manifest_file_extension, '.cdeck-pack.json');
  assert.equal(schema.pack_selector_target, 'pack_manifest_file');
  assert.equal(schema.pack_selector_filter, '*.cdeck-pack.json');
  assert.equal(schema.custom_pack_catalog_dir, 'command-packs');
  assert.equal(schema.custom_pack_manifest_path_rule, 'command-packs/<pack_slug>/<pack_slug>.cdeck-pack.json');
  assert.equal(schema.pack_slug_rule, 'lowercase-kebab');
  assert.deepEqual(schema.pack_selection_surfaces, ['open', 'recent']);
  assert.equal(schema.open_rule, 'validates_one_selected_pack_without_activating_multiple_profiles');
  assert.equal(schema.recent_rule, 'reads_local_recent_pack_state_without_loading_multiple_packs');
  assert.equal(schema.recent_state_path, '.commanddeck/state/recent-packs.json');
  assert.equal(schema.discovery_roots_role, 'available_pack_locations_only');
  assert.equal(schema.discovery_roots_active_for_routing, false);
  assert.ok(schema.allowed_kinds.includes('owner-repo'));
  assert.ok(schema.forbidden_root_fields.includes('script'));
  assert.ok(schema.forbidden_root_fields.includes('secrets'));
  assert.equal(schema.allowed_repo_fixture_root, 'evals/fixtures/command-packs');
  assert.equal(schema.external_local_folder_rule, 'absolute local-folder roots are allowed only when local_only is true');
  assert.equal(schema.custom_pack_source_of_truth, 'user_owned_git_repo_or_local_control_folder');
  assert.equal(schema.core_pack_source_of_truth, 'commanddeck_repo');
});

test('SourceGrid attachment schema keeps billing anchor outside owner repos', async () => {
  const schema = await readJson('contracts/attachments/sourcegrid-attachment.schema.json');

  assert.equal(schema.contract_kind, 'sourcegrid-attachment');
  assert.equal(schema.attachment_owner, 'sourcegrid');
  assert.equal(schema.billing_owner, 'sourcegrid_workspace');
  assert.equal(schema.commanddeck_stores_payment_data, false);
  assert.equal(schema.apprelay_client_contract.client_type, 'internal_ops_tool');
  assert.equal(schema.apprelay_client_contract.client_key, 'commanddeck');
  assert.equal(schema.apprelay_client_contract.purpose, 'command_routing_reasoning');
  assert.equal(schema.apprelay_client_contract.model_selection_owner, 'apprelay');
  assert.equal(schema.apprelay_client_contract.commanddeck_sends_model_name, false);
  assert.equal(schema.apprelay_client_contract.no_execution_authority, true);
  assert.equal(schema.apprelay_client_contract.no_memory_activation, true);
  assert.equal(schema.apprelay_client_contract.memory_writeback_requires_user_confirmation, true);
  assert.equal(schema.apprelay_scope_proof_contract.preferred_transport, 'sourcegrid_brokered');
  assert.equal(schema.apprelay_scope_proof_contract.direct_apprelay_call_allowed, false);
  assert.equal(
    schema.apprelay_scope_proof_contract.direct_apprelay_secret_policy,
    'commanddeck_cli_must_not_store_long_lived_apprelay_signing_secret'
  );
  assert.equal(schema.apprelay_scope_proof_contract.runtime_mode, 'sourcegrid_internal_ops');
  assert.ok(schema.apprelay_scope_proof_contract.authorization_critical_groups.includes('request_identity'));
  assert.ok(schema.apprelay_scope_proof_contract.authorization_critical_groups.includes('sourcegrid_scope_proof'));
  assert.equal(schema.owner_repo_role, 'command_pack_source_only');
  assert.equal(schema.sourcegrid_labs_console_role, 'primary_commanddeck_pack_management_surface');
  assert.equal(schema.commanddeck_local_runner_role, 'local_validation_and_execution_boundary');
  assert.equal(schema.console_bridge_contract, 'contracts/bridge/sourcegrid-console-bridge.schema.json');
  assert.equal(schema.phase_1_apprelay_spend_enabled, false);
  assert.ok(schema.sourcegrid_credit_gate_scope.includes('apprelay_reasoning'));
  assert.ok(schema.not_blocked_by_credit_exhaustion.includes('local_exact_commands'));
  assert.ok(schema.not_blocked_by_credit_exhaustion.includes('voice_capture_surface'));
  assert.ok(schema.allowed_payment_method_states.includes('missing'));
  assert.ok(schema.allowed_payment_method_states.includes('verified'));
  assert.ok(schema.forbidden_local_payment_fields.includes('card_number'));
  assert.ok(schema.forbidden_local_payment_fields.includes('stripe_secret_key'));
});

test('AppRelay CommandDeck reasoning contracts are internal ops only', async () => {
  const request = await readJson('contracts/apprelay/commanddeck-reasoning-request.schema.json');
  const response = await readJson('contracts/apprelay/commanddeck-reasoning-response.schema.json');

  assert.equal(request.contract_kind, 'apprelay-commanddeck-reasoning-request');
  assert.equal(request.client_type, 'internal_ops_tool');
  assert.equal(request.client_key, 'commanddeck');
  assert.equal(request.purpose, 'command_routing_reasoning');
  assert.equal(request.runtime_mode, 'sourcegrid_internal_ops');
  assert.equal(request.model_selection_owner, 'apprelay');
  assert.equal(request.commanddeck_sends_model_name, false);
  assert.equal(request.request_transport_recommendation, 'sourcegrid_brokered');
  assert.equal(
    request.direct_apprelay_secret_policy,
    'commanddeck_cli_must_not_store_long_lived_apprelay_signing_secret'
  );
  assert.ok(request.required_fields.includes('request_identity'));
  assert.ok(request.required_fields.includes('sourcegrid_scope_proof'));
  assert.ok(request.required_fields.includes('active_local_context'));
  assert.ok(request.required_fields.includes('authority_constraints'));
  assert.ok(request.required_fields.includes('runtime_task'));
  assert.ok(request.required_fields.includes('required_output_schema'));
  assert.ok(request.request_identity.authorization_critical.includes('request_id'));
  assert.equal(request.request_identity.required_values.client_type, 'internal_ops_tool');
  assert.equal(request.request_identity.required_values.runtime_mode, 'sourcegrid_internal_ops');
  assert.ok(request.sourcegrid_scope_proof.authorization_critical.includes('sourcegrid_workspace_id'));
  assert.ok(request.sourcegrid_scope_proof.authorization_critical.includes('apprelay_runtime_entitlement'));
  assert.equal(request.sourcegrid_scope_proof.entitlement_rule, 'must_allow_sourcegrid_billed_apprelay_runtime');
  assert.ok(request.active_local_context.authorization_critical.includes('active_pack_digest'));
  assert.equal(request.authority_constraints.required_values.no_execution_authority, true);
  assert.equal(request.authority_constraints.required_values.memory_read_scope, 'approved_active_only');
  assert.equal(
    request.authority_constraints.required_values.memory_writeback_policy,
    'candidate_only_requires_explicit_user_confirmation'
  );
  assert.equal(request.runtime_task.default_route_work_type, 'commanddeck.command_routing_reasoning.standard');
  assert.ok(request.forbidden_fields.includes('model'));
  assert.ok(request.forbidden_fields.includes('long_lived_apprelay_secret'));
  assert.ok(request.forbidden_fields.includes('shell'));
  assert.equal(request.authority_limits.no_execution_authority, true);
  assert.equal(request.authority_limits.no_memory_activation, true);
  assert.equal(request.authority_limits.memory_writeback_requires_user_confirmation, true);

  assert.equal(response.contract_kind, 'apprelay-commanddeck-reasoning-response');
  assert.equal(response.client_type, 'internal_ops_tool');
  assert.equal(response.client_key, 'commanddeck');
  assert.deepEqual(response.allowed_outcomes, [
    'resolved_intent',
    'concept_checking_question',
    'unsupported',
    'memory_candidate',
    'rejected'
  ]);
  assert.ok(response.allowed_rejection_statuses.includes('rejected_missing_scope_proof'));
  assert.ok(response.allowed_rejection_statuses.includes('rejected_stale_scope_proof'));
  assert.ok(response.allowed_rejection_statuses.includes('rejected_not_entitled'));
  assert.ok(response.allowed_rejection_statuses.includes('rejected_invalid_client_identity'));
  assert.ok(response.allowed_rejection_statuses.includes('rejected_scope_hash_mismatch'));
  assert.equal(response.runtime_rule, 'commanddeck_must_revalidate_before_routing');
  assert.equal(response.candidate_memory_runtime_rule, 'candidate_memory_is_not_live_runtime_memory');
  assert.ok(response.forbidden_fields.includes('approval_decision'));
  assert.ok(response.forbidden_fields.includes('execute_now'));
  assert.ok(response.outcome_requirements.memory_candidate.includes('requires_user_confirmation'));
  assert.ok(response.outcome_requirements.rejected.includes('rejection_status'));
});

test('SourceGrid console bridge is selection metadata only', async () => {
  const contract = await readJson('contracts/bridge/sourcegrid-console-bridge.schema.json');

  assert.equal(contract.contract_kind, 'sourcegrid-console-bridge');
  assert.equal(contract.console_owner, 'sourcegrid_labs_web_console');
  assert.equal(contract.local_authority, 'commanddeck_local_runner');
  assert.equal(contract.bridge_mode_v1, 'pull_then_local_validate');
  assert.equal(contract.primary_user_surface, 'sourcegrid_labs_web_console');
  assert.equal(contract.local_cli_role, 'developer_debug_fallback');
  assert.equal(contract.inbound_remote_execution_enabled, false);
  assert.equal(contract.remote_shell_enabled, false);
  assert.equal(contract.active_pack_policy, 'single_active_pack_per_invocation');
  assert.equal(contract.pack_selector_target, 'pack_manifest_file');
  assert.equal(contract.pack_selector_filter, '*.cdeck-pack.json');
  assert.equal(contract.custom_pack_catalog_dir, 'command-packs');
  assert.equal(contract.custom_pack_manifest_path_rule, 'command-packs/<pack_slug>/<pack_slug>.cdeck-pack.json');
  assert.equal(contract.pack_slug_rule, 'lowercase-kebab');
  assert.deepEqual(contract.pack_selection_surfaces, ['open', 'recent']);
  assert.deepEqual(contract.control_root_kinds, ['owner-repo', 'local-folder']);
  assert.equal(contract.selection_manifest_contract, 'contracts/bridge/sourcegrid-pack-selection.schema.json');
  assert.equal(contract.selection_apply_command, 'pack:apply-selection');
  assert.ok(contract.console_may.includes('request_active_pack_selection'));
  assert.ok(contract.console_must_not.includes('send_shell_commands'));
  assert.ok(contract.console_must_not.includes('execute_local_runner_actions'));
  assert.ok(contract.console_must_not.includes('activate_multiple_packs'));
  assert.ok(contract.local_runner_must.includes('validate_pack_path_inside_control_root'));
  assert.ok(contract.local_runner_must.includes('load_and_validate_one_command_pack'));
  assert.ok(contract.selection_manifest_required_fields.includes('pack_path'));
  assert.deepEqual(contract.allowed_pack_source_kinds, ['owner-repo', 'local-folder']);
  assert.equal(
    contract.selection_apply_rule,
    'sourcegrid_selection_is_candidate_until_local_pack_open_validates_one_pack'
  );
  assert.equal(
    contract.external_local_folder_rule,
    'custom_packs_may_be_selected_from_configured_local_only_control_folders'
  );
  assert.equal(
    contract.source_of_truth_rule,
    'core_packs_live_in_commanddeck_repo_custom_packs_live_in_user_owned_git_or_local_control_folders'
  );
  assert.equal(contract.selection_execution_rule, 'selection_never_executes_commands_or_scripts');
  assert.equal(contract.recent_state_owner, 'commanddeck_local_runner');
  assert.ok(contract.forbidden_manifest_fields.includes('script'));
  assert.ok(contract.forbidden_manifest_fields.includes('secrets'));
  assert.ok(contract.forbidden_manifest_fields.includes('execute_now'));
});

test('SourceGrid pack selection manifest is candidate metadata only', async () => {
  const schema = await readJson('contracts/bridge/sourcegrid-pack-selection.schema.json');
  const fixture = await readJson('evals/fixtures/pack_selections/local-exact.selection.json');

  assert.equal(schema.contract_kind, 'sourcegrid-pack-selection');
  assert.equal(schema.bridge_contract, 'contracts/bridge/sourcegrid-console-bridge.schema.json');
  assert.equal(schema.apply_command, 'pack:apply-selection');
  assert.equal(schema.apply_mode, 'candidate_selection_then_local_pack_open_validation');
  assert.deepEqual(schema.allowed_pack_source_kinds, ['owner-repo', 'local-folder']);
  assert.equal(schema.pack_path_rule, 'relative_to_configured_control_root');
  assert.equal(schema.pack_path_extension_rule, 'must_end_with_.cdeck-pack.json');
  assert.equal(schema.pack_selector_filter, '*.cdeck-pack.json');
  assert.equal(schema.custom_pack_catalog_dir, 'command-packs');
  assert.equal(schema.custom_pack_manifest_path_rule, 'command-packs/<pack_slug>/<pack_slug>.cdeck-pack.json');
  assert.equal(schema.pack_slug_rule, 'lowercase-kebab');
  assert.equal(schema.local_apply_rule, 'pack_path_must_stay_inside_enabled_control_root');
  assert.equal(
    schema.external_local_folder_rule,
    'absolute local-folder control roots are allowed only when configured local_only true'
  );
  assert.equal(
    schema.source_of_truth_rule,
    'core_packs_live_in_commanddeck_repo_custom_packs_live_in_user_owned_git_or_local_control_folders'
  );
  assert.equal(schema.selection_execution_rule, 'selection_never_executes_commands_or_scripts');
  assert.equal(schema.active_pack_policy, 'single_active_pack_per_invocation');
  assert.equal(schema.recent_write_rule, 'recent_state_persistence_requires_write_state');
  assert.ok(schema.forbidden_fields.includes('shell'));
  assert.ok(schema.forbidden_fields.includes('execute_now'));

  for (const field of schema.required) {
    assert.ok(field in fixture, `${field} must be present in selection fixture`);
  }

  assert.equal(fixture.contract_kind, 'sourcegrid-pack-selection');
  assert.equal(fixture.pack_source_kind, 'local-folder');
  assert.equal(fixture.control_root_ref, 'local_builtin_control');
  assert.equal(fixture.pack_path, 'local-exact-commands.cdeck-pack.json');
});

test('action record schema models concept-checking questions as non-execution', async () => {
  const schema = await readJson('contracts/records/action-record.schema.json');
  const ccq = await readJson('contracts/records/concept-checking-question.schema.json');
  const missingDependency = await readJson('contracts/records/missing-optional-dependency.response.json');

  assert.equal(schema.contract_kind, 'action-record');
  assert.ok(schema.allowed_result_statuses.includes('needs_clarification'));
  assert.ok(schema.allowed_result_statuses.includes('blocked_missing_optional_dependency'));
  assert.equal(
    schema.missing_optional_dependency_rule,
    'block_with_setup_guidance_and_authoring_fix_hint'
  );
  assert.deepEqual(schema.missing_optional_dependency_required_fields, [
    'route',
    'route_family',
    'missing_dependency',
    'setup_required',
    'can_retry_after_setup',
    'setup_hint',
    'authoring_fix_hint'
  ]);
  assert.equal(missingDependency.contract_kind, 'missing-optional-dependency-response');
  assert.equal(missingDependency.result_status, 'blocked_missing_optional_dependency');
  assert.equal(missingDependency.record_result.route_family, 'operatorkit.workflow');
  assert.equal(missingDependency.record_result.missing_dependency, 'operator-kit');
  assert.equal(missingDependency.record_result.setup_required, true);
  assert.equal(missingDependency.record_result.can_retry_after_setup, true);
  assert.match(missingDependency.record_result.setup_hint, /Clone and configure OperatorKit/);
  assert.match(missingDependency.record_result.authoring_fix_hint, /change the command route family/);
  assert.equal(schema.clarification_contract, 'contracts/records/concept-checking-question.schema.json');
  assert.equal(schema.clarification_rule, 'needs_clarification_is_not_failure_approval_or_execution');
  assert.equal(schema.ccq_state_storage_rule, 'ccq_state_is_stored_in_local_action_record');
  assert.equal(schema.ccq_state_persistence_rule, 'local_auditable_state_not_durable_memory');
  assert.equal(schema.ccq_resume_token_rule, 'short_lived_one_use_token_validated_from_action_record');
  assert.equal(schema.ccq_resume_token_concurrency_rule, 'atomic_compare_and_set_active_to_terminal_status');
  assert.equal(schema.ccq_resume_lock_rule, 'write_record_resume_uses_short_local_action_record_lock');
  assert.equal(schema.ccq_resume_lock_stale_after_seconds, 30);

  assert.equal(ccq.contract_kind, 'concept-checking-question');
  assert.equal(ccq.result_status, 'needs_clarification');
  assert.equal(ccq.execution_rule, 'no_action_executed');
  assert.equal(ccq.question_rule, 'ask_one_missing_slot_by_default_unless_slots_are_inseparable');
  assert.equal(ccq.state_storage_rule, 'ccq_state_is_stored_in_local_action_record');
  assert.equal(ccq.state_storage_location, 'records/actions/');
  assert.equal(ccq.state_persistence_rule, 'local_auditable_state_not_durable_memory');
  assert.equal(ccq.apprelay_dependency_rule, 'apprelay_not_required_for_deterministic_local_ccq_resume');
  assert.equal(ccq.cleanup_rule, 'expired_or_terminal_ccq_state_may_be_pruned_after_audit_window');
  assert.equal(ccq.audit_retention_days, 7);
  assert.equal(ccq.cleanup_mode_v1, 'manual_explicit_local_command_only');
  assert.equal(ccq.automatic_cleanup_v1, false);
  assert.equal(ccq.cleanup_scope_rule, 'cleanup_applies_to_terminal_or_expired_ccq_records_only');
  assert.equal(ccq.cleanup_memory_rule, 'ccq_cleanup_must_not_create_or_modify_learned_memory');
  assert.equal(ccq.resume_follow_up_rule, 'follow_up_answers_may_fill_missing_slots_only');
  assert.equal(ccq.resume_validation_rule, 'merged_intent_must_revalidate_before_routing');
  assert.equal(ccq.resume_token_lifetime_rule, 'short_lived_one_use_conversational_state_not_memory');
  assert.equal(ccq.resume_token_ttl_seconds, 300);
  assert.deepEqual(ccq.resume_token_binding, [
    'same_actor_ref',
    'same_workspace_ref',
    'same_adapter_session_when_available'
  ]);
  assert.equal(ccq.resume_token_reuse_rule, 'one_use_only');
  assert.equal(ccq.resume_token_expiration_behavior, 'expired_or_unbound_follow_up_is_new_command_or_fresh_ccq');
  assert.equal(ccq.resume_token_concurrency_rule, 'atomic_compare_and_set_active_to_terminal_status');
  assert.deepEqual(ccq.resume_token_terminal_statuses, ['used', 'expired', 'rejected']);
  assert.equal(ccq.resume_token_duplicate_behavior, 'already_consumed_token_must_not_route');
  assert.equal(
    ccq.resume_token_duplicate_response,
    'That clarification is no longer active. Please give the command again.'
  );
  assert.equal(ccq.resume_lock_rule, 'write_record_resume_uses_short_local_action_record_lock');
  assert.equal(ccq.resume_lock_stale_after_seconds, 30);
  assert.equal(ccq.resume_lock_fresh_behavior, 'fresh_lock_fails_without_routing');
  assert.equal(ccq.resume_lock_cleanup_scope, 'stale_lock_file_only_never_action_record');
  assert.ok(ccq.forbidden_resume_changes.includes('action'));
  assert.ok(ccq.forbidden_resume_changes.includes('non_missing_slots'));
  assert.equal(ccq.record_defaults.route, 'none');
  assert.equal(ccq.record_defaults.approval_status, 'required_not_requested');
  assert.equal(ccq.record_defaults['result.status'], 'needs_clarification');
  assert.equal(ccq.record_defaults.follow_up_owner, 'user');
  assert.ok(ccq.required_fields.includes('resume_token'));
  assert.ok(ccq.required_fields.includes('resume_token_status'));
  assert.ok(ccq.required_fields.includes('resume_token_expires_at'));
  assert.ok(ccq.required_fields.includes('workspace_ref'));

  const clarification = schema.properties.result.properties.clarification;
  assert.ok(clarification.required.includes('resume_token_status'));
  assert.ok(clarification.required.includes('resume_token_expires_at'));
  assert.ok(clarification.required.includes('workspace_ref'));
  assert.deepEqual(clarification.properties.resume_token_status.enum, ['active', 'used', 'expired', 'rejected']);
});

test('generic command-pack fixtures validate without becoming executable integrations', async () => {
  const fixtureDir = path.join(root, 'evals/fixtures/command-packs');
  const fixtureFiles = (await readdir(fixtureDir)).filter((file) => file.endsWith('.json')).sort();
  const routes = await readJson('contracts/routes/route-contracts.json');
  const permissions = await readJson('contracts/permissions/permission-levels.json');

  assert.deepEqual(fixtureFiles, ['generic-approval-blocked.cdeck-pack.json', 'generic-read-draft.cdeck-pack.json']);

  for (const file of fixtureFiles) {
    const pack = await readJson(`evals/fixtures/command-packs/${file}`);
    const errors = validateCommandPack(pack, { routes, permissions });

    assert.deepEqual(errors, [], `${file} should validate`);

    for (const command of pack.commands) {
      assert.notEqual(command.permission_level, 'execute-now');
      assert.ok(command.sources.every((source) => source.startsWith('evals/fixtures/')));
      assert.ok(command.forbidden_effects.includes('execute_now') || command.forbidden_effects.includes('external_call'));
    }
  }
});

test('command routes and permission levels match route contracts', async () => {
  const pack = await readJson('contracts/commands/mvp-commands.cdeck-pack.json');
  const routes = await readJson('contracts/routes/route-contracts.json');
  const routeById = new Map(routes.routes.map((route) => [route.id, route]));

  assert.equal(routes.integration_mode, 'hybrid_local_exact_preview');
  assert.equal(routes.route_family_model.selection_rule, 'route_by_capability_not_product_dependency');
  assert.equal(routes.route_family_model.operator_kit_dependency_rule, 'optional_route_dependency_only');
  assert.equal(routes.route_family_model.custom_pack_rule, 'custom_packs_do_not_imply_operatorkit');
  assert.equal(
    routes.route_family_model.missing_optional_dependency_behavior,
    'blocked_setup_response_no_fallback'
  );
  assert.ok(routes.route_family_model.allowed_route_families.includes('pack.local_read'));
  assert.ok(routes.route_family_model.allowed_route_families.includes('pack.local_write_approved'));
  assert.ok(routes.route_family_model.allowed_route_families.includes('operatorkit.workflow'));

  for (const command of pack.commands) {
    const route = routeById.get(command.route);
    assert.ok(route, `missing route contract for ${command.route}`);
    assert.equal(route.real_integration, false, `${command.route} must not be real integration`);
    assert.ok(
      route.allowed_permission_levels.includes(command.permission_level),
      `${command.command_id} permission must be allowed by ${command.route}`
    );
    assert.ok(
      routes.route_family_model.allowed_route_families.includes(route.route_family),
      `${command.route} must use a known route family`
    );

    if (route.system === 'apprelay') {
      assert.equal(route.route_family, 'apprelay.reasoning');
      assert.equal(route.credit_policy, 'sourcegrid_credits_required_for_real_apprelay_spend');
    } else if (route.system === 'operatorkit') {
      assert.equal(route.route_family, 'operatorkit.workflow');
      assert.equal(route.dependency.required_globally, false);
      assert.equal(route.dependency.missing_behavior, 'blocked_setup_response_no_fallback');
    } else if (route.id.startsWith('local.')) {
      assert.equal(route.credit_policy, 'no_sourcegrid_credits_required');
    }
  }
});

test('local exact read route is the only real integration in the core contract', async () => {
  const routes = await readJson('contracts/routes/route-contracts.json');
  const exactRoute = routes.routes.find((route) => route.id === 'local.exact_read');
  const exactControlRoute = routes.routes.find((route) => route.id === 'local.exact_control');
  const packWriteRoute = routes.routes.find((route) => route.id === 'local.pack_write_approved');

  assert.ok(exactRoute);
  assert.equal(exactRoute.system, 'command-deck');
  assert.equal(exactRoute.route_family, 'core.local');
  assert.equal(exactRoute.real_integration, true);
  assert.equal(exactRoute.execution_boundary, 'allowlisted_local_runner');
  assert.deepEqual(exactRoute.allowed_runner_actions, [
    'repo.status',
    'repo.recent_commits',
    'service.puma_status',
    'service.sidekiq_status'
  ]);

  assert.ok(exactControlRoute);
  assert.equal(exactControlRoute.system, 'command-deck');
  assert.equal(exactControlRoute.route_family, 'core.local');
  assert.equal(exactControlRoute.real_integration, true);
  assert.equal(exactControlRoute.execution_boundary, 'allowlisted_local_runner');
  assert.deepEqual(exactControlRoute.allowed_runner_actions, [
    'workspace.open_sourcegrid_dashboard',
    'workspace.open_commanddeck_repo'
  ]);

  assert.ok(packWriteRoute);
  assert.equal(packWriteRoute.system, 'command-deck');
  assert.equal(packWriteRoute.route_family, 'pack.local_write_approved');
  assert.deepEqual(packWriteRoute.allowed_permission_levels, ['approval-required']);
  assert.equal(packWriteRoute.real_integration, false);
  assert.equal(packWriteRoute.slice_2_behavior, 'blocked_contract_only_pending_pack_write_policy');
  assert.ok(packWriteRoute.forbidden_effects.includes('raw_sql_passthrough'));
  assert.ok(packWriteRoute.forbidden_effects.includes('production_write'));

  for (const route of routes.routes.filter((route) => !['local.exact_read', 'local.exact_control'].includes(route.id))) {
    assert.equal(route.real_integration, false, `${route.id} must remain contract-only`);
  }
});

test('command sources point to local fixtures', async () => {
  const pack = await readJson('contracts/commands/mvp-commands.cdeck-pack.json');

  for (const command of pack.commands) {
    for (const source of command.sources) {
      assert.match(source, /^evals\/fixtures\//);
      await access(path.join(root, source));
    }
  }
});

test('approval-required command is blocked in slice 1', async () => {
  const pack = await readJson('contracts/commands/mvp-commands.cdeck-pack.json');
  const dryRun = pack.commands.find((command) => command.command_id === 'mvp.operatorkit_dry_run');

  assert.ok(dryRun);
  assert.equal(dryRun.permission_level, 'approval-required');
  assert.ok(dryRun.approval_prompt);
  assert.ok(dryRun.allowed_effects.includes('blocked_pending_explicit_approval'));
  assert.ok(dryRun.forbidden_effects.includes('execute_now'));
});

test('eval cases match command contracts and do not claim real execution', async () => {
  const pack = await readJson('contracts/commands/mvp-commands.cdeck-pack.json');
  const suite = await readJson('evals/cases/mvp.slice1.cases.json');
  const commandById = new Map(pack.commands.map((command) => [command.command_id, command]));

  assert.equal(suite.cases.length, 5);

  for (const evalCase of suite.cases) {
    const command = commandById.get(evalCase.command_id);
    assert.ok(command, `missing command for ${evalCase.command_id}`);
    assert.equal(evalCase.expected.permission_level, command.permission_level);
    assert.equal(evalCase.expected.route, command.route);
    assert.notEqual(evalCase.expected.result_status, 'executed');

    const illegalAllowedEffects = command.allowed_effects.filter((effect) => forbiddenEffects.has(effect));
    assert.deepEqual(illegalAllowedEffects, []);

    if (command.permission_level === 'approval-required') {
      assert.equal(evalCase.expected.approval_status, 'blocked_execute_now_disabled');
      assert.equal(evalCase.expected.result_status, 'blocked_contract_only');
    }
  }
});

test('voice adapters are IO surfaces and AppRelay owns reasoning', async () => {
  const contract = await readJson('contracts/routes/voice-adapters.json');

  assert.equal(contract.voice_adapters_are_io_surfaces, true);
  assert.equal(contract.reasoning_owner, 'apprelay');
  assert.equal(contract.command_shell_owner, 'command-deck');
  assert.equal(contract.spoken_command_grammar.default_device_code, 'computer');
  assert.equal(contract.spoken_command_grammar.target_runner_for_default_device_code, 'command');
  assert.deepEqual(contract.spoken_command_grammar.required_slots, ['device_code', 'action', 'object']);
  assert.deepEqual(contract.spoken_command_grammar.optional_slots, ['context', 'end_code']);
  assert.ok(contract.spoken_command_grammar.allowed_end_codes.includes('activate'));
  assert.equal(
    contract.spoken_command_grammar.ccq_rule,
    'missing_required_action_parameters_force_concept_checking_question'
  );

  const adaptersById = new Map(contract.adapters.map((adapter) => [adapter.id, adapter]));
  assert.equal(adaptersById.get('apple_shortcuts').provides_reasoning, false);
  assert.equal(adaptersById.get('apple_shortcuts').requires_apple_intelligence, false);
  assert.equal(adaptersById.get('google_voice').provides_reasoning, false);

  const responseModes = contract.response_modes.map((mode) => mode.id);
  assert.ok(responseModes.includes('platform_tts'));
  assert.ok(responseModes.includes('apprelay_audio'));
});

test('adapter response schema keeps voice adapters as IO surfaces', async () => {
  const schema = await readJson('contracts/routes/adapter-response.schema.json');

  assert.equal(schema.contract_kind, 'adapter-response');
  assert.equal(schema.adapter_role, 'input_output_surface');
  assert.equal(schema.reasoning_owner, 'apprelay');
  assert.equal(schema.apprelay_audio_available, false);
  assert.equal(schema.platform_reasoning_used, false);
  assert.equal(schema.apple_intelligence_required, false);
  assert.equal(schema.google_reasoning_required, false);
  assert.deepEqual(schema.response_modes, ['platform_tts', 'display_text', 'json']);
  assert.equal(schema.clarification_contract, 'contracts/records/concept-checking-question.schema.json');
  assert.equal(schema.clarification_route, 'none');
  assert.equal(schema.clarification_approval_status, 'required_not_requested');
  assert.equal(
    schema.clarification_response_rule,
    'display_and_spoken_text_should_be_the_clarification_question'
  );

  for (const field of ['display_text', 'spoken_text', 'record_ref', 'permission_level', 'approval_status']) {
    assert.ok(schema.required.includes(field));
  }
});

test('adapter response fixtures are safe for Siri spoken output', async () => {
  const nextTask = await readJson('evals/fixtures/adapter_responses/apple_shortcuts.next_task.response.json');
  const blocked = await readJson('evals/fixtures/adapter_responses/apple_shortcuts.operatorkit_blocked.response.json');
  const google = await readJson('evals/fixtures/adapter_responses/google_voice.next_task.response.json');

  assert.equal(nextTask.adapter, 'apple_shortcuts');
  assert.equal(blocked.adapter, 'apple_shortcuts');
  assert.equal(google.adapter, 'google_voice');

  for (const response of [nextTask, blocked, google]) {
    assert.equal(response.response_mode, 'platform_tts');
    assert.equal(response.spoken_text, response.display_text);
    assert.equal(response.apprelay_audio_available, false);
    assert.equal(response.apple_intelligence_required, false);
    assert.equal(response.platform_reasoning_used, false);
    assert.equal(response.google_reasoning_required, false);
  }

  assert.equal(blocked.approval_status, 'blocked_execute_now_disabled');
  assert.match(blocked.spoken_text, /Approval would be required/);
});

test('resolved intent contract keeps routing explicit and target space bounded', async () => {
  const contract = await readJson('contracts/records/resolved-intent.schema.json');

  assert.equal(contract.contract_kind, 'resolved-intent');
  assert.deepEqual(contract.required, [
    'action',
    'target_kind',
    'target_ref',
    'capability_source',
    'route',
    'risk_tier',
    'approval_required'
  ]);
  assert.deepEqual(contract.allowed_capability_sources, ['core', 'pack']);
  assert.deepEqual(contract.allowed_target_kinds, [
    'app',
    'url',
    'dashboard',
    'repo',
    'service',
    'media',
    'device',
    'workflow',
    'data_view',
    'runtime',
    'delegate'
  ]);
  assert.deepEqual(contract.allowed_risk_tiers, [
    'informational',
    'local_control',
    'workspace_mutation',
    'delegated_agentic'
  ]);
  assert.equal(contract.target_ref_rule, 'namespaced_identifier_with_core_pack_or_delegate_prefix');
  assert.equal(contract.route_rule, 'resolved_intent_must_keep_explicit_route_selection');
  assert.equal(contract.approval_rule, 'resolved_intent_never_bypasses_existing_approval_requirements');
});

test('learned memory item contract requires user-confirmed scoped memory only', async () => {
  const contract = await readJson('contracts/records/learned-memory-item.schema.json');

  assert.equal(contract.contract_kind, 'learned-memory-item');
  assert.deepEqual(contract.allowed_memory_kinds, ['resolved_interpretation']);
  assert.deepEqual(contract.allowed_statuses, ['active', 'superseded', 'forgotten']);
  assert.deepEqual(contract.allowed_scope_kinds, ['workspace', 'surface_workspace']);
  assert.deepEqual(contract.allowed_match_kinds, ['exact_phrase', 'normalized_phrase', 'alias']);
  assert.deepEqual(contract.allowed_resolution_sources, [
    'fast_lane',
    'capable_lane',
    'human_clarification'
  ]);
  assert.deepEqual(contract.allowed_confirmation_sources, ['explicit_user_confirmation']);
  assert.equal(contract.persistence_rule, 'memory_items_exist_only_after_explicit_user_confirmation');
  assert.equal(contract.runtime_read_rule, 'only_active_memory_items_may_be_used_at_runtime');
  assert.equal(contract.scope_rule, 'workspace_scope_lives_on_memory_metadata_not_inside_resolved_intent');
  assert.equal(contract.active_uniqueness_rule, 'at_most_one_active_memory_item_per_scope_and_match');
  assert.equal(contract.supersede_rule, 'replacement_creates_new_active_item_and_marks_prior_item_superseded');
  assert.equal(contract.conflict_rule, 'unresolved_active_conflicts_force_checking_question');
  assert.equal(contract.alias_rule, 'aliases_resolve_targets_not_hidden_actions_in_v1');
  assert.equal(contract.normalized_phrase_contract, 'contracts/records/normalized-phrase.schema.json');
  assert.equal(
    contract.normalized_phrase_rule,
    'lowercase_deterministic_transcript_cleanup_only_no_semantic_matching'
  );

  const nestedIntent = contract.properties.resolved_intent;
  assert.deepEqual(nestedIntent.required, [
    'action',
    'target_kind',
    'target_ref',
    'capability_source',
    'route',
    'risk_tier',
    'approval_required'
  ]);
});

test('normalized phrase contract forbids semantic memory matching', async () => {
  const contract = await readJson('contracts/records/normalized-phrase.schema.json');

  assert.equal(contract.contract_kind, 'normalized-phrase');
  assert.equal(contract.output_rule, 'stored_and_compared_as_lowercase_text');
  assert.ok(contract.allowed_transforms.includes('lowercase'));
  assert.ok(contract.allowed_transforms.includes('remove_punctuation'));
  assert.ok(contract.allowed_transforms.includes('remove_speech_fillers_uh_um'));

  for (const forbidden of [
    'synonym_matching',
    'semantic_similarity',
    'embedding_similarity',
    'llm_paraphrase_matching',
    'action_verb_rewrite',
    'target_word_removal',
    'risk_word_removal',
    'timing_word_removal',
    'environment_word_removal',
    'article_removal'
  ]) {
    assert.ok(contract.forbidden_transforms.includes(forbidden), `${forbidden} must be forbidden`);
  }

  assert.deepEqual(contract.non_equivalent_examples[0], ['start puma', 'restart puma']);
  assert.deepEqual(contract.non_equivalent_examples[1], ['open dashboard', 'open billing dashboard']);
});
