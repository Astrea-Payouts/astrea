"use client";

import { Mesh, Program, Renderer, Triangle } from "ogl";
import type React from "react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface SpecularButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	children: React.ReactNode;
	className?: string;
	intensity?: number;
}

export function SpecularButton({
	children,
	className,
	intensity = 1.0,
	onClick,
	...props
}: SpecularButtonProps) {
	const containerRef = useRef<HTMLButtonElement>(null);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);

	useEffect(() => {
		const button = containerRef.current;
		if (!button) return;

		let renderer: Renderer | null = null;
		let animationFrameId: number;

		try {
			const dpr = Math.min(2, window.devicePixelRatio || 1);
			renderer = new Renderer({
				dpr,
				alpha: true,
				antialias: false,
			});
			const gl = renderer.gl;
			canvasRef.current = gl.canvas;

			Object.assign(gl.canvas.style, {
				position: "absolute",
				inset: "0",
				width: "100%",
				height: "100%",
				pointerEvents: "none",
				borderRadius: "inherit",
				zIndex: "1",
			});
			button.appendChild(gl.canvas);

			const vertex = /* glsl */ `
				attribute vec2 position;
				varying vec2 vUv;
				void main() {
					vUv = position * 0.5 + 0.5;
					gl_Position = vec4(position, 0.0, 1.0);
				}
			`;

			const fragment = /* glsl */ `
				precision highp float;
				varying vec2 vUv;
				uniform vec2 uResolution;
				uniform vec2 uMouse;
				uniform float uHover;
				uniform float uIntensity;

				void main() {
					vec2 st = gl_FragCoord.xy / uResolution.xy;
					vec2 mouseNorm = uMouse / uResolution.xy;
					mouseNorm.y = 1.0 - mouseNorm.y;

					float dist = distance(st, mouseNorm);
					float specular = smoothstep(0.4, 0.0, dist) * uHover * uIntensity;
					
					// Border shine
					float edgeX = min(st.x, 1.0 - st.x);
					float edgeY = min(st.y, 1.0 - st.y);
					float edge = min(edgeX, edgeY) * 2.0;
					float edgeGlow = (1.0 - smoothstep(0.0, 0.08, edge)) * 0.4 * uHover;

					vec3 color = vec3(0.9, 0.95, 1.0) * (specular * 1.5 + edgeGlow);
					float alpha = clamp(specular * 0.8 + edgeGlow * 0.5, 0.0, 0.85);

					gl_FragColor = vec4(color, alpha);
				}
			`;

			const geometry = new Triangle(gl);
			const program = new Program(gl, {
				vertex,
				fragment,
				uniforms: {
					uResolution: { value: new Float32Array([100, 100]) },
					uMouse: { value: new Float32Array([50, 50]) },
					uHover: { value: 0 },
					uIntensity: { value: intensity },
				},
				transparent: true,
			});

			const mesh = new Mesh(gl, { geometry, program });

			const updateSize = () => {
				const rect = button.getBoundingClientRect();
				const width = Math.max(1, rect.width);
				const height = Math.max(1, rect.height);
				renderer?.setSize(width, height);
				program.uniforms.uResolution.value[0] = gl.drawingBufferWidth;
				program.uniforms.uResolution.value[1] = gl.drawingBufferHeight;
			};

			const resizeObserver = new ResizeObserver(updateSize);
			resizeObserver.observe(button);
			updateSize();

			let currentHover = 0;
			let targetHover = 0;
			let targetMouseX = 50;
			let targetMouseY = 50;
			let currentMouseX = 50;
			let currentMouseY = 50;

			const onPointerMove = (e: PointerEvent) => {
				const rect = button.getBoundingClientRect();
				targetMouseX = (e.clientX - rect.left) * dpr;
				targetMouseY = (e.clientY - rect.top) * dpr;
				targetHover = 1.0;
			};

			const onPointerLeave = () => {
				targetHover = 0.0;
			};

			button.addEventListener("pointermove", onPointerMove);
			button.addEventListener("pointerleave", onPointerLeave);

			const render = () => {
				currentHover += (targetHover - currentHover) * 0.15;
				currentMouseX += (targetMouseX - currentMouseX) * 0.2;
				currentMouseY += (targetMouseY - currentMouseY) * 0.2;

				program.uniforms.uHover.value = currentHover;
				program.uniforms.uMouse.value[0] = currentMouseX;
				program.uniforms.uMouse.value[1] = currentMouseY;

				renderer?.render({ scene: mesh });
				animationFrameId = requestAnimationFrame(render);
			};

			render();

			return () => {
				cancelAnimationFrame(animationFrameId);
				resizeObserver.disconnect();
				button.removeEventListener("pointermove", onPointerMove);
				button.removeEventListener("pointerleave", onPointerLeave);
				if (canvasRef.current && canvasRef.current.parentElement === button) {
					button.removeChild(canvasRef.current);
				}
			};
		} catch (e) {
			console.warn("SpecularButton WebGL initialization skipped:", e);
		}
	}, [intensity]);

	return (
		<button
			ref={containerRef}
			type="button"
			onClick={onClick}
			className={cn(
				"relative isolate inline-flex items-center justify-center overflow-hidden rounded-full font-medium transition-all duration-300",
				"bg-gradient-to-r from-blue-600 via-indigo-500 to-sky-400 px-7 py-3 text-sm text-white shadow-lg shadow-blue-500/25",
				"hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98]",
				className,
			)}
			{...props}
		>
			<span className="relative z-10 flex items-center gap-2">{children}</span>
		</button>
	);
}
