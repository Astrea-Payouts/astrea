"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type TransactionPhase =
	| "idle"
	| "building"
	| "awaiting_signature"
	| "pending"
	| "confirmed"
	| "failed";

export interface TransactionStatusState {
	phase: TransactionPhase;
	progress: number;
	txHash?: string;
	contractId?: string;
	error?: string;
	isPending: boolean;
	isTerminal: boolean;
}

export interface UseTransactionStatusOptions {
	initialPhase?: TransactionPhase;
	initialTxHash?: string;
	raceDurationMs?: number;
	onConfirmed?: (txHash: string) => void;
	onFailed?: (error: string) => void;
}

export interface UseTransactionStatusReturn extends TransactionStatusState {
	startBuilding: () => void;
	startSigning: () => void;
	submit: (txHash?: string) => void;
	confirm: (txHash: string, contractId?: string) => void;
	fail: (error: string) => void;
	retry: () => void;
	reset: () => void;
}

export function calculateBaseProgress(phase: TransactionPhase): number {
	switch (phase) {
		case "idle":
			return 0;
		case "building":
			return 25;
		case "awaiting_signature":
			return 50;
		case "pending":
			return 65;
		case "confirmed":
			return 100;
		case "failed":
			return 0;
	}
}

export function mapOpStatusToPhase(
	status: "PENDING" | "SUCCEEDED" | "FAILED",
): TransactionPhase {
	switch (status) {
		case "PENDING":
			return "pending";
		case "SUCCEEDED":
			return "confirmed";
		case "FAILED":
			return "failed";
	}
}

/**
 * useTransactionStatus
 *
 * Implements the U06 "pending on-chain" UX principle for money-moving flows:
 * 1. Never optimistically assume success.
 * 2. When PENDING, immediately races progress to ~90% so the user sees work
 *    is happening, then crawls toward 95% while waiting for true on-chain ledger consensus.
 * 3. Snaps to 100% ONLY on confirmed reconciliation.
 * 4. Distinct actionable failure state with retry capability.
 */
export function useTransactionStatus(
	options: UseTransactionStatusOptions = {},
): UseTransactionStatusReturn {
	const {
		initialPhase = "idle",
		initialTxHash,
		raceDurationMs = 2500,
		onConfirmed,
		onFailed,
	} = options;

	const [phase, setPhase] = useState<TransactionPhase>(initialPhase);
	const [progress, setProgress] = useState<number>(() =>
		calculateBaseProgress(initialPhase),
	);
	const [txHash, setTxHash] = useState<string | undefined>(initialTxHash);
	const [contractId, setContractId] = useState<string | undefined>(undefined);
	const [error, setError] = useState<string | undefined>(undefined);

	const animationFrameRef = useRef<number | null>(null);
	const pendingStartTimeRef = useRef<number | null>(null);

	// Race to ~90% when pending, then crawl slowly toward 95%
	useEffect(() => {
		if (phase !== "pending") {
			if (
				animationFrameRef.current !== null &&
				typeof cancelAnimationFrame !== "undefined"
			) {
				cancelAnimationFrame(animationFrameRef.current);
				animationFrameRef.current = null;
			}
			pendingStartTimeRef.current = null;
			return;
		}

		if (
			typeof performance === "undefined" ||
			typeof requestAnimationFrame === "undefined"
		) {
			setProgress(90);
			return;
		}

		pendingStartTimeRef.current = performance.now();
		const startProgress = 65;
		const targetRaceProgress = 90;
		const maxCrawlProgress = 95;

		const tick = (now: number) => {
			if (!pendingStartTimeRef.current) return;
			const elapsed = now - pendingStartTimeRef.current;

			if (elapsed <= raceDurationMs) {
				// Fast ease-out race to 90%
				const fraction = elapsed / raceDurationMs;
				const easeOut = 1 - (1 - fraction) ** 2;
				const current =
					startProgress + (targetRaceProgress - startProgress) * easeOut;
				setProgress(Number(current.toFixed(1)));
			} else {
				// Slow crawl past 90% toward 95% while awaiting ledger confirmation
				const crawlElapsed = elapsed - raceDurationMs;
				const crawlProgress = Math.min(
					maxCrawlProgress,
					targetRaceProgress + Math.log10(1 + crawlElapsed / 5000) * 5,
				);
				setProgress(Number(crawlProgress.toFixed(1)));
			}

			animationFrameRef.current = requestAnimationFrame(tick);
		};

		animationFrameRef.current = requestAnimationFrame(tick);

		return () => {
			if (
				animationFrameRef.current !== null &&
				typeof cancelAnimationFrame !== "undefined"
			) {
				cancelAnimationFrame(animationFrameRef.current);
				animationFrameRef.current = null;
			}
		};
	}, [phase, raceDurationMs]);

	const startBuilding = useCallback(() => {
		setPhase("building");
		setProgress(calculateBaseProgress("building"));
		setError(undefined);
	}, []);

	const startSigning = useCallback(() => {
		setPhase("awaiting_signature");
		setProgress(calculateBaseProgress("awaiting_signature"));
		setError(undefined);
	}, []);

	const submit = useCallback((hash?: string) => {
		setPhase("pending");
		setProgress(calculateBaseProgress("pending"));
		if (hash) setTxHash(hash);
		setError(undefined);
	}, []);

	const confirm = useCallback(
		(confirmedTxHash: string, deployedContractId?: string) => {
			setPhase("confirmed");
			setProgress(100);
			setTxHash(confirmedTxHash);
			if (deployedContractId) setContractId(deployedContractId);
			setError(undefined);
			onConfirmed?.(confirmedTxHash);
		},
		[onConfirmed],
	);

	const fail = useCallback(
		(err: string) => {
			setPhase("failed");
			setError(err);
			onFailed?.(err);
		},
		[onFailed],
	);

	const reset = useCallback(() => {
		setPhase("idle");
		setProgress(0);
		setTxHash(undefined);
		setContractId(undefined);
		setError(undefined);
	}, []);

	const retry = useCallback(() => {
		setPhase("building");
		setProgress(calculateBaseProgress("building"));
		setError(undefined);
	}, []);

	return {
		phase,
		progress,
		txHash,
		contractId,
		error,
		isPending:
			phase === "building" ||
			phase === "awaiting_signature" ||
			phase === "pending",
		isTerminal: phase === "confirmed" || phase === "failed",
		startBuilding,
		startSigning,
		submit,
		confirm,
		fail,
		retry,
		reset,
	};
}
