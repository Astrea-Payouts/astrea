import type {
	RealtimeConnectionStatus,
	RealtimeEventType,
	RealtimeMessage,
	UseEventRealtimeOptions,
} from "./types";

export class RealtimeClient<T = Record<string, unknown>> {
	private eventSource: EventSource | null = null;
	private status: RealtimeConnectionStatus = "connecting";
	private reconnectAttempts = 0;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private pollTimer: ReturnType<typeof setInterval> | null = null;
	private listeners: Set<(msg: RealtimeMessage<T>) => void> = new Set();
	private statusListeners: Set<(status: RealtimeConnectionStatus) => void> =
		new Set();

	constructor(
		private readonly eventId: string,
		private readonly options: UseEventRealtimeOptions<T> = {},
	) {}

	public connect(): void {
		if (this.eventSource) {
			this.disconnect();
		}

		if (typeof window === "undefined" && !this.options.eventSourceConstructor) {
			return;
		}

		const EventSourceImpl =
			this.options.eventSourceConstructor ||
			(typeof EventSource !== "undefined" ? EventSource : null);

		if (!EventSourceImpl) {
			this.startFallbackPolling();
			return;
		}

		this.setStatus(this.reconnectAttempts > 0 ? "reconnecting" : "connecting");

		const url = `/api/events/${encodeURIComponent(this.eventId)}/live`;

		try {
			const es = new EventSourceImpl(url);
			this.eventSource = es;

			es.onopen = () => {
				this.reconnectAttempts = 0;
				this.setStatus("connected");
			};

			const handleRawMessage = (e: MessageEvent) => {
				try {
					const parsed = JSON.parse(e.data) as RealtimeMessage<T>;
					this.notify(parsed);
				} catch {
					// Discard malformed SSE payloads cleanly
				}
			};

			es.onmessage = handleRawMessage;

			// Register typed SSE event listeners
			const typedEvents: RealtimeEventType[] = [
				"participant.progress",
				"judge.score",
				"event.state_changed",
				"connected",
			];

			for (const evtType of typedEvents) {
				es.addEventListener(evtType, (e) =>
					handleRawMessage(e as MessageEvent),
				);
			}

			es.onerror = () => {
				this.handleConnectionError();
			};
		} catch {
			this.handleConnectionError();
		}
	}

	private handleConnectionError(): void {
		if (this.eventSource) {
			this.eventSource.close();
			this.eventSource = null;
		}

		const maxAttempts = this.options.maxReconnectAttempts ?? 3;
		this.reconnectAttempts++;

		if (this.reconnectAttempts > maxAttempts) {
			this.startFallbackPolling();
			return;
		}

		this.setStatus("reconnecting");
		const delay = Math.min(1000 * 2 ** (this.reconnectAttempts - 1), 8000);

		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
		}
		this.reconnectTimer = setTimeout(() => {
			this.connect();
		}, delay);
	}

	private startFallbackPolling(): void {
		this.setStatus("fallback_polling");
		if (this.eventSource) {
			this.eventSource.close();
			this.eventSource = null;
		}

		const interval = this.options.pollIntervalMs ?? 5000;
		if (this.pollTimer) {
			clearInterval(this.pollTimer);
		}

		this.pollTimer = setInterval(() => {
			// Periodic heartbeat notification in polling mode
			this.notify({
				type: "ping",
				eventId: this.eventId,
				timestamp: new Date().toISOString(),
			});
		}, interval);
	}

	public disconnect(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
		if (this.pollTimer) {
			clearInterval(this.pollTimer);
			this.pollTimer = null;
		}
		if (this.eventSource) {
			this.eventSource.close();
			this.eventSource = null;
		}
		this.setStatus("closed");
	}

	public subscribe(callback: (msg: RealtimeMessage<T>) => void): () => void {
		this.listeners.add(callback);
		return () => {
			this.listeners.delete(callback);
		};
	}

	public onStatusChange(
		callback: (status: RealtimeConnectionStatus) => void,
	): () => void {
		this.statusListeners.add(callback);
		callback(this.status);
		return () => {
			this.statusListeners.delete(callback);
		};
	}

	public getStatus(): RealtimeConnectionStatus {
		return this.status;
	}

	private setStatus(newStatus: RealtimeConnectionStatus): void {
		this.status = newStatus;
		for (const listener of this.statusListeners) {
			listener(newStatus);
		}
	}

	private notify(msg: RealtimeMessage<T>): void {
		this.options.onEvent?.(msg);
		if (msg.type === "participant.progress") {
			this.options.onParticipantProgress?.(msg);
		} else if (msg.type === "judge.score") {
			this.options.onJudgeScore?.(msg);
		}

		for (const listener of this.listeners) {
			listener(msg);
		}
	}
}
