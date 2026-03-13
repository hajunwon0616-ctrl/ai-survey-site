## Autonomous Agent Layer

These modules are the v1 scaffold for the autonomous improvement layer that sits on top of the existing survey pipeline.

- `curator.js`: question proposal generation
- `scoring-auditor.js`: scoring-rule proposal generation
- `simulator.js`: candidate evaluation against baseline
- `deployer.js`: promote/reject/rollback decision logging
- `trend-analyst.js`: long-term drift and trend summaries
- `meta-evaluator.js`: agent strategy outcome evaluation
- `strategy-manager.js`: strategy evolution experiments

They are intentionally decoupled from the user-facing runtime so the current submission and report flow remains stable.
