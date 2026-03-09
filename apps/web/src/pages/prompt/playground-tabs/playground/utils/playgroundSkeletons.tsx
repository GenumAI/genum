import { Skeleton } from "@/components/ui/skeleton";

function PlaygroundEditorSkeleton() {
	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<Skeleton className="h-5 w-40" />
				<Skeleton className="h-6 w-6 rounded-sm" />
			</div>
			<div className="rounded-md border">
				<div className="flex items-center gap-2 border-b px-2 py-1.5">
					<Skeleton className="h-6 w-6 rounded-sm" />
					<Skeleton className="h-6 w-6 rounded-sm" />
					<Skeleton className="h-6 w-6 rounded-sm" />
					<Skeleton className="h-6 w-6 rounded-sm" />
					<Skeleton className="ml-auto h-7 w-24" />
				</div>
				<Skeleton className="h-[200px] w-full rounded-t-none" />
			</div>
		</div>
	);
}

function PlaygroundInputSkeleton() {
	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<Skeleton className="h-5 w-20" />
				<div className="flex items-center gap-2">
					<Skeleton className="h-7 w-7 rounded-sm" />
					<Skeleton className="h-7 w-7 rounded-sm" />
				</div>
			</div>
			<Skeleton className="h-[200px] w-full" />
			<div className="mt-3 flex w-full min-w-0 flex-wrap items-center justify-between gap-2">
				<Skeleton className="h-8 w-full sm:w-56" />
				<Skeleton className="h-[32px] w-full sm:w-[138px]" />
			</div>
		</div>
	);
}

function PlaygroundOutputSkeleton() {
	return (
		<div className="space-y-2">
			<div className="flex w-full min-w-0 items-center justify-between pb-2 pt-4">
				<Skeleton className="h-5 w-24" />
				<div className="flex items-center gap-2">
					<Skeleton className="h-8 w-24" />
					<Skeleton className="h-6 w-6 rounded-sm" />
				</div>
			</div>
			<div className="rounded-lg border">
				<div className="grid grid-cols-1 border-b sm:grid-cols-2">
					<div className="space-y-2 p-3">
						<Skeleton className="h-4 w-28" />
						<Skeleton className="h-4 w-20" />
					</div>
					<div className="space-y-2 border-t p-3 sm:border-l sm:border-t-0">
						<Skeleton className="h-4 w-32" />
						<Skeleton className="h-4 w-24" />
					</div>
				</div>
				<Skeleton className="h-80 w-full rounded-t-none" />
			</div>
			<div className="grid w-full min-w-0 grid-cols-1 gap-2 pt-3 sm:grid-cols-2">
				<Skeleton className="h-[32px] w-full sm:w-[138px] sm:justify-self-end" />
				<Skeleton className="h-[32px] w-full sm:w-[138px] sm:justify-self-end" />
			</div>
		</div>
	);
}

function PlaygroundMainSkeleton() {
	return (
		<div className="flex w-full min-w-0 flex-col gap-8 overflow-hidden rounded-[12px] border border-border bg-card px-4 pb-4 pt-3 text-card-foreground lg:flex-1">
			<PlaygroundEditorSkeleton />
			<PlaygroundInputSkeleton />
			<PlaygroundOutputSkeleton />
		</div>
	);
}

function ModelsSettingsControlsSkeleton() {
	return (
		<div className="flex flex-col gap-5">
			<div className="space-y-2">
				<Skeleton className="h-5 w-14" />
				<Skeleton className="h-9 w-full rounded-xl" />
			</div>

			<div className="space-y-2">
				<Skeleton className="h-5 w-28" />
				<Skeleton className="h-9 w-full rounded-xl" />
			</div>

			<div className="space-y-2">
				<Skeleton className="h-5 w-12" />
				<Skeleton className="h-8 w-full rounded-xl" />
			</div>

			<div className="space-y-2.5">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Skeleton className="h-5 w-28" />
						<Skeleton className="h-4 w-4 rounded-full" />
					</div>
					<Skeleton className="h-5 w-8" />
				</div>
				<Skeleton className="h-4 w-full rounded-full" />
			</div>

			<div className="space-y-2.5">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Skeleton className="h-5 w-24" />
						<Skeleton className="h-4 w-4 rounded-full" />
					</div>
					<Skeleton className="h-5 w-12" />
				</div>
				<Skeleton className="h-4 w-full rounded-full" />
			</div>
		</div>
	);
}

function PlaygroundSettingsSkeleton() {
	return (
		<div className="flex w-full flex-col gap-3">
			<div className="h-[398px] w-full rounded-2xl border border-[#83ABFF80] bg-card px-3 py-4 shadow-[0px_1px_2px_0px_#0000000F] shadow-[0px_1px_3px_0px_#0000001A]">
				<div className="flex h-full min-w-0 flex-col">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-[6px]">
							<Skeleton className="h-5 w-16" />
							<Skeleton className="h-5 w-5 rounded-full" />
						</div>
						<div className="flex items-center gap-3">
							<Skeleton className="h-5 w-5 rounded-sm" />
							<Skeleton className="h-4 w-4 rounded-sm" />
						</div>
					</div>

					<div className="mt-3 mb-6 flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden">
						<div className="rounded-xl border border-border bg-muted p-3">
							<Skeleton className="mb-2 h-4 w-28" />
							<Skeleton className="h-3 w-[88%]" />
						</div>
						<div className="rounded-xl border border-border bg-muted p-3">
							<Skeleton className="mb-2 h-4 w-20" />
							<Skeleton className="h-3 w-[82%]" />
						</div>
						<div className="rounded-xl border border-border bg-muted p-3">
							<Skeleton className="mb-2 h-4 w-24" />
							<Skeleton className="h-3 w-[90%]" />
						</div>
					</div>

					<div className="mt-auto">
						<div className="mb-3 h-px w-full bg-primary/20" />
						<Skeleton className="mb-2 h-14 w-full" />
						<div className="flex items-center gap-2">
							<Skeleton className="h-7 w-16 rounded-md" />
							<div className="ml-auto flex items-center gap-2">
								<Skeleton className="h-7 w-7 rounded-full" />
								<Skeleton className="h-7 w-7 rounded-lg" />
							</div>
						</div>
					</div>
				</div>
			</div>

			<div className="flex h-[520px] w-full flex-col gap-3 rounded-xl border bg-card px-3 py-4 shadow-[0px_1px_2px_0px_#0000000F] shadow-[0px_1px_3px_0px_#0000001A]">
				<div className="flex w-full items-center justify-between">
					<Skeleton className="h-5 w-24" />
					<Skeleton className="h-4 w-4 rounded-sm" />
				</div>

				<ModelsSettingsControlsSkeleton />

				<div className="mt-auto flex flex-col gap-3">
					<div className="my-1 h-px w-full bg-border" />
					<div className="flex flex-col gap-2">
						<Skeleton className="h-5 w-28" />
						<div className="space-y-1.5">
							<div className="flex items-center justify-between">
								<Skeleton className="h-5 w-28" />
								<Skeleton className="h-5 w-10" />
							</div>
							<div className="flex items-center justify-between">
								<Skeleton className="h-5 w-16" />
								<Skeleton className="h-5 w-20" />
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export { PlaygroundMainSkeleton, PlaygroundSettingsSkeleton, ModelsSettingsControlsSkeleton };
