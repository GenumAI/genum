import { flexRender } from "@tanstack/react-table";
import { useRef } from "react";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import DeleteConfirmDialog from "@/components/dialogs/DeleteConfirmDialog";
import FileDropzone from "@/pages/files/components/FileDropzone";
import { useFilesPage } from "./hooks/useFilesPage";

export default function FilesPage() {
	const {
		table,
		columnsCount,
		isLoading,
		deleteDialogOpen,
		setDeleteDialogOpen,
		isUploading,
		isDeleting,
		handleUpload,
		handleDelete,
	} = useFilesPage();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleManualFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) {
			return;
		}

		await handleUpload(file);
		e.target.value = "";
	};

	return (
		<>
			<div className="space-y-6 max-w-[1232px] 2xl-plus:max-w-[70%] 2xl-plus:min-w-[1232px] 2xl-plus:w-[70%] ml-3 mr-6 w-full pt-6">
				<input
					ref={fileInputRef}
					type="file"
					accept="image/*,application/pdf"
					onChange={(e) => {
						void handleManualFileSelect(e);
					}}
					className="hidden"
				/>

				<div className="flex justify-end">
					<Button onClick={() => fileInputRef.current?.click()}>
						<Plus className="h-4 w-4 mr-2" />
						Add File
					</Button>
				</div>

				<div className="rounded-md overflow-hidden">
					<Table>
						<TableHeader className="bg-muted text-muted-foreground text-sm font-medium leading-5 h-[54px]">
							{table.getHeaderGroups().map((headerGroup) => (
								<TableRow
									key={headerGroup.id}
									className="[&_th:first-child]:text-left [&_th:last-child]:text-right"
								>
									{headerGroup.headers.map((header) => (
										<TableHead
											key={header.id}
											className="h-auto py-[16px] px-[14px] whitespace-nowrap"
										>
											<div
												className={
													header.column.id === "name"
														? "w-full text-left"
														: "flex items-center justify-center w-full"
												}
											>
												{flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
											</div>
										</TableHead>
									))}
								</TableRow>
							))}
						</TableHeader>
						<TableBody>
							{isLoading ? (
								<TableRow>
									<TableCell colSpan={columnsCount} className="text-center py-8">
										Loading...
									</TableCell>
								</TableRow>
							) : table.getRowModel().rows.length > 0 ? (
								table.getRowModel().rows.map((row) => (
									<TableRow
										key={row.id}
										className="[&_td:first-child]:text-left [&_td:last-child]:text-right"
									>
										{row.getVisibleCells().map((cell) => (
											<TableCell key={cell.id} className="text-left">
												<div
													className={
														cell.column.id === "name"
															? "w-full text-left"
															: "flex items-center justify-center w-full"
													}
												>
													{flexRender(
														cell.column.columnDef.cell,
														cell.getContext(),
													)}
												</div>
											</TableCell>
										))}
									</TableRow>
								))
							) : (
								<TableRow className="border-0 hover:bg-transparent">
									<TableCell
										colSpan={columnsCount}
										className="border-0 px-0 pt-4 pb-0 hover:bg-transparent"
									>
										<FileDropzone
											onUpload={handleUpload}
											loading={isUploading}
											className="w-full rounded-none border-x-0 border-b-0 border-t-0"
											title="No files found"
											description="Click to upload or drag and drop"
											helperText="Images and PDF files only (max 50MB)"
											largeCopy={true}
											minHeight="520px"
										/>
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</div>
			</div>

			{/* Delete Confirmation Dialog */}
			<DeleteConfirmDialog
				open={deleteDialogOpen}
				setOpen={setDeleteDialogOpen}
				confirmationHandler={handleDelete}
				loading={isDeleting}
			/>
		</>
	);
}
