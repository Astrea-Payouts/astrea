import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RealtimeClient } from "./realtime-client";
import type { RealtimeConnectionStatus, RealtimeMessage } from "./types";

class MockEventSource {
	public url: string;
	public onopen: (() => void) | null = null;
	public onmessage: ((e: MessageEvent) => void) | null = null;
	public onerror: (() => void) | null = null;
	public closed = false;
	private eventListeners: Map<string, Array<(e: MessageEvent) => void>> =
		new Map();

	constructor(url: string) {
		this.url = url;
	}

	public addEventListener(
		type: string,
		listener: (e: MessageEvent) => void,
	): void {
		if (!this.eventListeners.has(type)) {
			this.eventListeners.set(type, []);
		}
		this.eventListeners.get(type)?.push(listener);
	}

	public removeEventListener(
		type: string,
		listener: (e: MessageEvent) => void,
	): void {
		const list = this.eventListeners.get(type);
		if (list) {
			this.eventListeners.set(
				type,
				list.filter((l) => l !== listener),
			);
		}
	}

	public simulateOpen(): void {
		if (this.onopen) {
			this.onopen();
		}
	}

	public simulateMessage(data: string): void {
		const evt = new MessageEvent("message", { data });
		if (this.onmessage) {
			this.onmessage(evt);
		}
	}

	public simulateTypedEvent(type: string, data: string): void {
		const evt = new MessageEvent(type, { data });
		const listeners = this.eventListeners.get(type);
		if (listeners) {
			for (const listener of listeners) {
				listener(evt);
			}
		}
	}

	public simulateError(): void {
		if (this.onerror) {
			this.onerror();
		}
	}

	public close(): void {
		this.closed = true;
	}
}

describe("RealtimeClient (E04)", () => {
	let activeInstances: MockEventSource[] = [];

	beforeEach(() => {
		vi.useFakeTimers();
		activeInstances = [];
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	function createMockConstructor() {
		return class extends MockEventSource {
			constructor(url: string) {
				super(url);
				activeInstances.push(this);
			}
		} as unknown as typeof EventSource;
	}

	it("initializes with connecting status and transitions to connected on open", () => {
		const statuses: RealtimeConnectionStatus[] = [];
		const client = new RealtimeClient("evt-123", {
			eventSourceConstructor: createMockConstructor(),
		});

		client.onStatusChange((s) => statuses.push(s));
		client.connect();

		expect(statuses).toContain("connecting");
		expect(activeInstances.length).toBe(1);

		activeInstances[0].simulateOpen();
		expect(client.getStatus()).toBe("connected");
		expect(statuses).toContain("connected");

		client.disconnect();
		expect(client.getStatus()).toBe("closed");
	});

	it("parses and notifies on incoming message payloads", () => {
		const received: RealtimeMessage[] = [];
		const client = new RealtimeClient("evt-456", {
			eventSourceConstructor: createMockConstructor(),
			onEvent: (msg) => received.push(msg),
		});

		client.connect();
		activeInstances[0].simulateOpen();

		const payload: RealtimeMessage = {
			type: "participant.progress",
			eventId: "evt-456",
			entityId: "part-789",
			payload: { progress: 80 },
			timestamp: "2026-09-07T00:00:00Z",
		};

		activeInstances[0].simulateMessage(JSON.stringify(payload));

		expect(received.length).toBe(1);
		expect(received[0].type).toBe("participant.progress");
		expect(received[0].entityId).toBe("part-789");

		client.disconnect();
	});

	it("triggers typed callbacks for judge scores specifically", () => {
		let judgeEvent: RealtimeMessage | null = null;
		const client = new RealtimeClient("evt-judge", {
			eventSourceConstructor: createMockConstructor(),
			onJudgeScore: (msg) => {
				judgeEvent = msg;
			},
		});

		client.connect();
		activeInstances[0].simulateOpen();

		const payload: RealtimeMessage = {
			type: "judge.score",
			eventId: "evt-judge",
			entityId: "judge-1",
			payload: { score: 95 },
			timestamp: "2026-09-07T00:00:00Z",
		};

		activeInstances[0].simulateTypedEvent(
			"judge.score",
			JSON.stringify(payload),
		);

		const event = judgeEvent as RealtimeMessage | null;
		expect(event).not.toBeNull();
		expect(event?.type).toBe("judge.score");
		expect(event?.entityId).toBe("judge-1");

		client.disconnect();
	});

	it("gracefully discards malformed JSON payloads without crashing", () => {
		const received: RealtimeMessage[] = [];
		const client = new RealtimeClient("evt-safe", {
			eventSourceConstructor: createMockConstructor(),
			onEvent: (msg) => received.push(msg),
		});

		client.connect();
		activeInstances[0].simulateOpen();

		// Simulate corrupted SSE data
		activeInstances[0].simulateMessage("corrupted-not-json{{{");
		expect(received.length).toBe(0);

		client.disconnect();
	});

	it("reconnects on error and transitions to fallback_polling after max attempts", () => {
		const statuses: RealtimeConnectionStatus[] = [];
		const client = new RealtimeClient("evt-fail", {
			eventSourceConstructor: createMockConstructor(),
			maxReconnectAttempts: 2,
		});

		client.onStatusChange((s) => statuses.push(s));
		client.connect();
		expect(activeInstances.length).toBe(1);

		// Error 1: triggers reconnecting
		activeInstances[0].simulateError();
		expect(client.getStatus()).toBe("reconnecting");

		// Advance timer to trigger 1st reconnect
		vi.advanceTimersByTime(2000);
		expect(activeInstances.length).toBe(2);

		// Error 2: triggers reconnecting
		activeInstances[1].simulateError();
		expect(client.getStatus()).toBe("reconnecting");

		// Advance timer to trigger 2nd reconnect
		vi.advanceTimersByTime(4000);
		expect(activeInstances.length).toBe(3);

		// Error 3: exceeds maxReconnectAttempts (2) -> transitions to fallback_polling
		activeInstances[2].simulateError();
		expect(client.getStatus()).toBe("fallback_polling");

		client.disconnect();
		expect(client.getStatus()).toBe("closed");
	});
});
