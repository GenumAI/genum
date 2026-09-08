import { loader } from "@monaco-editor/react";

// edcore.main is the editor plus all of its contributions -- find, multi-cursor, folding,
// word/line operations, suggest. Importing the narrower editor.api instead would drop those
// and quietly cost the prompt editor Ctrl+F and word navigation.
//
// The basic-languages registry is only its 83 *.contribution.js stubs (~78 KB, mostly license
// banners); each grammar itself stays behind a `loader: () => import(...)`, so the 698 KB of
// actual grammars is still fetched one language at a time. It is registered in full rather than
// per-language because markdown embeds whatever a fenced block names -- markdown.js resolves
// ```python and friends through `nextEmbedded`, so a narrower list silently renders fenced code
// blocks as plain text in the main prompt editor.
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import "monaco-editor/esm/vs/editor/edcore.main";
import "monaco-editor/esm/vs/language/json/monaco.contribution";
import "monaco-editor/esm/vs/basic-languages/monaco.contribution";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";

self.MonacoEnvironment = {
	getWorker(_, label) {
		if (label === "json") {
			return new jsonWorker();
		}
		return new editorWorker();
	},
};

loader.config({ monaco });
