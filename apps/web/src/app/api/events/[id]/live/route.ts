import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Route proxy for Real-time tracking SSE (E04).
 * Forwards requests to services/core-go GET /events/{id}/live or yields graceful SSE stream.
 */
export async function GET(
	request: NextRequest,
	context: { params: Promise<{ id: string }> },
) {
	const { id } = await context.params;
	if (!id) {
		return new NextResponse("Missing event id", { status: 400 });
	}

	const coreGoUrl = process.env.CORE_GO_URL || "http://127.0.0.1:8080";
	const targetUrl = `${coreGoUrl}/events/${encodeURIComponent(id)}/live`;

	try {
		const upstreamResponse = await fetch(targetUrl, {
			headers: {
				Accept: "text/event-stream",
			},
			signal: request.signal,
		});

		if (upstreamResponse.ok && upstreamResponse.body) {
			return new Response(upstreamResponse.body, {
				headers: {
					"Content-Type": "text/event-stream",
					"Cache-Control": "no-cache, no-transform",
					Connection: "keep-alive",
					"X-Accel-Buffering": "no",
				},
			});
		}
	} catch {
		// Upstream core-go offline or unreachable; fall back to local readable stream
	}

	// Standalone fallback SSE stream
	const encoder = new TextEncoder();
	const stream = new ReadableStream({
		start(controller) {
			const initialPayload = JSON.stringify({
				status: "connected",
				eventId: id,
				mode: "standalone_fallback",
				timestamp: new Date().toISOString(),
			});
			controller.enqueue(
				encoder.encode(`event: connected\ndata: ${initialPayload}\n\n`),
			);

			const timer = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(": keepalive\n\n"));
				} catch {
					clearInterval(timer);
				}
			}, 15000);

			request.signal.addEventListener("abort", () => {
				clearInterval(timer);
				controller.close();
			});
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache, no-transform",
			Connection: "keep-alive",
			"X-Accel-Buffering": "no",
		},
	});
}
