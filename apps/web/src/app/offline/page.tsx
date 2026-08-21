"use client";

import Link from "next/link";
import { WifiOff, RefreshCw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function OfflinePage() {
	return (
		<main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
			<div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md">
				<WifiOff className="h-10 w-10 text-neutral-400" />
			</div>

			<h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
				You&apos;re offline
			</h1>

			<p className="mt-3 max-w-md text-sm text-neutral-400">
				Astrea needs an active internet connection to load new data. Previously cached pages and the app shell remain accessible.
			</p>

			<div className="mt-8 flex flex-wrap items-center justify-center gap-3">
				<Button
					onClick={() => {
						if (typeof window !== "undefined") {
							window.location.reload();
						}
					}}
					variant="outline"
					className="border-white/10 hover:bg-white/5 text-white"
				>
					<RefreshCw className="mr-2 h-4 w-4" />
					Retry connection
				</Button>

				<Link
					href="/"
					className={cn(
						buttonVariants({ variant: "default" }),
						"bg-white text-black hover:bg-neutral-200"
					)}
				>
					Return home
				</Link>
			</div>
		</main>
	);
}
