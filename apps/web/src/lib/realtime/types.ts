/**
 * Real-time event tracking type definitions (E04).
 */

export type RealtimeEventType =
	| "participant.progress"
	| "judge.score"
	| "event.state_changed"
	| "ping"
	| "connected";

export interface RealtimeMessage<T = Record<string, unknown>> {
	type: RealtimeEventType;
	eventId: string;
	entityId?: string;
	payload?: T;
	timestamp: string;
}

export type RealtimeConnectionStatus =
	| "connecting"
	| "connected"
	| "reconnecting"
	| "fallback_polling"
	| "closed";

export interface UseEventRealtimeOptions<T = Record<string, unknown>> {
	/**
	 * Callback fired whenever any real-time message is received.
	 */
	onEvent?: (message: RealtimeMessage<T>) => void;

	/**
	 * Custom handler for participant progress specifically.
	 */
	onParticipantProgress?: (message: RealtimeMessage<T>) => void;

	/**
	 * Custom handler for judge score updates specifically.
	 */
	onJudgeScore?: (message: RealtimeMessage<T>) => void;

	/**
	 * Interval in milliseconds to poll if SSE connection is unavailable or blocked.
	 * Default: 5000ms (5 seconds).
	 */
	pollIntervalMs?: number;

	/**
	 * Maximum reconnect attempts before degrading gracefully to polling fallback.
	 * Default: 3 attempts.
	 */
	maxReconnectAttempts?: number;

	/**
	 * Custom EventSource constructor for dependency injection and testing.
	 */
	eventSourceConstructor?: typeof EventSource;
}

export interface UseEventRealtimeReturn<T = Record<string, unknown>> {
	status: RealtimeConnectionStatus;
	lastEvent: RealtimeMessage<T> | null;
	error: Error | null;
	reconnect: () => void;
	disconnect: () => void;
}
