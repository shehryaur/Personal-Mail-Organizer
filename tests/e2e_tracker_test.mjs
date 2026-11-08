#!/usr/bin/env node

/**
 * ============================================================================
 * E2E TEST RUNNER & SUITE ORCHESTRATOR
 * Personal Mail Organizer - Palantir Blueprint Redesign
 *
 * Covers:
 * - Tier 1: Isolated Feature Coverage (96 tests, >=5 per feature across 19 features)
 * - Tier 2: Boundary & Corner Cases (95 tests, >=5 per feature across 19 features)
 * - Tier 3: Cross-Feature Combinations & Pairwise Interactions (20 tests)
 * - Tier 4: Real-World End-to-End Application Workloads (15 tests)
 *
 * Execution:
 *   node --test tests/e2e_tracker_test.mjs
 *   node tests/e2e_tracker_test.mjs
 * ============================================================================
 */

import './e2e/tier1_features.test.mjs';
import './e2e/tier2_boundaries.test.mjs';
import './e2e/tier3_combinations.test.mjs';
import './e2e/tier4_workloads.test.mjs';
