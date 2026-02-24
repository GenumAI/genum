import { useEffect, useRef, useState } from "react";

interface Options {
	delayMs?: number;
	minVisibleMs?: number;
}

export function useSkeletonVisibility(
	isLoading: boolean,
	{ delayMs = 200, minVisibleMs = 400 }: Options = {},
) {
	const [isVisible, setIsVisible] = useState(false);
	const showTimerRef = useRef<number | null>(null);
	const hideTimerRef = useRef<number | null>(null);
	const shownAtRef = useRef<number | null>(null);
	const isLoadingRef = useRef(isLoading);

	useEffect(() => {
		isLoadingRef.current = isLoading;
	}, [isLoading]);

	useEffect(() => {
		if (isLoading) {
			if (hideTimerRef.current) {
				window.clearTimeout(hideTimerRef.current);
				hideTimerRef.current = null;
			}

			if (!isVisible && !showTimerRef.current) {
				showTimerRef.current = window.setTimeout(() => {
					if (!isLoadingRef.current) {
						showTimerRef.current = null;
						return;
					}

					setIsVisible(true);
					shownAtRef.current = Date.now();
					showTimerRef.current = null;
				}, delayMs);
			}

			return;
		}

		if (showTimerRef.current) {
			window.clearTimeout(showTimerRef.current);
			showTimerRef.current = null;
		}

		if (!isVisible) {
			return;
		}

		const elapsed = shownAtRef.current ? Date.now() - shownAtRef.current : 0;
		const remaining = Math.max(minVisibleMs - elapsed, 0);

		hideTimerRef.current = window.setTimeout(() => {
			setIsVisible(false);
			shownAtRef.current = null;
			hideTimerRef.current = null;
		}, remaining);
	}, [delayMs, isLoading, isVisible, minVisibleMs]);

	useEffect(() => {
		return () => {
			if (showTimerRef.current) {
				window.clearTimeout(showTimerRef.current);
			}
			if (hideTimerRef.current) {
				window.clearTimeout(hideTimerRef.current);
			}
		};
	}, []);

	return isVisible;
}
