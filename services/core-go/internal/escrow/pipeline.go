package escrow

import (
	"context"
	"fmt"
	"time"

	rpcclient "github.com/stellar/go/clients/rpcclient"
	"github.com/stellar/go/keypair"
	protocol "github.com/stellar/go/protocols/rpc"
	"github.com/stellar/go/txnbuild"
	"github.com/stellar/go/xdr"
)

var _ RPC = (*rpcclient.Client)(nil)

const (
	defaultPollInterval = 1 * time.Second
	defaultPollTimeout  = 20 * time.Second
	txTimebound         = 60
)

// SimulateError is a preflight failure: the transaction was never submitted.
type SimulateError struct {
	Msg string
}

func (e *SimulateError) Error() string { return "simulation failed: " + e.Msg }

// SubmitError is a send-transaction rejection (Horizon/RPC ERROR status).
type SubmitError struct {
	Msg string
}

func (e *SubmitError) Error() string { return "submission rejected: " + e.Msg }

// ConfirmTimeoutError means the tx was accepted by RPC but never reached a
// terminal SUCCESS/FAILED status within PollTimeout.
type ConfirmTimeoutError struct {
	Hash string
}

func (e *ConfirmTimeoutError) Error() string {
	return fmt.Sprintf("timed out waiting for transaction %s to confirm", e.Hash)
}

// RPC is the Soroban JSON-RPC surface the pipeline needs. *rpcclient.Client
// from github.com/stellar/go/clients/rpcclient satisfies this in production.
type RPC interface {
	LoadAccount(ctx context.Context, address string) (txnbuild.Account, error)
	SimulateTransaction(ctx context.Context, req protocol.SimulateTransactionRequest) (protocol.SimulateTransactionResponse, error)
	SendTransaction(ctx context.Context, req protocol.SendTransactionRequest) (protocol.SendTransactionResponse, error)
	GetTransaction(ctx context.Context, req protocol.GetTransactionRequest) (protocol.GetTransactionResponse, error)
}

// Pipeline is the shared simulate → attach footprint/fee/auth → sign →
// submit → poll cycle. E01b/E01c/E01d wrap this; they do not reimplement it.
type Pipeline struct {
	RPC               RPC
	NetworkPassphrase string
	PollInterval      time.Duration
	PollTimeout       time.Duration
	// Sleep is invoked between poll attempts. Nil uses time.Sleep (ctx-aware).
	Sleep func(ctx context.Context, d time.Duration) error
}

func (p *Pipeline) pollInterval() time.Duration {
	if p.PollInterval > 0 {
		return p.PollInterval
	}
	return defaultPollInterval
}

func (p *Pipeline) pollTimeout() time.Duration {
	if p.PollTimeout > 0 {
		return p.PollTimeout
	}
	return defaultPollTimeout
}

func (p *Pipeline) sleep(ctx context.Context, d time.Duration) error {
	if p.Sleep != nil {
		return p.Sleep(ctx, d)
	}
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-t.C:
		return nil
	}
}

// Submit runs the full simulate-sign-submit-poll cycle for one
// InvokeHostFunction operation. source is the sole signer.
//
// Returns the host-function return value from simulation (if any). Callers
// distinguish simulation failure, submission failure, and confirmation
// timeout via errors.As on *SimulateError, *SubmitError, *ConfirmTimeoutError.
func (p *Pipeline) Submit(ctx context.Context, source *keypair.Full, hf xdr.HostFunction) (xdr.ScVal, error) {
	if p == nil || p.RPC == nil {
		return xdr.ScVal{}, fmt.Errorf("escrow pipeline: RPC client is required")
	}
	if source == nil {
		return xdr.ScVal{}, fmt.Errorf("escrow pipeline: signing key is required")
	}
	if p.NetworkPassphrase == "" {
		return xdr.ScVal{}, fmt.Errorf("escrow pipeline: NetworkPassphrase is required")
	}

	account, err := p.RPC.LoadAccount(ctx, source.Address())
	if err != nil {
		return xdr.ScVal{}, fmt.Errorf("load account: %w", err)
	}

	unsignedOp := &txnbuild.InvokeHostFunction{HostFunction: hf, SourceAccount: source.Address()}
	unsignedTx, err := txnbuild.NewTransaction(txnbuild.TransactionParams{
		SourceAccount:        account,
		IncrementSequenceNum: true,
		Operations:           []txnbuild.Operation{unsignedOp},
		BaseFee:              txnbuild.MinBaseFee,
		Preconditions:        txnbuild.Preconditions{TimeBounds: txnbuild.NewTimeout(txTimebound)},
	})
	if err != nil {
		return xdr.ScVal{}, fmt.Errorf("build unsigned tx: %w", err)
	}
	unsignedB64, err := unsignedTx.Base64()
	if err != nil {
		return xdr.ScVal{}, err
	}

	simResp, err := p.RPC.SimulateTransaction(ctx, protocol.SimulateTransactionRequest{Transaction: unsignedB64})
	if err != nil {
		return xdr.ScVal{}, &SimulateError{Msg: err.Error()}
	}
	if simResp.Error != "" {
		return xdr.ScVal{}, &SimulateError{Msg: simResp.Error}
	}

	var sorobanData xdr.SorobanTransactionData
	if err := xdr.SafeUnmarshalBase64(simResp.TransactionDataXDR, &sorobanData); err != nil {
		return xdr.ScVal{}, &SimulateError{Msg: "decode TransactionDataXDR: " + err.Error()}
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
					return xdr.ScVal{}, &SimulateError{Msg: "decode AuthXDR: " + err.Error()}
				}
				auth = append(auth, entry)
			}
		}
		if res.ReturnValueXDR != nil {
			if err := xdr.SafeUnmarshalBase64(*res.ReturnValueXDR, &returnVal); err != nil {
				return xdr.ScVal{}, &SimulateError{Msg: "decode ReturnValueXDR: " + err.Error()}
			}
		}
	}

	account2, err := p.RPC.LoadAccount(ctx, source.Address())
	if err != nil {
		return xdr.ScVal{}, fmt.Errorf("reload account: %w", err)
	}
	finalOp := &txnbuild.InvokeHostFunction{
		HostFunction:  hf,
		Auth:          auth,
		SourceAccount: source.Address(),
		Ext:           xdr.TransactionExt{V: 1, SorobanData: &sorobanData},
	}
	finalTx, err := txnbuild.NewTransaction(txnbuild.TransactionParams{
		SourceAccount:        account2,
		IncrementSequenceNum: true,
		Operations:           []txnbuild.Operation{finalOp},
		BaseFee:              txnbuild.MinBaseFee,
		Preconditions:        txnbuild.Preconditions{TimeBounds: txnbuild.NewTimeout(txTimebound)},
	})
	if err != nil {
		return xdr.ScVal{}, fmt.Errorf("build signed tx: %w", err)
	}
	finalTx, err = finalTx.Sign(p.NetworkPassphrase, source)
	if err != nil {
		return xdr.ScVal{}, fmt.Errorf("sign tx: %w", err)
	}
	finalB64, err := finalTx.Base64()
	if err != nil {
		return xdr.ScVal{}, err
	}

	sendResp, err := p.RPC.SendTransaction(ctx, protocol.SendTransactionRequest{Transaction: finalB64})
	if err != nil {
		return xdr.ScVal{}, &SubmitError{Msg: err.Error()}
	}
	if sendResp.Status == "ERROR" {
		return xdr.ScVal{}, &SubmitError{Msg: sendResp.ErrorResultXDR}
	}

	if err := p.waitConfirmed(ctx, sendResp.Hash); err != nil {
		return xdr.ScVal{}, err
	}
	return returnVal, nil
}

func (p *Pipeline) waitConfirmed(ctx context.Context, hash string) error {
	deadline := time.Now().Add(p.pollTimeout())
	first := true
	for {
		if !first {
			if err := p.sleep(ctx, p.pollInterval()); err != nil {
				return err
			}
		}
		first = false

		if err := ctx.Err(); err != nil {
			return err
		}
		if time.Now().After(deadline) {
			return &ConfirmTimeoutError{Hash: hash}
		}

		getResp, err := p.RPC.GetTransaction(ctx, protocol.GetTransactionRequest{Hash: hash})
		if err != nil {
			return fmt.Errorf("get transaction %s: %w", hash, err)
		}
		switch getResp.Status {
		case protocol.TransactionStatusSuccess:
			return nil
		case protocol.TransactionStatusFailed:
			return fmt.Errorf("transaction failed on-chain (hash %s): %s", hash, getResp.ResultXDR)
		}
	}
}
