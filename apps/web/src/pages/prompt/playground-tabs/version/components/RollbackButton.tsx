import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { useToggle } from "@/hooks/useToggle";
import { Button } from "@/components/ui/button";
import { useParams } from "react-router-dom";
import { toast } from "@/hooks/useToast";
import { useState } from "react";
import { promptApi } from "@/api/prompt";
import { ArrowBendUpLeftIcon } from "@phosphor-icons/react";

export const RollBackButton = () => {
	const { isOn, onToggle, offToggle } = useToggle();
	const [showSuccess, setShowSuccess] = useState(false);
	const [pending, setPending] = useState(false);
	const params = useParams();

	const handleRollback = async () => {
		if (!params.id || !params.versionId) return;
		setPending(true);
		try {
			await promptApi.rollbackVersion(params.id, params.versionId);
			setShowSuccess(true);
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : "Something went wrong";
			toast({
				title: "Rollback failed",
				description: errorMessage,
				variant: "destructive",
			});
		} finally {
			setPending(false);
		}
	};

	const handleClose = () => {
		offToggle();
		setShowSuccess(false);
	};
	return (
		<>
			<Dialog open={isOn} onOpenChange={handleClose}>
				<DialogContent className="min-w-[520px]">
					<DialogHeader>
						<DialogTitle className={showSuccess ? "text-[#2E9D2A]" : ""}>
							{!showSuccess ? "Rollback to this commit?" : "Rollback successfull"}
						</DialogTitle>
					</DialogHeader>

					<p className="text-muted-foreground text-[14px]">
						{!showSuccess ? (
							<>
								Are you sure you want to rollback to this commit?{" "}
								<span className="text-destructive">
									This action cannot be undone.
								</span>
							</>
						) : (
							"Prompt has been rolled back."
						)}
					</p>

					<DialogFooter className="">
						{!showSuccess && (
							<Button variant="outline" disabled={pending} onClick={offToggle}>
								Cancel
							</Button>
						)}
						<Button
							onClick={showSuccess ? handleClose : handleRollback}
							disabled={pending}
							variant={showSuccess ? "default" : "destructive"}
						>
							{showSuccess ? "Ok" : "Yes, rollback"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<div className="flex justify-end">
				<Button
					variant="outline"
					onClick={onToggle}
					className="border-border text-foreground font-normal px-8"
				>
					<ArrowBendUpLeftIcon className="mr-2 h-4 w-4" />
					Rollback
				</Button>
			</div>
		</>
	);
};
