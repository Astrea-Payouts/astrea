"use client";

import { useEffect, useRef, useState } from "react";
import { RealtimeClient } from "./realtime-client";
import type {
	RealtimeConnectionStatus,
	RealtimeMessage,
	UseEventRealtimeOptions,
	UseEventRealtimeReturn,
} from "./types";

/**
 * React hook to subscribe to live progress and score updates for an event (E04).
 * Uses Server-Sent Events (SSE) with automatic fallback to polling on connection loss.
 */
export function useEventRealtime<T = Record<string, unknown>>(
	eventId: string,
	options: UseEventRealtimeOptions<T> = {},
): UseEventRealtimeReturn<T> {
	const [status, setStatus] = useState<RealtimeConnectionStatus>("connecting");
	const [lastEvent, setLastEvent] = useState<RealtimeMessage<T> | null>(null);
	const [error, setError] = useState<Error | null>(null);

	const clientRef = useRef<RealtimeClient<T> | null>(null);
	const optionsRef = useRef(options);
	optionsRef.current = options;

	useEffect(() => {
		if (!eventId) {
			setStatus("closed");
			return;
		}

		const client = new RealtimeClient<T>(eventId, {
			...optionsRef.current,
			onEvent: (msg) => {
				setLastEvent(msg);
				setError(null);
				optionsRef.current.onEvent?.(msg);
			},
		});

		clientRef.current = client;

		const unsubscribeStatus = client.onStatusChange((newStatus) => {
			setStatus(newStatus);
		});

		client.connect();

		return () => {
			unsubscribeStatus();
			client.disconnect();
			clientRef.current = null;
		};
	}, [eventId]);

	const reconnect = () => {
		if (clientRef.current) {
			clientRef.current.connect();
		}
	};

	const disconnect = () => {
		if (clientRef.current) {
			clientRef.current.disconnect();
		}
	};

	return {
		status,
		lastEvent,
		error,
		reconnect,
		disconnect,
	};
}
