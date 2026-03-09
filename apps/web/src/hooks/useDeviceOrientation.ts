import { useEffect, useState } from "react";

export const useDeviceOrientation = () => {
	const [isMobile, setIsMobile] = useState(false);
	const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");

	useEffect(() => {
		const checkIsMobile = () => {
			const userAgent = navigator.userAgent;
			const mobileRegex = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
			return mobileRegex.test(userAgent);
		};

		const getOrientation = () => {
			return window.matchMedia("(orientation: portrait)").matches ? "portrait" : "landscape";
		};

		const handleChange = () => {
			setIsMobile(checkIsMobile());
			setOrientation(getOrientation());
		};

		handleChange();

		const mql = window.matchMedia("(orientation: portrait)");
		mql.addEventListener("change", handleChange);
		window.addEventListener("resize", handleChange);

		return () => {
			mql.removeEventListener("change", handleChange);
			window.removeEventListener("resize", handleChange);
		};
	}, []);
	return { isMobile, orientation };
};
