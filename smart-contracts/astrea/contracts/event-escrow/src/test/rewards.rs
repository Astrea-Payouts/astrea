//! Tests for `rewards.rs`: release_reward and release_compensation,
//! including their own emitted-event assertions.

use super::common::*;
use crate::*;
use soroban_sdk::testutils::{Address as _, Events as _};
use soroban_sdk::{Address, Env, Event as _};

#[test]
fn test_release_compensation_pays_participants_from_admin_wallet() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    let token_admin = Address::generate(&env);

    let (token_address, token_client, asset_client) = create_test_token(&env, &token_admin);

    let participant_1 = Address::generate(&env);

    let participant_2 = Address::generate(&env);

    asset_client.mint(&admin, &1_000);

    client.deposit_funds(&admin, &token_address, &1_000);

    let event_id = test_event_id(&env, 1);

    client.create_event(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &500,
        &event_id);

    client.set_event_cancelled(&admin, &event_id);

    assert_eq!(client.get_balance(&admin), 1_000);

    let participants = soroban_sdk::vec![
        &env,
        Participants {
            address: participant_1.clone(),

            amount_compensation: 300,
        },
        Participants {
            address: participant_2.clone(),

            amount_compensation: 200,
        },
    ];

    client.release_compensation(&admin, &event_id, &participants);

    assert_eq!(token_client.balance(&participant_1), 300);

    assert_eq!(token_client.balance(&participant_2), 200);

    assert_eq!(client.get_balance(&admin), 500);
}

#[test]
fn test_release_compensation_allows_amount_different_from_original_reward() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    let token_admin = Address::generate(&env);

    let (token_address, token_client, asset_client) = create_test_token(&env, &token_admin);

    let participant = Address::generate(&env);

    asset_client.mint(&admin, &2_000);

    client.deposit_funds(&admin, &token_address, &2_000);

    let event_id = test_event_id(&env, 1);

    client.create_event(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &300,
        &event_id);

    client.set_event_cancelled(&admin, &event_id);

    let participants = soroban_sdk::vec![
        &env,
        Participants {
            address: participant.clone(),

            amount_compensation: 700,
        },
    ];

    client.release_compensation(&admin, &event_id, &participants);

    assert_eq!(token_client.balance(&participant), 700);

    assert_eq!(client.get_balance(&admin), 2_000 - 700);
}

#[test]
#[should_panic(expected = "Event is not cancelled")]
fn test_release_compensation_rejects_event_not_cancelled() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());

    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    let token_admin = Address::generate(&env);

    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    let participant = Address::generate(&env);

    asset_client.mint(&admin, &1_000);

    client.deposit_funds(&admin, &token_address, &1_000);

    let event_id = test_event_id(&env, 1);

    client.create_event(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &500,
        &event_id);

    let participants = soroban_sdk::vec![
        &env,
        Participants {
            address: participant,
            amount_compensation: 200,
        },
    ];

    client.release_compensation(&admin, &event_id, &participants);
}

#[test]
#[should_panic(expected = "Only admin can release the compensation")]
fn test_release_compensation_rejects_wrong_admin() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let impostor_admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    let participant = Address::generate(&env);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &500,
        &event_id);
    client.set_event_cancelled(&admin, &event_id);

    let participants = soroban_sdk::vec![
        &env,
        Participants {
            address: participant,
            amount_compensation: 200,
        },
    ];

    client.release_compensation(&impostor_admin, &event_id, &participants);
}

#[test]
#[should_panic(expected = "No participants provided")]
fn test_release_compensation_rejects_empty_participants() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    asset_client.mint(&admin, &1_000);

    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &500,
        &event_id);
    client.set_event_cancelled(&admin, &event_id);
    let participants: Vec<Participants> = soroban_sdk::vec![&env];
    client.release_compensation(&admin, &event_id, &participants);
}

#[test]
#[should_panic(expected = "Compensation must be greater than zero")]
fn test_release_compensation_rejects_zero_amount_participant() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    let participant = Address::generate(&env);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &500,
        &event_id);
    client.set_event_cancelled(&admin, &event_id);

    let participants = soroban_sdk::vec![
        &env,
        Participants {
            address: participant,
            amount_compensation: 0,
        },
    ];

    client.release_compensation(&admin, &event_id, &participants);
}

#[test]
#[should_panic(expected = "Compensation must be greater than zero")]
fn test_release_compensation_rejects_negative_amount_participant() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    let participant_ok = Address::generate(&env);
    let participant_bad = Address::generate(&env);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &500,
        &event_id);
    client.set_event_cancelled(&admin, &event_id);

    let participants = soroban_sdk::vec![
        &env,
        Participants {
            address: participant_ok,
            amount_compensation: 300,
        },
        Participants {
            address: participant_bad,
            amount_compensation: -50,
        },
    ];

    client.release_compensation(&admin, &event_id, &participants);
}

#[test]
#[should_panic(expected = "Insufficient wallet balance to cover compensation")]
fn test_release_compensation_rejects_total_over_wallet_balance() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    let participant = Address::generate(&env);

    asset_client.mint(&admin, &500);
    client.deposit_funds(&admin, &token_address, &500);
    let event_id = test_event_id(&env, 1);

    client.create_event(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &300,
        &event_id);
    client.set_event_cancelled(&admin, &event_id);

    let participants = soroban_sdk::vec![
        &env,
        Participants {
            address: participant,
            amount_compensation: 600,
        },
    ];

    client.release_compensation(&admin, &event_id, &participants);
}

#[test]
#[should_panic(expected = "Event does not exist")]
fn test_release_compensation_rejects_nonexistent_event() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let participant = Address::generate(&env);
    let event_id = test_event_id(&env, 99);
    let participants = soroban_sdk::vec![
        &env,
        Participants {
            address: participant,
            amount_compensation: 200,
        },
    ];

    client.release_compensation(&admin, &event_id, &participants);
}

#[test]
#[should_panic(expected = "Event is not cancelled")]
fn test_release_compensation_rejects_double_release() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    let participant = Address::generate(&env);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &500,
        &event_id);
    client.set_event_cancelled(&admin, &event_id);

    let participants = soroban_sdk::vec![
        &env,
        Participants {
            address: participant,
            amount_compensation: 200,
        },
    ];

    client.release_compensation(&admin, &event_id, &participants);
    client.release_compensation(&admin, &event_id, &participants);
}

#[test]
fn test_release_reward_distributes_to_winners_and_ends_event() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, token_client, asset_client) = create_test_token(&env, &token_admin);
    let first_place = Address::generate(&env);
    let second_place = Address::generate(&env);
    let third_place = Address::generate(&env);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &judge,
        &Some(Address::generate(&env)),
        &token_address,
        &600,
        &event_id);
    force_event_state(&env, &contract_id, event_id.clone(), EventState::InProgress);

    let winners = soroban_sdk::vec![
        &env,
        Winner {
            place: 1,
            amount: 300,
            address: first_place.clone()
        },
        Winner {
            place: 2,
            amount: 200,
            address: second_place.clone()
        },
        Winner {
            place: 3,
            amount: 100,
            address: third_place.clone()
        },
    ];

    client.release_reward(&judge, &event_id, &winners);

    assert_eq!(token_client.balance(&first_place), 300);
    assert_eq!(token_client.balance(&second_place), 200);
    assert_eq!(token_client.balance(&third_place), 100);
}

#[test]
#[should_panic(expected = "Winner amount must be greater than zero")]
fn test_release_reward_rejects_zero_amount_winner() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    let winner_address = Address::generate(&env);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &judge,
        &Some(Address::generate(&env)),
        &token_address,
        &500,
        &event_id);
    force_event_state(&env, &contract_id, event_id.clone(), EventState::InProgress);

    let winners = soroban_sdk::vec![
        &env,
        Winner {
            place: 1,
            amount: 0,
            address: winner_address
        },
    ];

    client.release_reward(&judge, &event_id, &winners);
}

#[test]
#[should_panic(expected = "Winner amount must be greater than zero")]
fn test_release_reward_rejects_negative_amount_winner_even_if_sum_matches() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    let winner_ok = Address::generate(&env);
    let winner_bad = Address::generate(&env);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &judge,
        &Some(Address::generate(&env)),
        &token_address,
        &500,
        &event_id);
    force_event_state(&env, &contract_id, event_id.clone(), EventState::InProgress);

    let winners = soroban_sdk::vec![
        &env,
        Winner {
            place: 1,
            amount: 600,
            address: winner_ok
        },
        Winner {
            place: 2,
            amount: -100,
            address: winner_bad
        },
    ];

    client.release_reward(&judge, &event_id, &winners);
}

#[test]
#[should_panic(expected = "Too many winners in a single release")]
fn test_release_reward_rejects_too_many_winners() {
    // K06 (spikes/k06-multi-release-budget) validated 25 winners as safe
    // within Stellar Mainnet's instruction budget; this proves the
    // contract enforces that bound on-chain rather than trusting the
    // off-chain caller not to exceed it.
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &judge,
        &Some(Address::generate(&env)),
        &token_address,
        &500,
        &event_id);
    force_event_state(&env, &contract_id, event_id.clone(), EventState::InProgress);

    let mut winners: Vec<Winner> = Vec::new(&env);
    for i in 0..26u32 {
        winners.push_back(Winner {
            place: i + 1,
            amount: 1,
            address: Address::generate(&env),
        });
    }

    client.release_reward(&judge, &event_id, &winners);
}

#[test]
#[should_panic(expected = "Only the event's judge can release rewards")]
fn test_release_reward_rejects_non_owner_admin() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let impostor_judge = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    let winner_address = Address::generate(&env);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &judge,
        &Some(Address::generate(&env)),
        &token_address,
        &500,
        &event_id);
    force_event_state(&env, &contract_id, event_id.clone(), EventState::InProgress);

    let winners = soroban_sdk::vec![
        &env,
        Winner {
            place: 1,

            amount: 500,

            address: winner_address
        },
    ];

    client.release_reward(&impostor_judge, &event_id, &winners);
}

#[test]
#[should_panic(expected = "Only the event's judge can release rewards")]
fn test_release_reward_rejects_the_organizer_itself() {
    // ADR-003: the organizer is never in the payout path. Creating and
    // funding an event does not grant the organizer any ability to release
    // its reward — only the separately-designated judge can.
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    let winner_address = Address::generate(&env);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &judge,
        &Some(Address::generate(&env)),
        &token_address,
        &500,
        &event_id);
    force_event_state(&env, &contract_id, event_id.clone(), EventState::InProgress);

    let winners = soroban_sdk::vec![
        &env,
        Winner {
            place: 1,

            amount: 500,

            address: winner_address
        },
    ];

    client.release_reward(&admin, &event_id, &winners);
}

#[test]
#[should_panic(expected = "Event is not ready to release rewards")]
fn test_release_reward_rejects_event_not_in_progress() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    let winner_address = Address::generate(&env);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &judge,
        &Some(Address::generate(&env)),
        &token_address,
        &500,
        &event_id);

    let winners = soroban_sdk::vec![
        &env,
        Winner {
            place: 1,

            amount: 500,

            address: winner_address
        },
    ];

    client.release_reward(&judge, &event_id, &winners);
}

#[test]
#[should_panic(expected = "Event is not ready to release rewards")]
fn test_release_reward_rejects_double_release() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    let winner_address = Address::generate(&env);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &judge,
        &Some(Address::generate(&env)),
        &token_address,
        &500,
        &event_id);
    force_event_state(&env, &contract_id, event_id.clone(), EventState::InProgress);

    let winners = soroban_sdk::vec![
        &env,
        Winner {
            place: 1,

            amount: 500,

            address: winner_address
        },
    ];

    client.release_reward(&judge, &event_id, &winners);
    client.release_reward(&judge, &event_id, &winners);
}

#[test]
#[should_panic(expected = "Event does not exist")]
fn test_release_reward_rejects_nonexistent_event() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let winner_address = Address::generate(&env);
    let event_id = test_event_id(&env, 99);

    let winners = soroban_sdk::vec![
        &env,
        Winner {
            place: 1,

            amount: 100,

            address: winner_address
        },
    ];

    client.release_reward(&admin, &event_id, &winners);
}

#[test]
#[should_panic(expected = "Distributed amount does not match the locked reward")]
fn test_release_reward_rejects_mismatched_total() {
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    let winner_address = Address::generate(&env);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &judge,
        &Some(Address::generate(&env)),
        &token_address,
        &500,
        &event_id);
    force_event_state(&env, &contract_id, event_id.clone(), EventState::InProgress);

    let winners = soroban_sdk::vec![
        &env,
        Winner {
            place: 1,

            amount: 300,

            address: winner_address
        },
    ];

    client.release_reward(&judge, &event_id, &winners);
}

#[test]
fn test_release_reward_reverts_atomically_on_invalid_winner() {
    // Proves release_reward is all-or-nothing: with a valid winner ahead of
    // an invalid one in the vec, a naive per-winner "validate then pay"
    // implementation would already have paid the valid winner before
    // rejecting the invalid one. This asserts nothing was paid at all.
    let env = Env::default();

    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, token_client, asset_client) = create_test_token(&env, &token_admin);
    let first_place = Address::generate(&env);
    let second_place = Address::generate(&env);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &1_000);
    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &judge,
        &Some(Address::generate(&env)),
        &token_address,
        &500,
        &event_id);
    force_event_state(&env, &contract_id, event_id.clone(), EventState::InProgress);

    let winners = soroban_sdk::vec![
        &env,
        Winner {
            place: 1,
            amount: 300,
            address: first_place.clone()
        },
        Winner {
            place: 2,
            amount: 0,
            address: second_place.clone()
        },
    ];

    let result = client.try_release_reward(&judge, &event_id, &winners);
    assert!(result.is_err());

    assert_eq!(token_client.balance(&first_place), 0);
    assert_eq!(token_client.balance(&second_place), 0);
    assert_eq!(token_client.balance(&contract_id), 1_000);
    assert_eq!(client.get_balance(&admin), 500);
    assert_eq!(client.get_event(&event_id).state, EventState::InProgress);
}

#[test]
fn test_compensation_released_event_is_emitted() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    let participant = Address::generate(&env);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &500);

    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &Address::generate(&env),
        &Some(Address::generate(&env)),
        &token_address,
        &300,
        &event_id);
    client.set_event_cancelled(&admin, &event_id);

    let participants = soroban_sdk::vec![
        &env,
        Participants {
            address: participant,
            amount_compensation: 200,
        },
    ];

    client.release_compensation(&admin, &event_id, &participants);

    assert_eq!(
        env.events().all().filter_by_contract(&contract_id),
        [CompensationReleased {
            event_id: event_id.clone(),
            admin: admin.clone(),
            total: 200,
        }
        .to_xdr(&env, &contract_id)],
    );
}

#[test]
fn test_reward_released_event_is_emitted() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(EventEscrow, ());
    let client = EventEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let judge = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let (token_address, _token_client, asset_client) = create_test_token(&env, &token_admin);
    let winner = Address::generate(&env);

    asset_client.mint(&admin, &1_000);
    client.deposit_funds(&admin, &token_address, &500);

    let event_id = test_event_id(&env, 1);
    client.create_event(
        &admin,
        &judge,
        &Some(Address::generate(&env)),
        &token_address,
        &300,
        &event_id);
    client.set_event_in_progress(&admin, &event_id);

    let winners = soroban_sdk::vec![
        &env,
        Winner {
            place: 1,
            amount: 300,
            address: winner,
        },
    ];

    client.release_reward(&judge, &event_id, &winners);

    assert_eq!(
        env.events().all().filter_by_contract(&contract_id),
        [RewardReleased {
            event_id: event_id.clone(),
            admin: admin.clone(),
            total_distributed: 300,
        }
        .to_xdr(&env, &contract_id)],
    );
}
