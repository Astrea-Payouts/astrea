// Command escrow-testnet-proof is a manual, network-touching harness that
// proves internal/escrow against a real, freshly deployed event-escrow
// contract on Stellar testnet. Point it at a contract via ESCROW_CONTRACT_ID
// (see internal/config) -- it no longer hardcodes one, since E01d's new
// calls (resolve_dispute, emergency_withdraw, the go-live transitions) need
// a contract built from current develop (PR #178's resolver param, PR #179's
// go-live fee), which the project's old testnet deployment predates.
//
// E01a/E01b (scenario A): deposit_funds/create_event/get_balance/get_event.
//
// E01c (scenarios B-D) exercises the four lifecycle-ending calls in
// lifecycle.go:
//
//   - B is driven to InProgress and closed with release_reward, paid out to
//     a 3-member team via escrow.AllocateWinners with an uneven 3333/3333/
//     3334 bp split on an amount not divisible by 3 -- so the schema's
//     remainder rule (lowest Ordinal gets the leftover unit) is exercised
//     on a real ledger, not just in a unit test.
//   - C is cancelled with set_event_cancelled while still Created
//     (pre-launch) -- the successful-cancellation proof.
//   - D is driven to InProgress and then also has set_event_cancelled
//     attempted on it -- proving, against the contract itself rather than
//     client-side, that InProgress rejects cancellation (ADR-006).
//
// E01d (scenarios E-G) exercises resolve_dispute and the two-signature
// emergency_withdraw:
//
//   - E is driven to InProgress with a judging_deadline ~45s out. The judge
//     is proven unable to call resolve_dispute (only the resolver may), the
//     harness then waits for the deadline to pass, and the resolver settles
//     the dispute by paying a team member AND the organizer's own address
//     in one call -- proving the "cancel-after-launch" pattern rewards.rs
//     documents (there is no separate refund path for it).
//   - F drives the full two-signature emergency_withdraw happy path: admin
//     is the transaction's source, the resolver signs its pending
//     SOROBAN_CREDENTIALS_ADDRESS auth entry client-side via SignAuthEntry
//     (the resolver's key never enters this service -- README, S04), the
//     entry is folded back in with AttachSignedAuth, admin signs the
//     envelope, and the result is submitted. escrow.GetBalance confirms the
//     organizer's AdminWallet.balance rose by the withdrawn amount.
//   - G builds the identical call but submits with only admin's envelope
//     signature and no resolver auth at all -- proving the network/host,
//     not just this service's own validation, rejects a single-signature
//     emergency_withdraw.
//
// This is deliberately a `main`, not a `go test`: it hits friendbot and a
// real RPC endpoint, so its success depends on external services being up,
// which would make `go test ./...` (run unconditionally in CI) flaky. Run
// it explicitly:
//
//	ESCROW_CONTRACT_ID=<C...> go run ./cmd/escrow-testnet-proof
package main

import (
	"context"
	"fmt"
	"log"
	"math"
	"os"
	"strconv"
	"time"

	"github.com/stellar/go/clients/horizonclient"
	rpcclient "github.com/stellar/go/clients/rpcclient"
	"github.com/stellar/go/keypair"
	"github.com/stellar/go/strkey"
	"github.com/stellar/go/txnbuild"
	"github.com/stellar/go/xdr"

	"github.com/Astrea-Payouts/astrea/services/core-go/internal/config"
	"github.com/Astrea-Payouts/astrea/services/core-go/internal/escrow"
)

const (
	// Deposited once, up front, with generous headroom over every event's
	// reward plus every go-live fee this run pays (default fee_bps is 50 =
	// 0.5%, so even the sum of B/D/E's rewards costs well under 1 XLM in
	// fees) -- simpler than sizing the deposit to the exact total, and this
	// harness's own friendbot-funded admin account has no other use for the
	// XLM.
	depositAmount = int64(200_000_000)

	eventRewardA = int64(4_000_000)
	// Deliberately not a multiple of 3, so a 3333/3333/3334 bp split leaves
	// a real 1-stroop remainder for the lowest-Ordinal member to absorb.
	teamRewardB             = int64(10_000_001)
	cancelledEventRewardC   = int64(5_000_000)
	inProgressRejectRewardD = int64(5_000_000)
	// Split between a team member and the organizer's own address, proving
	// resolve_dispute's "cancel-after-launch" pattern (rewards.rs).
	disputeRewardE           = int64(6_000_000)
	disputeMemberShareE      = int64(4_000_000)
	disputeAdminShareE       = disputeRewardE - disputeMemberShareE
	eventRewardF             = int64(3_000_000)
	emergencyWithdrawAmountF = int64(2_000_000)
	eventRewardG             = int64(3_000_000)
	emergencyWithdrawAmountG = int64(2_000_000)

	// How far past "now" E's judging_deadline is set -- short enough that
	// this harness can just wait it out, long enough that the harness's own
	// setup (create_event, two state transitions) reliably finishes first.
	judgingDeadlineOffset = 45 * time.Second
	// B and D never wait for their own judging_deadline (release_reward and
	// the cancel-rejection proof don't check it), so any future timestamp
	// legalizes set_event_in_progress for them.
	farJudgingDeadlineOffset = 1 * time.Hour
)

func main() {
	ctx := context.Background()

	cfg, err := config.Load(os.Getenv)
	if err != nil {
		log.Fatalf("loading config: %v", err)
	}
	fmt.Println("network:", cfg.Network)
	fmt.Println("contract:", cfg.EscrowContractID)

	rpc := rpcclient.NewClient(cfg.SorobanRPCURL, nil)
	horizon := horizonclient.DefaultTestNetClient

	contractAddr, err := escrow.ContractAddress(cfg.EscrowContractID)
	if err != nil {
		log.Fatalf("decoding event-escrow contract address: %v", err)
	}

	admin := mustRandomKeypair()
	fmt.Println("admin:", admin.Address())
	if _, err := horizon.Fund(admin.Address()); err != nil {
		log.Fatalf("funding admin via friendbot: %v", err)
	}

	judge := mustRandomKeypair()
	fmt.Println("judge:", judge.Address())
	if _, err := horizon.Fund(judge.Address()); err != nil {
		log.Fatalf("funding judge via friendbot: %v", err)
	}

	// The resolver named explicitly on every event this harness creates
	// (see CreateEventHostFunction's resolver param, PR #178). Its key
	// never leaves this harness process -- in production it never enters
	// the service at all (README, S04); SignAuthEntry below stands in for
	// what would otherwise be a resolver's own wallet signing client-side.
	resolver := mustRandomKeypair()
	fmt.Println("resolver:", resolver.Address())
	if _, err := horizon.Fund(resolver.Address()); err != nil {
		log.Fatalf("funding resolver via friendbot: %v", err)
	}

	teamMember1, teamMember2, teamMember3 := mustRandomKeypair(), mustRandomKeypair(), mustRandomKeypair()
	for _, member := range []*keypair.Full{teamMember1, teamMember2, teamMember3} {
		if _, err := horizon.Fund(member.Address()); err != nil {
			log.Fatalf("funding team member %s via friendbot: %v", member.Address(), err)
		}
	}
	fmt.Println("team member 1 (ordinal 0, 3333 bp):", teamMember1.Address())
	fmt.Println("team member 2 (ordinal 1, 3333 bp):", teamMember2.Address())
	fmt.Println("team member 3 (ordinal 2, 3334 bp):", teamMember3.Address())

	token, err := nativeAssetContractID(cfg.NetworkPassphrase)
	if err != nil {
		log.Fatalf("deriving native XLM SAC contract id: %v", err)
	}
	fmt.Println("token:", token)

	fmt.Println("\n[deposit_funds] admin deposits", depositAmount, "stroops -- via escrow.Submit")
	depositHF, err := escrow.DepositFundsHostFunction(contractAddr, admin.Address(), token, depositAmount)
	if err != nil {
		log.Fatalf("building deposit_funds host function: %v", err)
	}
	depositResult, err := escrow.Submit(ctx, rpc, admin, cfg.NetworkPassphrase, depositHF, escrow.Config{})
	if err != nil {
		log.Fatalf("deposit_funds failed: %v", err)
	}
	fmt.Println("  tx hash:", depositResult.Hash)

	balanceAfterDeposit, err := escrow.GetBalance(ctx, rpc, contractAddr, admin.Address(), escrow.Config{})
	if err != nil {
		log.Fatalf("get_balance failed: %v", err)
	}
	fmt.Printf("  balance: %d stroops (want %d)\n", balanceAfterDeposit, depositAmount)
	if balanceAfterDeposit != depositAmount {
		log.Fatalf("balance mismatch after deposit: got %d, want %d", balanceAfterDeposit, depositAmount)
	}

	// --- Scenario A: create_event, get_balance, get_event (E01a/E01b) ------

	eventIDA := mustNewEventID()
	fmt.Println("\n[A] create_event(admin, judge, resolver, token, reward, event_id) -- via escrow.BuildCreateEvent + escrow.SubmitSigned")
	fmt.Println("  event_id:", eventIDA)
	unsignedA, err := escrow.BuildCreateEvent(ctx, rpc, contractAddr, admin.Address(), judge.Address(), resolver.Address(), token, eventRewardA, eventIDA, escrow.Config{})
	if err != nil {
		log.Fatalf("building create_event(A) transaction: %v", err)
	}
	signedAXDR, err := signTransaction(unsignedA.XDR, admin, cfg.NetworkPassphrase)
	if err != nil {
		log.Fatalf("signing create_event(A) transaction: %v", err)
	}
	createAResult, err := escrow.SubmitSigned(ctx, rpc, signedAXDR, escrow.Config{})
	if err != nil {
		log.Fatalf("submitting signed create_event(A) transaction: %v", err)
	}
	fmt.Println("  tx hash:", createAResult.Hash)

	balanceAfterCreateA, err := escrow.GetBalance(ctx, rpc, contractAddr, admin.Address(), escrow.Config{})
	if err != nil {
		log.Fatalf("get_balance failed: %v", err)
	}
	wantBalanceAfterA := depositAmount - eventRewardA
	fmt.Printf("  balance: %d stroops (want %d)\n", balanceAfterCreateA, wantBalanceAfterA)
	if balanceAfterCreateA != wantBalanceAfterA {
		log.Fatalf("balance mismatch after create_event(A): got %d, want %d", balanceAfterCreateA, wantBalanceAfterA)
	}

	fmt.Println("  get_event(A) -- read-only, via escrow.Submit purely as a transaction envelope (no auth required)")
	getEventHF := invokeContractHF(contractAddr, "get_event", eventIDArg(eventIDA))
	getEventResult, err := escrow.Submit(ctx, rpc, admin, cfg.NetworkPassphrase, getEventHF, escrow.Config{})
	if err != nil {
		log.Fatalf("get_event failed: %v", err)
	}
	fmt.Println("  tx hash:", getEventResult.Hash)

	judgeField, ok := mapField(getEventResult.ReturnValue, "judge")
	if !ok || judgeField.Address == nil {
		log.Fatalf("event has no judge field, got %+v", getEventResult.ReturnValue)
	}
	gotJudge, err := judgeField.Address.String()
	if err != nil {
		log.Fatalf("decoding judge address from event: %v", err)
	}
	fmt.Println("  judge:", gotJudge, "(want", judge.Address()+")")
	if gotJudge != judge.Address() {
		log.Fatalf("event judge mismatch: got %s, want %s", gotJudge, judge.Address())
	}

	resolverField, ok := mapField(getEventResult.ReturnValue, "resolver")
	if !ok || resolverField.Address == nil {
		log.Fatalf("event has no resolver field, got %+v", getEventResult.ReturnValue)
	}
	gotResolver, err := resolverField.Address.String()
	if err != nil {
		log.Fatalf("decoding resolver address from event: %v", err)
	}
	fmt.Println("  resolver:", gotResolver, "(want", resolver.Address()+")")
	if gotResolver != resolver.Address() {
		log.Fatalf("event resolver mismatch: got %s, want %s", gotResolver, resolver.Address())
	}

	rewardField, ok := mapField(getEventResult.ReturnValue, "reward")
	if !ok {
		log.Fatalf("event has no reward field, got %+v", getEventResult.ReturnValue)
	}
	gotReward, err := escrow.DecodeI128ToInt64(rewardField)
	if err != nil {
		log.Fatalf("decoding reward from event: %v", err)
	}
	fmt.Printf("  reward: %d stroops (want %d)\n", gotReward, eventRewardA)
	if gotReward != eventRewardA {
		log.Fatalf("event reward mismatch: got %d, want %d", gotReward, eventRewardA)
	}

	// --- Scenario B: release_reward, to a team, with a real remainder ------

	eventIDB := mustNewEventID()
	fmt.Println("\n[B] create_event + set_event_waiting_for_start + set_event_in_progress -- driving B to InProgress so release_reward is legal")
	fmt.Println("  event_id:", eventIDB)
	mustCreateEvent(ctx, rpc, contractAddr, admin, judge, resolver, token, teamRewardB, eventIDB, cfg)
	mustGoLive(ctx, rpc, contractAddr, admin, eventIDB, farJudgingDeadlineOffset, cfg, "B")

	fmt.Println("[B] release_reward(judge, event_id, winners) -- AllocateWinners splits 3333/3333/3334 bp of a reward not divisible by 3, so the remainder rule fires for real")
	positions := []escrow.Position{{Place: 1, Amount: teamRewardB}}
	teams := []escrow.WinningTeam{{
		Place: 1,
		Members: []escrow.Member{
			{Address: teamMember1.Address(), Ordinal: 0, ShareBasisPoints: 3333},
			{Address: teamMember2.Address(), Ordinal: 1, ShareBasisPoints: 3333},
			{Address: teamMember3.Address(), Ordinal: 2, ShareBasisPoints: 3334},
		},
	}}
	winnersB, err := escrow.AllocateWinners(teamRewardB, positions, teams)
	if err != nil {
		log.Fatalf("AllocateWinners failed: %v", err)
	}
	for _, w := range winnersB {
		fmt.Printf("  allocated: %s -> %d stroops (place %d)\n", w.Address, w.Amount, w.Place)
	}

	balancesBeforeB := map[string]int64{}
	for _, member := range []*keypair.Full{teamMember1, teamMember2, teamMember3} {
		bal, err := nativeBalanceStroops(horizon, member.Address())
		if err != nil {
			log.Fatalf("reading pre-release balance for %s: %v", member.Address(), err)
		}
		balancesBeforeB[member.Address()] = bal
	}

	unsignedRelease, err := escrow.BuildReleaseReward(ctx, rpc, contractAddr, judge.Address(), eventIDB, winnersB, escrow.Config{})
	if err != nil {
		log.Fatalf("building release_reward transaction: %v", err)
	}
	signedReleaseXDR, err := signTransaction(unsignedRelease.XDR, judge, cfg.NetworkPassphrase)
	if err != nil {
		log.Fatalf("signing release_reward transaction: %v", err)
	}
	releaseResult, err := escrow.SubmitSigned(ctx, rpc, signedReleaseXDR, escrow.Config{})
	if err != nil {
		log.Fatalf("submitting signed release_reward transaction: %v", err)
	}
	fmt.Println("  release_reward tx hash:", releaseResult.Hash)

	fmt.Println("  on-chain transfer amounts (post-release balance delta):")
	var totalTransferredB int64
	for _, w := range winnersB {
		after, err := nativeBalanceStroops(horizon, w.Address)
		if err != nil {
			log.Fatalf("reading post-release balance for %s: %v", w.Address, err)
		}
		delta := after - balancesBeforeB[w.Address]
		fmt.Printf("    %s: +%d stroops (want %d)\n", w.Address, delta, w.Amount)
		if delta != w.Amount {
			log.Fatalf("transfer amount mismatch for %s: got %d, want %d", w.Address, delta, w.Amount)
		}
		totalTransferredB += delta
	}
	if totalTransferredB != teamRewardB {
		log.Fatalf("total transferred %d does not match event reward %d", totalTransferredB, teamRewardB)
	}

	// --- Scenario C: a successful pre-launch cancellation -------------------

	eventIDC := mustNewEventID()
	fmt.Println("\n[C] create_event + set_event_cancelled -- pre-launch (Created state) cancel-and-refund")
	fmt.Println("  event_id:", eventIDC)
	mustCreateEvent(ctx, rpc, contractAddr, admin, judge, resolver, token, cancelledEventRewardC, eventIDC, cfg)

	balanceBeforeCancelC, err := escrow.GetBalance(ctx, rpc, contractAddr, admin.Address(), escrow.Config{})
	if err != nil {
		log.Fatalf("get_balance before cancel(C) failed: %v", err)
	}

	cancelCHF, err := escrow.SetEventCancelledHostFunction(contractAddr, admin.Address(), eventIDC)
	if err != nil {
		log.Fatalf("building set_event_cancelled(C) host function: %v", err)
	}
	cancelCResult, err := escrow.Submit(ctx, rpc, admin, cfg.NetworkPassphrase, cancelCHF, escrow.Config{})
	if err != nil {
		log.Fatalf("set_event_cancelled(C) failed (expected to succeed pre-launch): %v", err)
	}
	fmt.Println("  set_event_cancelled(C) tx hash:", cancelCResult.Hash)

	balanceAfterCancelC, err := escrow.GetBalance(ctx, rpc, contractAddr, admin.Address(), escrow.Config{})
	if err != nil {
		log.Fatalf("get_balance after cancel(C) failed: %v", err)
	}
	wantBalanceAfterCancelC := balanceBeforeCancelC + cancelledEventRewardC
	fmt.Printf("  balance: %d stroops (want %d, i.e. reward refunded)\n", balanceAfterCancelC, wantBalanceAfterCancelC)
	if balanceAfterCancelC != wantBalanceAfterCancelC {
		log.Fatalf("balance mismatch after cancel(C): got %d, want %d", balanceAfterCancelC, wantBalanceAfterCancelC)
	}

	// --- Scenario D: InProgress rejects cancellation, proven on-chain ------

	eventIDD := mustNewEventID()
	fmt.Println("\n[D] create_event -> InProgress -> set_event_cancelled MUST be rejected by the contract (ADR-006)")
	fmt.Println("  event_id:", eventIDD)
	mustCreateEvent(ctx, rpc, contractAddr, admin, judge, resolver, token, inProgressRejectRewardD, eventIDD, cfg)
	mustGoLive(ctx, rpc, contractAddr, admin, eventIDD, farJudgingDeadlineOffset, cfg, "D")

	fmt.Println("  event D is now InProgress; attempting set_event_cancelled (expected to be rejected)...")
	cancelDHF, err := escrow.SetEventCancelledHostFunction(contractAddr, admin.Address(), eventIDD)
	if err != nil {
		log.Fatalf("building set_event_cancelled(D) host function: %v", err)
	}
	if _, err := escrow.Submit(ctx, rpc, admin, cfg.NetworkPassphrase, cancelDHF, escrow.Config{}); err == nil {
		log.Fatal("expected set_event_cancelled to be rejected once InProgress, but it succeeded -- ADR-006 is violated")
	} else {
		fmt.Println("  rejected as expected, simulation error:")
		fmt.Println("   ", err)
	}

	// --- Scenario E: resolve_dispute --------------------------------------

	eventIDE := mustNewEventID()
	fmt.Println("\n[E] create_event -> InProgress (short judging_deadline) -> resolve_dispute")
	fmt.Println("  event_id:", eventIDE)
	mustCreateEvent(ctx, rpc, contractAddr, admin, judge, resolver, token, disputeRewardE, eventIDE, cfg)
	judgingDeadlineE := uint64(time.Now().Add(judgingDeadlineOffset).Unix())
	mustGoLiveAt(ctx, rpc, contractAddr, admin, eventIDE, judgingDeadlineE, cfg, "E")

	fmt.Println("  attempting resolve_dispute as the judge (must be rejected -- only the event's resolver may call it)...")
	judgeAsResolverHF, err := escrow.ResolveDisputeHostFunction(contractAddr, judge.Address(), eventIDE, []escrow.Winner{
		{Place: 1, Amount: disputeRewardE, Address: judge.Address()},
	})
	if err != nil {
		log.Fatalf("building resolve_dispute(judge) host function: %v", err)
	}
	if _, err := escrow.Submit(ctx, rpc, judge, cfg.NetworkPassphrase, judgeAsResolverHF, escrow.Config{}); err == nil {
		log.Fatal("expected resolve_dispute called by the judge to be rejected, but it succeeded")
	} else {
		fmt.Println("  rejected as expected, simulation error:")
		fmt.Println("   ", err)
	}

	fmt.Printf("  waiting for judging_deadline (%d) to pass...\n", judgingDeadlineE)
	for {
		ledger, err := rpc.GetLatestLedger(ctx)
		if err != nil {
			log.Fatalf("getLatestLedger while waiting for judging_deadline: %v", err)
		}
		now := uint64(time.Now().Unix())
		fmt.Printf("    latest ledger sequence %d, now=%d, deadline=%d\n", ledger.Sequence, now, judgingDeadlineE)
		if now > judgingDeadlineE {
			break
		}
		time.Sleep(5 * time.Second)
	}

	fmt.Println("  resolve_dispute(resolver, event_id, winners) -- paying a team member AND the organizer's own address (cancel-after-launch)")
	winnersE := []escrow.Winner{
		{Place: 1, Amount: disputeMemberShareE, Address: teamMember1.Address()},
		{Place: 1, Amount: disputeAdminShareE, Address: admin.Address()},
	}
	balancesBeforeE := map[string]int64{}
	for _, addr := range []string{teamMember1.Address(), admin.Address()} {
		bal, err := nativeBalanceStroops(horizon, addr)
		if err != nil {
			log.Fatalf("reading pre-resolve balance for %s: %v", addr, err)
		}
		balancesBeforeE[addr] = bal
	}

	unsignedResolveE, err := escrow.BuildResolveDispute(ctx, rpc, contractAddr, resolver.Address(), eventIDE, winnersE, escrow.Config{})
	if err != nil {
		log.Fatalf("building resolve_dispute(E) transaction: %v", err)
	}
	signedResolveEXDR, err := signTransaction(unsignedResolveE.XDR, resolver, cfg.NetworkPassphrase)
	if err != nil {
		log.Fatalf("signing resolve_dispute(E) transaction: %v", err)
	}
	resolveEResult, err := escrow.SubmitSigned(ctx, rpc, signedResolveEXDR, escrow.Config{})
	if err != nil {
		log.Fatalf("submitting signed resolve_dispute(E) transaction: %v", err)
	}
	fmt.Println("  resolve_dispute tx hash:", resolveEResult.Hash)

	fmt.Println("  on-chain transfer amounts (post-resolve balance delta):")
	var totalTransferredE int64
	for _, w := range winnersE {
		after, err := nativeBalanceStroops(horizon, w.Address)
		if err != nil {
			log.Fatalf("reading post-resolve balance for %s: %v", w.Address, err)
		}
		delta := after - balancesBeforeE[w.Address]
		fmt.Printf("    %s: +%d stroops (want %d)\n", w.Address, delta, w.Amount)
		if delta != w.Amount {
			log.Fatalf("transfer amount mismatch for %s: got %d, want %d", w.Address, delta, w.Amount)
		}
		totalTransferredE += delta
	}
	if totalTransferredE != disputeRewardE {
		log.Fatalf("total transferred %d does not match event reward %d", totalTransferredE, disputeRewardE)
	}

	// --- Scenario F: emergency_withdraw, two signatures, happy path --------

	eventIDF := mustNewEventID()
	fmt.Println("\n[F] create_event -> emergency_withdraw with BOTH admin's and resolver's signatures")
	fmt.Println("  event_id:", eventIDF)
	mustCreateEvent(ctx, rpc, contractAddr, admin, judge, resolver, token, eventRewardF, eventIDF, cfg)

	balanceBeforeF, err := escrow.GetBalance(ctx, rpc, contractAddr, admin.Address(), escrow.Config{})
	if err != nil {
		log.Fatalf("get_balance before emergency_withdraw(F) failed: %v", err)
	}

	unsignedF, err := escrow.BuildEmergencyWithdraw(ctx, rpc, contractAddr, admin.Address(), admin.Address(), resolver.Address(), eventIDF, emergencyWithdrawAmountF, escrow.Config{})
	if err != nil {
		log.Fatalf("building emergency_withdraw(F) transaction: %v", err)
	}
	if len(unsignedF.PendingAuth) != 1 {
		log.Fatalf("emergency_withdraw(F) has %d pending auth entries, want exactly 1 (the resolver's)", len(unsignedF.PendingAuth))
	}
	fmt.Println("  resolver signs its pending auth entry client-side (SignAuthEntry) -- this service never holds the resolver's key")
	signedResolverEntry, err := escrow.SignAuthEntry(unsignedF.PendingAuth[0], resolver, cfg.NetworkPassphrase)
	if err != nil {
		log.Fatalf("signing resolver's auth entry for emergency_withdraw(F): %v", err)
	}
	attachedF, err := escrow.AttachSignedAuth(unsignedF, []xdr.SorobanAuthorizationEntry{signedResolverEntry})
	if err != nil {
		log.Fatalf("attaching resolver's signed auth entry for emergency_withdraw(F): %v", err)
	}
	signedFXDR, err := signTransaction(attachedF.XDR, admin, cfg.NetworkPassphrase)
	if err != nil {
		log.Fatalf("signing emergency_withdraw(F) envelope as admin: %v", err)
	}
	withdrawFResult, err := escrow.SubmitSigned(ctx, rpc, signedFXDR, escrow.Config{})
	if err != nil {
		log.Fatalf("submitting signed emergency_withdraw(F) transaction: %v", err)
	}
	fmt.Println("  emergency_withdraw(F) tx hash:", withdrawFResult.Hash)

	balanceAfterF, err := escrow.GetBalance(ctx, rpc, contractAddr, admin.Address(), escrow.Config{})
	if err != nil {
		log.Fatalf("get_balance after emergency_withdraw(F) failed: %v", err)
	}
	wantBalanceAfterF := balanceBeforeF + emergencyWithdrawAmountF
	fmt.Printf("  balance: %d stroops (want %d, i.e. withdrawn amount credited back)\n", balanceAfterF, wantBalanceAfterF)
	if balanceAfterF != wantBalanceAfterF {
		log.Fatalf("balance mismatch after emergency_withdraw(F): got %d, want %d", balanceAfterF, wantBalanceAfterF)
	}

	// --- Scenario G: emergency_withdraw, one signature, MUST be rejected ---

	eventIDG := mustNewEventID()
	fmt.Println("\n[G] create_event -> emergency_withdraw with ONLY admin's signature -- MUST be rejected by the network/host")
	fmt.Println("  event_id:", eventIDG)
	mustCreateEvent(ctx, rpc, contractAddr, admin, judge, resolver, token, eventRewardG, eventIDG, cfg)

	unsignedG, err := escrow.BuildEmergencyWithdraw(ctx, rpc, contractAddr, admin.Address(), admin.Address(), resolver.Address(), eventIDG, emergencyWithdrawAmountG, escrow.Config{})
	if err != nil {
		log.Fatalf("building emergency_withdraw(G) transaction: %v", err)
	}
	fmt.Println("  skipping SignAuthEntry/AttachSignedAuth for the resolver's pending entry -- submitting with admin's envelope signature only")
	signedGXDR, err := signTransaction(unsignedG.XDR, admin, cfg.NetworkPassphrase)
	if err != nil {
		log.Fatalf("signing emergency_withdraw(G) envelope as admin: %v", err)
	}
	if _, err := escrow.SubmitSigned(ctx, rpc, signedGXDR, escrow.Config{}); err == nil {
		log.Fatal("expected single-signature emergency_withdraw(G) to be rejected, but it succeeded")
	} else {
		fmt.Println("  rejected as expected, error:")
		fmt.Println("   ", err)
	}

	fmt.Println("\ndone")
	fmt.Println("E01d testnet round-trip complete: resolve_dispute (E), two-signature emergency_withdraw (F), and a proven single-signature rejection (G) -- on top of E01a-E01c's original scenarios (A-D).")
	fmt.Println("contract:", cfg.EscrowContractID)
}

// mustRandomKeypair panics on error -- acceptable in this manual harness,
// which already treats every failure as fatal.
func mustRandomKeypair() *keypair.Full {
	kp, err := keypair.Random()
	if err != nil {
		log.Fatalf("generating keypair: %v", err)
	}
	return kp
}

func mustNewEventID() escrow.EventID {
	id, err := escrow.NewEventID()
	if err != nil {
		log.Fatalf("generating event id: %v", err)
	}
	return id
}

// mustCreateEvent creates one event with an explicit resolver (never relying
// on the contract's DefaultResolver fallback, so every scenario below
// exercises the same, known resolver key) and fails the whole run on error.
func mustCreateEvent(ctx context.Context, rpc escrow.RPCClient, contract xdr.ScAddress, admin, judge, resolver *keypair.Full, token string, reward int64, eventID escrow.EventID, cfg config.Config) {
	hf, err := escrow.CreateEventHostFunction(contract, admin.Address(), judge.Address(), resolver.Address(), token, reward, eventID)
	if err != nil {
		log.Fatalf("building create_event host function: %v", err)
	}
	result, err := escrow.Submit(ctx, rpc, admin, cfg.NetworkPassphrase, hf, escrow.Config{})
	if err != nil {
		log.Fatalf("create_event failed: %v", err)
	}
	fmt.Println("  create_event tx hash:", result.Hash)
}

// mustGoLive drives an event from Created to InProgress
// (set_event_waiting_for_start, then set_event_in_progress) with
// judging_deadline set farJudgingDeadlineOffset out -- for scenarios that
// never need judging_deadline to actually pass.
func mustGoLive(ctx context.Context, rpc escrow.RPCClient, contract xdr.ScAddress, admin *keypair.Full, eventID escrow.EventID, offset time.Duration, cfg config.Config, label string) {
	mustGoLiveAt(ctx, rpc, contract, admin, eventID, uint64(time.Now().Add(offset).Unix()), cfg, label)
}

// mustGoLiveAt is mustGoLive with an explicit judging_deadline (a Unix
// timestamp), for scenarios (E) that need to wait for it to pass.
func mustGoLiveAt(ctx context.Context, rpc escrow.RPCClient, contract xdr.ScAddress, admin *keypair.Full, eventID escrow.EventID, judgingDeadline uint64, cfg config.Config, label string) {
	waitingHF, err := escrow.SetEventWaitingForStartHostFunction(contract, admin.Address(), eventID)
	if err != nil {
		log.Fatalf("building set_event_waiting_for_start(%s) host function: %v", label, err)
	}
	if _, err := escrow.Submit(ctx, rpc, admin, cfg.NetworkPassphrase, waitingHF, escrow.Config{}); err != nil {
		log.Fatalf("set_event_waiting_for_start(%s) failed: %v", label, err)
	}

	fee, err := escrow.QuoteGoLiveFee(ctx, rpc, contract, eventID, admin.Address(), escrow.Config{})
	if err != nil {
		log.Fatalf("quote_go_live_fee(%s) failed: %v", label, err)
	}
	fmt.Printf("  quote_go_live_fee(%s): %d stroops\n", label, fee)

	inProgressHF, err := escrow.SetEventInProgressHostFunction(contract, admin.Address(), eventID, judgingDeadline)
	if err != nil {
		log.Fatalf("building set_event_in_progress(%s) host function: %v", label, err)
	}
	result, err := escrow.Submit(ctx, rpc, admin, cfg.NetworkPassphrase, inProgressHF, escrow.Config{})
	if err != nil {
		log.Fatalf("set_event_in_progress(%s) failed: %v", label, err)
	}
	fmt.Printf("  set_event_in_progress(%s) tx hash: %s (judging_deadline=%d)\n", label, result.Hash, judgingDeadline)
}

// nativeAssetContractID returns the deterministic contract id of the native
// XLM Stellar Asset Contract on the configured network.
func nativeAssetContractID(networkPassphrase string) (string, error) {
	asset := xdr.Asset{Type: xdr.AssetTypeAssetTypeNative}
	id, err := asset.ContractID(networkPassphrase)
	if err != nil {
		return "", err
	}
	return strkey.Encode(strkey.VersionByteContract, id[:])
}

// nativeBalanceStroops reads address's classic native XLM balance (visible
// via Horizon even though transfers move through the SAC/Soroban side) and
// converts it to stroops, for before/after delta checks around a payout.
func nativeBalanceStroops(horizon *horizonclient.Client, address string) (int64, error) {
	account, err := horizon.AccountDetail(horizonclient.AccountRequest{AccountID: address})
	if err != nil {
		return 0, fmt.Errorf("loading account %s: %w", address, err)
	}
	for _, b := range account.Balances {
		if b.Asset.Type != "native" {
			continue
		}
		xlm, err := strconv.ParseFloat(b.Balance, 64)
		if err != nil {
			return 0, fmt.Errorf("parsing native balance %q: %w", b.Balance, err)
		}
		return int64(math.Round(xlm * 1e7)), nil
	}
	return 0, fmt.Errorf("no native balance entry for %s", address)
}

// signTransaction stands in for an organizer's/judge's/resolver's wallet: it
// parses the unsigned envelope a Build... function produced, signs it, and
// re-encodes it, all using the same txnbuild API a real wallet would use.
func signTransaction(unsignedXDR string, signer *keypair.Full, networkPassphrase string) (string, error) {
	generic, err := txnbuild.TransactionFromXDR(unsignedXDR)
	if err != nil {
		return "", fmt.Errorf("parsing unsigned envelope: %w", err)
	}
	tx, ok := generic.Transaction()
	if !ok {
		return "", fmt.Errorf("unsigned envelope is not a simple transaction")
	}
	signed, err := tx.Sign(networkPassphrase, signer)
	if err != nil {
		return "", fmt.Errorf("signing transaction: %w", err)
	}
	return signed.Base64()
}

func invokeContractHF(contract xdr.ScAddress, fn string, args ...xdr.ScVal) xdr.HostFunction {
	return xdr.HostFunction{
		Type: xdr.HostFunctionTypeHostFunctionTypeInvokeContract,
		InvokeContract: &xdr.InvokeContractArgs{
			ContractAddress: contract,
			FunctionName:    xdr.ScSymbol(fn),
			Args:            args,
		},
	}
}

func eventIDArg(id escrow.EventID) xdr.ScVal {
	b := xdr.ScBytes(append([]byte(nil), id[:]...))
	return xdr.ScVal{Type: xdr.ScValTypeScvBytes, Bytes: &b}
}

// mapField looks up key in an ScvMap-encoded contracttype struct (Soroban's
// default struct encoding: a map from field-name symbol to value).
func mapField(v xdr.ScVal, key string) (xdr.ScVal, bool) {
	m, ok := v.GetMap()
	if !ok || m == nil {
		return xdr.ScVal{}, false
	}
	for _, entry := range *m {
		if entry.Key.Type == xdr.ScValTypeScvSymbol && string(*entry.Key.Sym) == key {
			return entry.Val, true
		}
	}
	return xdr.ScVal{}, false
}
