import { useEffect, useState } from "react";

let monacoSetup: Promise<unknown> | undefined;
let isMonacoSetupDone = false;

const ensureMonacoSetup = () => {
	if (!monacoSetup) {
		monacoSetup = import("@/lib/monaco-setup").then((setup) => {
			isMonacoSetupDone = true;
			return setup;
		});
	}

	return monacoSetup;
};

/**
 * Pulls monaco in on first use instead of at boot.
 *
 * Both <Editor> and useMonaco() call loader.init() when they mount, and the loader falls
 * back to fetching monaco from a CDN unless loader.config() ran first — so nothing may
 * touch @monaco-editor/react until monaco-setup has resolved.
 *
 * The promise and the flag are module state on purpose: the editor and the diff editor share
 * them, so whichever mounts second sees monaco as already loaded instead of rendering its
 * placeholder for another frame.
 */
export const useMonacoSetup = () => {
	const [isReady, setIsReady] = useState(isMonacoSetupDone);

	useEffect(() => {
		if (isReady) {
			return;
		}

		let cancelled = false;
		ensureMonacoSetup().then(() => {
			if (!cancelled) {
				setIsReady(true);
			}
		});

		return () => {
			cancelled = true;
		};
	}, [isReady]);

	return isReady;
};
