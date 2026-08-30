"use client";

import { gsap } from "gsap";
import Image from "next/image";
import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import "./staggered-menu.css";

// Adapted from React Bits' Staggered Menu (reactbits.dev/components/staggered-menu),
// verified against its live source/props table before porting — see docs/ui-motion.md
// for why this replaces the plain hamburger in the mobile PWA shell. Animation/timeline
// logic is unchanged from the live source; the only additions are:
//   - openAriaLabel/closeAriaLabel/menuLabel/closeLabel props, so the toggle's aria-label
//     and visible cycling text ("Menu"/"Close") can be localized via next-intl instead of
//     hardcoded English literals.
//   - a panelExtra slot rendered inside the panel, to host Astrea's own controls
//     (language switcher, wallet connect) that don't fit the component's items/socials
//     shape.
export interface StaggeredMenuItem {
	label: string;
	ariaLabel: string;
	link: string;
}

export interface StaggeredMenuSocialItem {
	label: string;
	link: string;
}

export interface StaggeredMenuProps {
	position?: "left" | "right";
	colors?: string[];
	items?: StaggeredMenuItem[];
	socialItems?: StaggeredMenuSocialItem[];
	displaySocials?: boolean;
	displayItemNumbering?: boolean;
	className?: string;
	logoUrl?: string;
	menuButtonColor?: string;
	openMenuButtonColor?: string;
	accentColor?: string;
	changeMenuColorOnOpen?: boolean;
	closeOnClickAway?: boolean;
	onMenuOpen?: () => void;
	onMenuClose?: () => void;
	isFixed?: boolean;
	openAriaLabel?: string;
	closeAriaLabel?: string;
	menuLabel?: string;
	closeLabel?: string;
	panelExtra?: React.ReactNode;
}

export const StaggeredMenu: React.FC<StaggeredMenuProps> = ({
	position = "right",
	colors = ["#B497CF", "#5227FF"],
	items = [],
	socialItems = [],
	displaySocials = true,
	displayItemNumbering = true,
	className,
	logoUrl = "/src/assets/logos/reactbits-gh-white.svg",
	menuButtonColor = "#fff",
	openMenuButtonColor = "#fff",
	changeMenuColorOnOpen = true,
	accentColor = "#5227FF",
	isFixed = false,
	closeOnClickAway = true,
	onMenuOpen,
	onMenuClose,
	openAriaLabel = "Open menu",
	closeAriaLabel = "Close menu",
	menuLabel = "Menu",
	closeLabel = "Close",
	panelExtra,
}: StaggeredMenuProps) => {
	const [open, setOpen] = useState(false);
	const openRef = useRef(false);
	const panelRef = useRef<HTMLDivElement | null>(null);
	const preLayersRef = useRef<HTMLDivElement | null>(null);
	const preLayerElsRef = useRef<HTMLElement[]>([]);
	const plusHRef = useRef<HTMLSpanElement | null>(null);
	const plusVRef = useRef<HTMLSpanElement | null>(null);
	const iconRef = useRef<HTMLSpanElement | null>(null);
	const textInnerRef = useRef<HTMLSpanElement | null>(null);
	const textWrapRef = useRef<HTMLSpanElement | null>(null);
	const [textLines, setTextLines] = useState<string[]>([menuLabel, closeLabel]);

	const openTlRef = useRef<gsap.core.Timeline | null>(null);
	const closeTweenRef = useRef<gsap.core.Tween | null>(null);
	const spinTweenRef = useRef<gsap.core.Tween | null>(null);
	const textCycleAnimRef = useRef<gsap.core.Tween | null>(null);
	const colorTweenRef = useRef<gsap.core.Tween | null>(null);
	const toggleBtnRef = useRef<HTMLButtonElement | null>(null);
	const busyRef = useRef(false);
	const itemEntranceTweenRef = useRef<gsap.core.Tween | null>(null);

	useLayoutEffect(() => {
		const ctx = gsap.context(() => {
			const panel = panelRef.current;
			const preContainer = preLayersRef.current;
			const plusH = plusHRef.current;
			const plusV = plusVRef.current;
			const icon = iconRef.current;
			const textInner = textInnerRef.current;
			if (!panel || !plusH || !plusV || !icon || !textInner) return;

			let preLayers: HTMLElement[] = [];
			if (preContainer) {
				preLayers = Array.from(
					preContainer.querySelectorAll(".sm-prelayer"),
				) as HTMLElement[];
			}
			preLayerElsRef.current = preLayers;

			const offscreen = position === "left" ? -100 : 100;
			gsap.set([panel, ...preLayers], { xPercent: offscreen, opacity: 1 });
			if (preContainer) {
				gsap.set(preContainer, { xPercent: 0, opacity: 1 });
			}
			gsap.set(plusH, { transformOrigin: "50% 50%", rotate: 0 });
			gsap.set(plusV, { transformOrigin: "50% 50%", rotate: 90 });
			gsap.set(icon, { rotate: 0, transformOrigin: "50% 50%" });
			gsap.set(textInner, { yPercent: 0 });
			if (toggleBtnRef.current)
				gsap.set(toggleBtnRef.current, { color: menuButtonColor });
		});
		return () => ctx.revert();
	}, [menuButtonColor, position]);

	const buildOpenTimeline = useCallback(() => {
		const panel = panelRef.current;
		const layers = preLayerElsRef.current;
		if (!panel) return null;

		openTlRef.current?.kill();
		if (closeTweenRef.current) {
			closeTweenRef.current.kill();
			closeTweenRef.current = null;
		}
		itemEntranceTweenRef.current?.kill();

		const itemEls = Array.from(
			panel.querySelectorAll(".sm-panel-itemLabel"),
		) as HTMLElement[];
		const numberEls = Array.from(
			panel.querySelectorAll(".sm-panel-list[data-numbering] .sm-panel-item"),
		) as HTMLElement[];
		const socialTitle = panel.querySelector(
			".sm-socials-title",
		) as HTMLElement | null;
		const socialLinks = Array.from(
			panel.querySelectorAll(".sm-socials-link"),
		) as HTMLElement[];

		const offscreen = position === "left" ? -100 : 100;
		const layerStates = layers.map((el) => ({ el, start: offscreen }));
		const panelStart = offscreen;

		if (itemEls.length) {
			gsap.set(itemEls, { yPercent: 140, rotate: 10 });
		}
		if (numberEls.length) {
			gsap.set(numberEls, { "--sm-num-opacity": 0 });
		}
		if (socialTitle) {
			gsap.set(socialTitle, { opacity: 0 });
		}
		if (socialLinks.length) {
			gsap.set(socialLinks, { y: 25, opacity: 0 });
		}

		const tl = gsap.timeline({ paused: true });

		layerStates.forEach((ls, i) => {
			tl.fromTo(
				ls.el,
				{ xPercent: ls.start },
				{ xPercent: 0, duration: 0.5, ease: "power4.out" },
				i * 0.07,
			);
		});
		const lastTime = layerStates.length ? (layerStates.length - 1) * 0.07 : 0;
		const panelInsertTime = lastTime + (layerStates.length ? 0.08 : 0);
		const panelDuration = 0.65;
		tl.fromTo(
			panel,
			{ xPercent: panelStart },
			{ xPercent: 0, duration: panelDuration, ease: "power4.out" },
			panelInsertTime,
		);

		if (itemEls.length) {
			const itemsStartRatio = 0.15;
			const itemsStart = panelInsertTime + panelDuration * itemsStartRatio;
			tl.to(
				itemEls,
				{
					yPercent: 0,
					rotate: 0,
					duration: 1,
					ease: "power4.out",
					stagger: { each: 0.1, from: "start" },
				},
				itemsStart,
			);
			if (numberEls.length) {
				tl.to(
					numberEls,
					{
						duration: 0.6,
						ease: "power2.out",
						"--sm-num-opacity": 1,
						stagger: { each: 0.08, from: "start" },
					},
					itemsStart + 0.1,
				);
			}
		}

		if (socialTitle || socialLinks.length) {
			const socialsStart = panelInsertTime + panelDuration * 0.4;
			if (socialTitle) {
				tl.to(
					socialTitle,
					{
						opacity: 1,
						duration: 0.5,
						ease: "power2.out",
					},
					socialsStart,
				);
			}
			if (socialLinks.length) {
				tl.to(
					socialLinks,
					{
						y: 0,
						opacity: 1,
						duration: 0.55,
						ease: "power3.out",
						stagger: { each: 0.08, from: "start" },
						onComplete: () => {
							gsap.set(socialLinks, { clearProps: "opacity" });
						},
					},
					socialsStart + 0.04,
				);
			}
		}

		openTlRef.current = tl;
		return tl;
	}, [position]);

	const playOpen = useCallback(() => {
		if (busyRef.current) return;
		busyRef.current = true;
		const tl = buildOpenTimeline();
		if (tl) {
			tl.eventCallback("onComplete", () => {
				busyRef.current = false;
			});
			tl.play(0);
		} else {
			busyRef.current = false;
		}
	}, [buildOpenTimeline]);

	const playClose = useCallback(() => {
		openTlRef.current?.kill();
		openTlRef.current = null;
		itemEntranceTweenRef.current?.kill();

		const panel = panelRef.current;
		const layers = preLayerElsRef.current;
		if (!panel) return;

		const all: HTMLElement[] = [...layers, panel];
		closeTweenRef.current?.kill();
		const offscreen = position === "left" ? -100 : 100;
		closeTweenRef.current = gsap.to(all, {
			xPercent: offscreen,
			duration: 0.32,
			ease: "power3.in",
			overwrite: "auto",
			onComplete: () => {
				const itemEls = Array.from(
					panel.querySelectorAll(".sm-panel-itemLabel"),
				) as HTMLElement[];
				if (itemEls.length) {
					gsap.set(itemEls, { yPercent: 140, rotate: 10 });
				}
				const numberEls = Array.from(
					panel.querySelectorAll(
						".sm-panel-list[data-numbering] .sm-panel-item",
					),
				) as HTMLElement[];
				if (numberEls.length) {
					gsap.set(numberEls, { "--sm-num-opacity": 0 });
				}
				const socialTitle = panel.querySelector(
					".sm-socials-title",
				) as HTMLElement | null;
				const socialLinks = Array.from(
					panel.querySelectorAll(".sm-socials-link"),
				) as HTMLElement[];
				if (socialTitle) gsap.set(socialTitle, { opacity: 0 });
				if (socialLinks.length) gsap.set(socialLinks, { y: 25, opacity: 0 });
				busyRef.current = false;
			},
		});
	}, [position]);

	const animateIcon = useCallback((opening: boolean) => {
		const icon = iconRef.current;
		if (!icon) return;
		spinTweenRef.current?.kill();
		if (opening) {
			spinTweenRef.current = gsap.to(icon, {
				rotate: 225,
				duration: 0.8,
				ease: "power4.out",
				overwrite: "auto",
			});
		} else {
			spinTweenRef.current = gsap.to(icon, {
				rotate: 0,
				duration: 0.35,
				ease: "power3.inOut",
				overwrite: "auto",
			});
		}
	}, []);

	const animateColor = useCallback(
		(opening: boolean) => {
			const btn = toggleBtnRef.current;
			if (!btn) return;
			colorTweenRef.current?.kill();
			if (changeMenuColorOnOpen) {
				const targetColor = opening ? openMenuButtonColor : menuButtonColor;
				colorTweenRef.current = gsap.to(btn, {
					color: targetColor,
					delay: 0.18,
					duration: 0.3,
					ease: "power2.out",
				});
			} else {
				gsap.set(btn, { color: menuButtonColor });
			}
		},
		[openMenuButtonColor, menuButtonColor, changeMenuColorOnOpen],
	);

	React.useEffect(() => {
		if (toggleBtnRef.current) {
			if (changeMenuColorOnOpen) {
				const targetColor = openRef.current
					? openMenuButtonColor
					: menuButtonColor;
				gsap.set(toggleBtnRef.current, { color: targetColor });
			} else {
				gsap.set(toggleBtnRef.current, { color: menuButtonColor });
			}
		}
	}, [changeMenuColorOnOpen, menuButtonColor, openMenuButtonColor]);

	const animateText = useCallback(
		(opening: boolean) => {
			const inner = textInnerRef.current;
			if (!inner) return;
			textCycleAnimRef.current?.kill();

			const currentLabel = opening ? menuLabel : closeLabel;
			const targetLabel = opening ? closeLabel : menuLabel;
			const cycles = 3;
			const seq: string[] = [currentLabel];
			let last = currentLabel;
			for (let i = 0; i < cycles; i++) {
				last = last === menuLabel ? closeLabel : menuLabel;
				seq.push(last);
			}
			if (last !== targetLabel) seq.push(targetLabel);
			seq.push(targetLabel);
			setTextLines(seq);

			gsap.set(inner, { yPercent: 0 });
			const lineCount = seq.length;
			const finalShift = ((lineCount - 1) / lineCount) * 100;
			textCycleAnimRef.current = gsap.to(inner, {
				yPercent: -finalShift,
				duration: 0.5 + lineCount * 0.07,
				ease: "power4.out",
			});
		},
		[menuLabel, closeLabel],
	);

	const toggleMenu = useCallback(() => {
		const target = !openRef.current;
		openRef.current = target;
		setOpen(target);
		if (target) {
			onMenuOpen?.();
			playOpen();
		} else {
			onMenuClose?.();
			playClose();
		}
		animateIcon(target);
		animateColor(target);
		animateText(target);
	}, [
		playOpen,
		playClose,
		animateIcon,
		animateColor,
		animateText,
		onMenuOpen,
		onMenuClose,
	]);

	const closeMenu = useCallback(() => {
		if (openRef.current) {
			openRef.current = false;
			setOpen(false);
			onMenuClose?.();
			playClose();
			animateIcon(false);
			animateColor(false);
			animateText(false);
		}
	}, [playClose, animateIcon, animateColor, animateText, onMenuClose]);

	React.useEffect(() => {
		if (!closeOnClickAway || !open) return;

		const handleClickOutside = (event: MouseEvent) => {
			if (
				panelRef.current &&
				!panelRef.current.contains(event.target as Node) &&
				toggleBtnRef.current &&
				!toggleBtnRef.current.contains(event.target as Node)
			) {
				closeMenu();
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [closeOnClickAway, open, closeMenu]);

	const wrapperClassName = [
		className,
		"staggered-menu-wrapper",
		isFixed ? "fixed-wrapper" : null,
	]
		.filter(Boolean)
		.join(" ");

	return (
		<div
			className={wrapperClassName}
			style={
				accentColor
					? ({ ["--sm-accent" as string]: accentColor } as React.CSSProperties)
					: undefined
			}
			data-position={position}
			data-open={open || undefined}
		>
			<div ref={preLayersRef} className="sm-prelayers" aria-hidden="true">
				{(() => {
					const raw = colors?.length
						? colors.slice(0, 4)
						: ["#1e1e22", "#35353c"];
					const arr = [...raw];
					if (arr.length >= 3) {
						const mid = Math.floor(arr.length / 2);
						arr.splice(mid, 1);
					}
					return arr.map((c, i) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: fixed-length (<=4) decorative array, callers may legitimately repeat a color
							key={`${c}-${i}`}
							className="sm-prelayer"
							style={{ background: c }}
						/>
					));
				})()}
			</div>
			<header className="staggered-menu-header">
				<div className="sm-logo">
					<Image
						src={logoUrl || "/src/assets/logos/reactbits-gh-white.svg"}
						alt="Logo"
						className="sm-logo-img"
						draggable={false}
						width={110}
						height={24}
						priority
					/>
				</div>
				<button
					ref={toggleBtnRef}
					className="sm-toggle"
					aria-label={open ? closeAriaLabel : openAriaLabel}
					aria-expanded={open}
					aria-controls="staggered-menu-panel"
					onClick={toggleMenu}
					type="button"
				>
					<span
						ref={textWrapRef}
						className="sm-toggle-textWrap"
						aria-hidden="true"
					>
						<span ref={textInnerRef} className="sm-toggle-textInner">
							{textLines.map((l, i) => (
								<span
									className="sm-toggle-line"
									// biome-ignore lint/suspicious/noArrayIndexKey: the cycle intentionally repeats "Menu"/"Close", a content-based key would collide
									key={i}
								>
									{l}
								</span>
							))}
						</span>
					</span>
					<span ref={iconRef} className="sm-icon" aria-hidden="true">
						<span ref={plusHRef} className="sm-icon-line" />
						<span ref={plusVRef} className="sm-icon-line sm-icon-line-v" />
					</span>
				</button>
			</header>

			<aside
				id="staggered-menu-panel"
				ref={panelRef}
				className="staggered-menu-panel"
				aria-hidden={!open}
			>
				<div className="sm-panel-inner">
					<ul
						className="sm-panel-list"
						data-numbering={displayItemNumbering || undefined}
					>
						{items?.length ? (
							items.map((it, idx) => (
								<li className="sm-panel-itemWrap" key={it.link}>
									<a
										className="sm-panel-item"
										href={it.link}
										aria-label={it.ariaLabel}
										data-index={idx + 1}
									>
										<span className="sm-panel-itemLabel">{it.label}</span>
									</a>
								</li>
							))
						) : (
							<li className="sm-panel-itemWrap" aria-hidden="true">
								<span className="sm-panel-item">
									<span className="sm-panel-itemLabel">No items</span>
								</span>
							</li>
						)}
					</ul>
					{panelExtra && <div className="sm-panel-extra">{panelExtra}</div>}
					{displaySocials && socialItems && socialItems.length > 0 && (
						<div className="sm-socials">
							<h3 className="sm-socials-title">Socials</h3>
							<ul className="sm-socials-list">
								{socialItems.map((s) => (
									<li key={s.link} className="sm-socials-item">
										<a
											href={s.link}
											target="_blank"
											rel="noopener noreferrer"
											className="sm-socials-link"
										>
											{s.label}
										</a>
									</li>
								))}
							</ul>
						</div>
					)}
				</div>
			</aside>
		</div>
	);
};

export default StaggeredMenu;
