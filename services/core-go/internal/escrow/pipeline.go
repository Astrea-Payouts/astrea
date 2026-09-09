package escrow

import (
	"context"
	"fmt"
	"time"

	"github.com/stellar/go/keypair"
	protocol "github.com/stellar/go/protocols/rpc"
	"github.com/stellar/go/protocols/stellarcore"
	"github.com/stellar/go/txnbuild"
	"github.com/stellar/go/xdr"
)

// RPCClient is the subset of *rpcclient.Client (package
// github.com/stellar/go/clients/rpcclient) the pipeline depends on, narrowed
// to an interface so tests can substitute a mock instead of talking to a
// real Soroban RPC endpoint. *rpcclient.Client satisfies this today without
// any adapter.
type RPCClient interface {
	LoadAccount(ctx context.Context, address string) (txnbuild.Account, error)
	SimulateTransaction(ctx context.Context, request protocol.SimulateTransactionRequest) (protocol.SimulateTransactionResponse, error)
	SendTransaction(ctx context.Context, request protocol.SendTransactionRequest) (protocol.SendTransactionResponse, error)
	GetTransaction(ctx context.Context, request protocol.GetTransactionRequest) (protocol.GetTransactionResponse, error)
}

// Config controls transaction construction and confirmation polling for
// Submit. The zero value is valid: every field falls back to a sane
// default.
type Config struct {
	// TxTimeout bounds how long the built transaction stays valid on the
	// ledger (its time bounds), independent of PollTimeout below. Defaults
	// to 60s.
	TxTimeout time.Duration
	// PollTimeout is the hard cap on how long Submit waits for on-chain
	// confirmation before giving up and returning a *TimeoutError. Submit
	// never polls unboundedly. Defaults to 30s.
	PollTimeout time.Duration
	// PollInterval is the delay before the first confirmation poll, and the
	// starting point for the exponential backoff applied between
	// subsequent polls. Defaults to 1s.
	PollInterval time.Duration
	// MaxPollInterval caps how large PollInterval's backoff is allowed to
	// grow. Defaults to 5s.
	MaxPollInterval time.Duration
}

const (
	defaultTxTimeout       = 60 * time.Second
	defaultPollTimeout     = 30 * time.Second
	defaultPollInterval    = 1 * time.Second
	defaultMaxPollInterval = 5 * time.Second
)

func (c Config) withDefaults() Config {
	if c.TxTimeout <= 0 {
		c.TxTimeout = defaultTxTimeout
	}
	if c.PollTimeout <= 0 {
		c.PollTimeout = defaultPollTimeout
	}
	if c.PollInterval <= 0 {
		c.PollInterval = defaultPollInterval
	}
	if c.MaxPollInterval <= 0 || c.MaxPollInterval < c.PollInterval {
		c.MaxPollInterval = defaultMaxPollInterval
	}
	return c
}

// Result is what Submit returns once a transaction has been confirmed
// successful on-chain.
type Result struct {
	// Hash is the transaction hash, checkable on a block explorer.
	Hash string
	// ReturnValue is the invoked host function's return value, as reported
	// by simulation (Soroban RPC does not re-report it on getTransaction).
	ReturnValue xdr.ScVal
}

// SimulationError means the RPC preflight/simulation step reported a
// failure. No transaction was ever submitted to the network.
type SimulationError struct {
	Message string
}

func (e *SimulationError) Error() string {
	return fmt.Sprintf("escrow: simulation failed: %s", e.Message)
}

// SubmissionError means stellar-core rejected the transaction at submission
// time — it never entered the ledger.
type SubmissionError struct {
	Status         string
	ErrorResultXDR string
}

func (e *SubmissionError) Error() string {
	return fmt.Sprintf("escrow: submission rejected (status %s): %s", e.Status, e.ErrorResultXDR)
}

// OnChainError means the transaction was included in the ledger but
// executed with an error (e.g. a contract-level assertion failure, or a
// failed require_auth).
type OnChainError struct {
	Hash      string
	ResultXDR string
}

func (e *OnChainError) Error() string {
	return fmt.Sprintf("escrow: transaction %s failed on-chain: %s", e.Hash, e.ResultXDR)
}

// TimeoutError means Submit gave up waiting for confirmation once
// Config.PollTimeout elapsed. The transaction was successfully submitted
// and may still confirm (or fail) later — callers should treat this as
// "unknown outcome", not as "failed".
type TimeoutError struct {
	Hash    string
	Elapsed time.Duration
}

func (e *TimeoutError) Error() string {
	return fmt.Sprintf("escrow: timed out after %s waiting for transaction %s to confirm", e.Elapsed, e.Hash)
}

// Submit runs the full Soroban invocation lifecycle for hf: simulate ->
// attach the simulated footprint/resource-fee/auth -> sign with source ->
// submit -> poll until the ledger confirms success or failure (bounded by
// cfg.PollTimeout). It returns the host function's return value on success,
// or one of *SimulationError, *SubmissionError, *OnChainError, *TimeoutError
// on failure, so callers can branch on which stage failed.
func Submit(ctx context.Context, rpc RPCClient, source *keypair.Full, networkPassphrase string, hf xdr.HostFunction, cfg Config) (Result, error) {
	cfg = cfg.withDefaults()

	account, err := rpc.LoadAccount(ctx, source.Address())
	if err != nil {
		return Result{}, fmt.Errorf("escrow: loading source account: %w", err)
	}

	simTx, err := buildTx(account, source.Address(), hf, nil, nil, cfg.TxTimeout)
	if err != nil {
		return Result{}, fmt.Errorf("escrow: building simulation transaction: %w", err)
	}
	simB64, err := simTx.Base64()
	if err != nil {
		return Result{}, fmt.Errorf("escrow: encoding simulation transaction: %w", err)
	}

	simResp, err := rpc.SimulateTransaction(ctx, protocol.SimulateTransactionRequest{Transaction: simB64})
	if err != nil {
		return Result{}, fmt.Errorf("escrow: calling simulateTransaction: %w", err)
	}
	if simResp.Error != "" {
		return Result{}, &SimulationError{Message: simResp.Error}
	}

	var sorobanData xdr.SorobanTransactionData
	if err := xdr.SafeUnmarshalBase64(simResp.TransactionDataXDR, &sorobanData); err != nil {
		return Result{}, fmt.Errorf("escrow: decoding simulated transaction data: %w", err)
	}
	sorobanData.ResourceFee = xdr.Int64(simResp.MinResourceFee)

	var auth []xdr.SorobanAuthorizationEntry
	var returnVal xdr.ScVal
	if len(simResp.Results) > 0 {
		res := simResp.Results[0]
		if res.AuthXDR != nil {
			for _, a := range *res.AuthXDR {
				var entry xdr.SorobanAuthorizationEntry
				if err := xdr.SafeUnmarshalBase64(a, &entry); err != nil {
					return Result{}, fmt.Errorf("escrow: decoding simulated auth entry: %w", err)
				}
				auth = append(auth, entry)
			}
		}
		if res.ReturnValueXDR != nil {
			if err := xdr.SafeUnmarshalBase64(*res.ReturnValueXDR, &returnVal); err != nil {
				return Result{}, fmt.Errorf("escrow: decoding simulated return value: %w", err)
			}
		}
	}

	// The account loaded above was only used to build the throwaway
	// simulation transaction; reload it for a fresh sequence number before
	// building the transaction that actually gets signed and submitted.
	account, err = rpc.LoadAccount(ctx, source.Address())
	if err != nil {
		return Result{}, fmt.Errorf("escrow: reloading source account: %w", err)
	}
	finalTx, err := buildTx(account, source.Address(), hf, auth, &sorobanData, cfg.TxTimeout)
	if err != nil {
		return Result{}, fmt.Errorf("escrow: building final transaction: %w", err)
	}
	finalTx, err = finalTx.Sign(networkPassphrase, source)
	if err != nil {
		return Result{}, fmt.Errorf("escrow: signing transaction: %w", err)
	}
	finalB64, err := finalTx.Base64()
	if err != nil {
		return Result{}, fmt.Errorf("escrow: encoding transaction: %w", err)
	}

	sendResp, err := rpc.SendTransaction(ctx, protocol.SendTransactionRequest{Transaction: finalB64})
	if err != nil {
		return Result{}, fmt.Errorf("escrow: calling sendTransaction: %w", err)
	}
	if sendResp.Status == stellarcore.TXStatusError {
		return Result{}, &SubmissionError{Status: sendResp.Status, ErrorResultXDR: sendResp.ErrorResultXDR}
	}

	if err := pollForConfirmation(ctx, rpc, sendResp.Hash, cfg); err != nil {
		return Result{}, err
	}
	return Result{Hash: sendResp.Hash, ReturnValue: returnVal}, nil
}

// UnsignedTx is a simulated, footprint-attached Soroban transaction that
// still needs a signature. Astrea is non-custodial: for organizer-authorized
// calls (deposit_funds, withdraw_funds, create_event) the organizer's key
// never reaches this service, so BuildUnsigned stops where Submit would
// sign, and hands back an envelope for the organizer's own wallet to sign
// instead.
type UnsignedTx struct {
	// XDR is the unsigned transaction envelope, base64-encoded, ready to be
	// handed to an external signer.
	XDR string
	// SimulatedReturn is the host function's return value as reported by
	// simulation. It is informational only: the transaction has not been
	// submitted yet, so this is a preview, not an on-chain fact.
	SimulatedReturn xdr.ScVal
}

// BuildUnsigned runs simulate -> attach footprint/resource-fee/auth for hf,
// the same as the first half of Submit, but returns the resulting
// transaction unsigned instead of signing and submitting it. sourceAddress
// is the G-address that will source (and, once signed elsewhere, submit)
// the transaction; BuildUnsigned never needs or sees a private key for it.
func BuildUnsigned(ctx context.Context, rpc RPCClient, sourceAddress string, hf xdr.HostFunction, cfg Config) (UnsignedTx, error) {
	cfg = cfg.withDefaults()

	account, err := rpc.LoadAccount(ctx, sourceAddress)
	if err != nil {
		return UnsignedTx{}, fmt.Errorf("escrow: loading source account: %w", err)
	}

	simTx, err := buildTx(account, sourceAddress, hf, nil, nil, cfg.TxTimeout)
	if err != nil {
		return UnsignedTx{}, fmt.Errorf("escrow: building simulation transaction: %w", err)
	}
	simB64, err := simTx.Base64()
	if err != nil {
		return UnsignedTx{}, fmt.Errorf("escrow: encoding simulation transaction: %w", err)
	}

	simResp, err := rpc.SimulateTransaction(ctx, protocol.SimulateTransactionRequest{Transaction: simB64})
	if err != nil {
		return UnsignedTx{}, fmt.Errorf("escrow: calling simulateTransaction: %w", err)
	}
	if simResp.Error != "" {
		return UnsignedTx{}, &SimulationError{Message: simResp.Error}
	}

	var sorobanData xdr.SorobanTransactionData
	if err := xdr.SafeUnmarshalBase64(simResp.TransactionDataXDR, &sorobanData); err != nil {
		return UnsignedTx{}, fmt.Errorf("escrow: decoding simulated transaction data: %w", err)
	}
	sorobanData.ResourceFee = xdr.Int64(simResp.MinResourceFee)

	var auth []xdr.SorobanAuthorizationEntry
	var returnVal xdr.ScVal
	if len(simResp.Results) > 0 {
		res := simResp.Results[0]
		if res.AuthXDR != nil {
			for _, a := range *res.AuthXDR {
				var entry xdr.SorobanAuthorizationEntry
				if err := xdr.SafeUnmarshalBase64(a, &entry); err != nil {
					return UnsignedTx{}, fmt.Errorf("escrow: decoding simulated auth entry: %w", err)
				}
				auth = append(auth, entry)
			}
		}
		if res.ReturnValueXDR != nil {
			if err := xdr.SafeUnmarshalBase64(*res.ReturnValueXDR, &returnVal); err != nil {
				return UnsignedTx{}, fmt.Errorf("escrow: decoding simulated return value: %w", err)
			}
		}
	}

	// As in Submit, the account loaded above was only used to build the
	// throwaway simulation transaction; reload it for a fresh sequence
	// number before building the transaction that will actually be signed
	// (by the caller's wallet) and submitted.
	account, err = rpc.LoadAccount(ctx, sourceAddress)
	if err != nil {
		return UnsignedTx{}, fmt.Errorf("escrow: reloading source account: %w", err)
	}
	finalTx, err := buildTx(account, sourceAddress, hf, auth, &sorobanData, cfg.TxTimeout)
	if err != nil {
		return UnsignedTx{}, fmt.Errorf("escrow: building final transaction: %w", err)
	}
	finalB64, err := finalTx.Base64()
	if err != nil {
		return UnsignedTx{}, fmt.Errorf("escrow: encoding unsigned transaction: %w", err)
	}

	return UnsignedTx{XDR: finalB64, SimulatedReturn: returnVal}, nil
}

// SubmitSigned submits a transaction that was already fully signed
// elsewhere (e.g. by an organizer's wallet, from the envelope BuildUnsigned
// produced) and polls until the ledger confirms success or failure, the
// same as the second half of Submit. Its Result.ReturnValue is always the
// zero xdr.ScVal: this path never re-simulates, so the only return value
// available is the one BuildUnsigned already reported as SimulatedReturn.
func SubmitSigned(ctx context.Context, rpc RPCClient, signedTxXDR string, cfg Config) (Result, error) {
	cfg = cfg.withDefaults()

	sendResp, err := rpc.SendTransaction(ctx, protocol.SendTransactionRequest{Transaction: signedTxXDR})
	if err != nil {
		return Result{}, fmt.Errorf("escrow: calling sendTransaction: %w", err)
	}
	if sendResp.Status == stellarcore.TXStatusError {
		return Result{}, &SubmissionError{Status: sendResp.Status, ErrorResultXDR: sendResp.ErrorResultXDR}
	}

	if err := pollForConfirmation(ctx, rpc, sendResp.Hash, cfg); err != nil {
		return Result{}, err
	}
	return Result{Hash: sendResp.Hash}, nil
}

func buildTx(account txnbuild.Account, sourceAddress string, hf xdr.HostFunction, auth []xdr.SorobanAuthorizationEntry, sorobanData *xdr.SorobanTransactionData, timeout time.Duration) (*txnbuild.Transaction, error) {
	op := &txnbuild.InvokeHostFunction{
		HostFunction:  hf,
		Auth:          auth,
		SourceAccount: sourceAddress,
	}
	if sorobanData != nil {
		op.Ext = xdr.TransactionExt{V: 1, SorobanData: sorobanData}
	}
	return txnbuild.NewTransaction(txnbuild.TransactionParams{
		SourceAccount:        account,
		IncrementSequenceNum: true,
		Operations:           []txnbuild.Operation{op},
		BaseFee:              txnbuild.MinBaseFee,
		Preconditions:        txnbuild.Preconditions{TimeBounds: txnbuild.NewTimeout(int64(timeout.Seconds()))},
	})
}

// pollForConfirmation polls getTransaction for hash until it reports
// SUCCESS or FAILED, cfg.PollTimeout elapses (-> *TimeoutError), or ctx is
// cancelled. Backoff starts at cfg.PollInterval and doubles on each retry
// up to cfg.MaxPollInterval.
func pollForConfirmation(ctx context.Context, rpc RPCClient, hash string, cfg Config) error {
	deadline := time.Now().Add(cfg.PollTimeout)
	interval := cfg.PollInterval

	for {
		getResp, err := rpc.GetTransaction(ctx, protocol.GetTransactionRequest{Hash: hash})
		if err != nil {
			return fmt.Errorf("escrow: calling getTransaction: %w", err)
		}
		switch getResp.Status {
		case protocol.TransactionStatusSuccess:
			return nil
		case protocol.TransactionStatusFailed:
			return &OnChainError{Hash: hash, ResultXDR: getResp.ResultXDR}
		}

		if time.Now().Add(interval).After(deadline) {
			return &TimeoutError{Hash: hash, Elapsed: cfg.PollTimeout}
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(interval):
		}

		interval *= 2
		if interval > cfg.MaxPollInterval {
			interval = cfg.MaxPollInterval
		}
	}
}
