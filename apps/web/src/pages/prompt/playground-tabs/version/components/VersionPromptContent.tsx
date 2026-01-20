import type React from "react";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import MonacoEditor from "@/components/ui/MonacoEditor";
import { ResizeHandle } from "../../playground/components/prompt-editor/components/ResizeHandle";

import { useEditorResize } from "../../playground/components/prompt-editor/hooks/useEditorResize";

interface VersionPromptContentProps {
	content: string;
}

export const VersionPromptContent: React.FC<VersionPromptContentProps> = ({ content }) => {
	const [height, setHeight] = useState(550);

	const { handleResizeStart } = useEditorResize({
		isExpanded: false,
		editorHeight: height,
		setEditorHeight: setHeight,
		minHeight: 550,
	});

	if (!content.trim()) return null;

	return (
		<div>
			<h3 className="text-lg font-semibold text-foreground mb-3">Prompt Content</h3>
			<Card className="rounded-md border border-border shadow-sm overflow-hidden flex flex-col">
				<div style={{ height: `${height}px` }}>
					<MonacoEditor
						value={content}
						language="markdown"
						options={{
							readOnly: true,
							domReadOnly: true,
							folding: true,
							glyphMargin: false,
						}}
					/>
				</div>
				<ResizeHandle
					isExpanded={false}
					onResizeStart={handleResizeStart}
					editorHeight={height}
					minHeight={550}
				/>
			</Card>
		</div>
	);
};
