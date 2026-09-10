#![cfg(test)]

//! Test suite entry point. Split by the same domains as `src/`, one
//! submodule per module under test, plus `common` for shared fixtures
//! (`create_test_token`, `test_event_id`, `force_event_state`).
//!
//! `rewards` and `event_emission` split the "does it emit the right
//! event" tests differently from the source split: reward/compensation
//! event-emission tests live in `rewards.rs` next to the functions that
//! emit them, while `event_emission.rs` covers the lifecycle/governance
//! events (`EventCreated`, `ContractPaused`, etc.).

mod common;
mod emergency_withdraw;
mod event_emission;
mod governance;
mod lifecycle;
mod rewards;
mod wallet;
