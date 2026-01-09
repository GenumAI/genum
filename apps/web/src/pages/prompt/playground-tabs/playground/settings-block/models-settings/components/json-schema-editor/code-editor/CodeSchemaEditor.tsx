import MonacoEditor from "@/components/ui/MonacoEditor";

interface CodeSchemaEditorProps {
	code: string;
	onChange: (value: string | undefined) => void;
	onEditorMount?: (editor: any) => void;
	height?: string;
}

const CodeSchemaEditor = ({ code, onChange, onEditorMount, height = "500px" }: CodeSchemaEditorProps) => {
	return (
		<MonacoEditor
			height={height}
			defaultLanguage="json"
			value={code}
			onChange={onChange}
			onMount={onEditorMount}
			options={{
				lineNumbers: "on",
				minimap: { enabled: false },
				scrollBeyondLastLine: false,
				automaticLayout: true,
			}}
			ariaLabel="JSON Schema Code Editor"
		/>
	);
};

export default CodeSchemaEditor;
