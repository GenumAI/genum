import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAccountClosure } from "@/hooks/useAccountClosure";

/**
 * Seconds the confirm button stays disabled after the dialog opens.
 *
 * The countdown is not decoration. Closing an account is irreversible and has no
 * grace period, so the only place to put a pause is before the click.
 */
const COUNTDOWN_SECONDS = 7;

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onClosed: () => void;
};

/**
 * The body is mounted only while the dialog is open, so every open starts from
 * fresh state -- the countdown, the checkbox and the password field all reset
 * because the component is new, not because an effect wrote over them. A dialog
 * reopened after a refusal must never arrive already confirmable.
 */
export function CloseAccountDialog({ open, onOpenChange, onClosed }: Props) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[520px]">
				{open && <CloseAccountBody onOpenChange={onOpenChange} onClosed={onClosed} />}
			</DialogContent>
		</Dialog>
	);
}

function CloseAccountBody({ onOpenChange, onClosed }: Omit<Props, "open">) {
	const { preview, isLoadingPreview, previewFailed, needsPassword, isClosing, error, close } =
		useAccountClosure(true);

	const [acknowledged, setAcknowledged] = useState(false);
	const [password, setPassword] = useState("");
	const [remaining, setRemaining] = useState(COUNTDOWN_SECONDS);

	useEffect(() => {
		const tick = setInterval(() => {
			setRemaining((left) => (left <= 1 ? 0 : left - 1));
		}, 1000);
		return () => clearInterval(tick);
	}, []);

	const refusal = preview?.status === "refused" ? preview : null;

	const blocked = useMemo(() => {
		if (refusal || isLoadingPreview || previewFailed || isClosing) return true;
		if (remaining > 0) return true;
		if (!acknowledged) return true;
		if (needsPassword && password.length === 0) return true;
		return false;
	}, [
		refusal,
		isLoadingPreview,
		previewFailed,
		isClosing,
		remaining,
		acknowledged,
		needsPassword,
		password,
	]);

	const handleConfirm = async () => {
		const outcome = await close(needsPassword ? password : undefined);
		if (outcome?.status === "closed") {
			onClosed();
		}
	};

	return (
		<>
			<DialogHeader>
				<DialogTitle>Close your account</DialogTitle>
				<DialogDescription>
					This is permanent. There is no grace period and no way to undo it.
				</DialogDescription>
			</DialogHeader>

			{isLoadingPreview ? (
				<p className="text-sm text-muted-foreground">Checking what this would delete…</p>
			) : previewFailed ? (
				<p className="text-sm text-destructive">
					We could not check what closing this account would delete, so the confirmation
					is unavailable. Try again shortly.
				</p>
			) : refusal ? (
				// The service's own words. "Transfer ownership of Acme first" tells
				// someone what to do; "something went wrong" does not.
				<p className="text-sm text-destructive">{refusal.detail}</p>
			) : (
				<div className="space-y-3 text-sm">
					<p className="text-foreground">Closing your account will:</p>
					<ul className="list-disc space-y-1 pl-5 text-muted-foreground">
						<li>anonymise your profile — your name and email are replaced</li>
						<li>delete your sign-in credentials and every active session</li>
						<li>delete your prompt chats and your notification history</li>
						{preview?.status === "erasable" && !preview.labOnly && (
							<li>
								close your account in every connected system and remove your sign-in
								identities
							</li>
						)}
					</ul>
					<p className="text-muted-foreground">
						Prompts, versions and project API keys that belong to an organization stay,
						attributed to a deleted user, so your team does not lose work.
					</p>
					{preview?.status === "erasable" && preview.alreadyErased && (
						<p className="text-muted-foreground">
							This account was already closed; running it again finishes any step that
							did not complete.
						</p>
					)}
				</div>
			)}

			{!refusal && !previewFailed && (
				<div className="space-y-4">
					{needsPassword && (
						<div className="space-y-1.5">
							<Label htmlFor="closure-password">Current password</Label>
							<Input
								id="closure-password"
								type="password"
								autoComplete="current-password"
								value={password}
								onChange={(event) => setPassword(event.target.value)}
								disabled={isClosing}
							/>
						</div>
					)}

					<div className="flex items-start gap-2">
						<Checkbox
							id="closure-ack"
							checked={acknowledged}
							onCheckedChange={(value) => setAcknowledged(value === true)}
							disabled={isClosing}
						/>
						<Label htmlFor="closure-ack" className="text-sm font-normal leading-snug">
							I understand this cannot be undone
						</Label>
					</div>
				</div>
			)}

			{error && (
				<p className="text-sm text-destructive">
					{error.kind === "refused" ? error.refusal.detail : error.detail}
				</p>
			)}

			<DialogFooter>
				<Button variant="outline" onClick={() => onOpenChange(false)} disabled={isClosing}>
					Cancel
				</Button>
				<Button variant="destructive" onClick={handleConfirm} disabled={blocked}>
					{isClosing
						? "Closing…"
						: remaining > 0
							? `Confirm (${remaining})`
							: "Close my account"}
				</Button>
			</DialogFooter>
		</>
	);
}
