import { useEffect, useMemo, useRef, useState } from "react";

interface TweenNumberProps {
	value: number;
	className?: string;
	durationMs?: number;
	formatValue?: (value: number) => string;
}

export function TweenNumber({
	value,
	className,
	durationMs = 700,
	formatValue,
}: TweenNumberProps) {
	const [displayValue, setDisplayValue] = useState(value);
	const animationFrameRef = useRef<number | null>(null);
	const lastValueRef = useRef(value);

	useEffect(() => {
		const from = lastValueRef.current;
		const to = value;
		lastValueRef.current = value;

		if (animationFrameRef.current) {
			window.cancelAnimationFrame(animationFrameRef.current);
			animationFrameRef.current = null;
		}

		if (from === to || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			animationFrameRef.current = window.requestAnimationFrame(() => {
				setDisplayValue(to);
				animationFrameRef.current = null;
			});
			return;
		}

		const startTime = performance.now();
		const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

		const tick = (now: number) => {
			const elapsed = now - startTime;
			const progress = Math.min(elapsed / durationMs, 1);
			setDisplayValue(from + (to - from) * easeOutCubic(progress));

			if (progress < 1) {
				animationFrameRef.current = window.requestAnimationFrame(tick);
				return;
			}

			animationFrameRef.current = null;
		};

		animationFrameRef.current = window.requestAnimationFrame(tick);

		return () => {
			if (animationFrameRef.current) {
				window.cancelAnimationFrame(animationFrameRef.current);
				animationFrameRef.current = null;
			}
		};
	}, [durationMs, value]);

	const formattedDisplayValue = useMemo(() => {
		if (formatValue) {
			return formatValue(displayValue);
		}
		return Math.round(displayValue).toLocaleString();
	}, [displayValue, formatValue]);

	return <span className={className}>{formattedDisplayValue}</span>;
}
