import { flexRender } from "@tanstack/react-table";
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
import FileUploadDialog from "@/pages/files/components/FileUploadDialog";
import DeleteConfirmDialog from "@/components/dialogs/DeleteConfirmDialog";
import { EmptyState } from "@/pages/info-pages/EmptyState";
import { useFilesPage } from "./hooks/useFilesPage";

export default function FilesPage() {
	const {
		table,
		columnsCount,
		isLoading,
		uploadDialogOpen,
		setUploadDialogOpen,
		deleteDialogOpen,
		setDeleteDialogOpen,
		isUploading,
		isDeleting,
		handleUpload,
		handleDelete,
	} = useFilesPage();

	return (
		<>
			<div className="space-y-6 max-w-[1232px] 2xl-plus:max-w-[70%] 2xl-plus:min-w-[1232px] 2xl-plus:w-[70%] ml-3 mr-6 w-full pt-6">
				<div className="flex justify-end">
					<Button onClick={() => setUploadDialogOpen(true)}>
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
								<TableRow className="transition-none border-0 hover:bg-transparent">
									<TableCell
										colSpan={columnsCount}
										className="px-0 border-0 hover:bg-transparent"
									>
										<EmptyState
											title="No files found"
											description="Upload your first file to get started"
										/>
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</div>
			</div>

			{/* Upload Dialog */}
			<FileUploadDialog
				open={uploadDialogOpen}
				setOpen={setUploadDialogOpen}
				onUpload={handleUpload}
				loading={isUploading}
			/>

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
