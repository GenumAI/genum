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

function TestcasesTableSkeleton() {
	const rowSkeletonKeys = [
		"testcase-row-1",
		"testcase-row-2",
		"testcase-row-3",
		"testcase-row-4",
		"testcase-row-5",
		"testcase-row-6",
	];

	return (
		<div className="overflow-hidden rounded-md">
			<div className="flex h-[54px] items-center bg-[#F4F4F5] px-[14px] dark:bg-[#262626]">
				<div className="grid w-full grid-cols-[2.8fr_1.6fr_1fr_1fr_0.8fr] gap-4">
					<Skeleton className="h-4 w-[58px]" />
					<Skeleton className="h-4 w-[78px]" />
					<Skeleton className="h-4 w-[42px] justify-self-center" />
					<Skeleton className="h-4 w-[50px] justify-self-center" />
					<Skeleton className="h-4 w-[46px] justify-self-end" />
				</div>
			</div>
			<div className="divide-y">
				{rowSkeletonKeys.map((rowKey) => (
					<div
						key={rowKey}
						className="grid grid-cols-[2.8fr_1.6fr_1fr_1fr_0.8fr] gap-4 px-[14px] py-4"
					>
						<div className="space-y-2">
							<Skeleton className="h-4 w-[70%]" />
							<Skeleton className="h-3 w-[45%]" />
						</div>
						<Skeleton className="h-4 w-[78%] self-center" />
						<Skeleton className="h-6 w-16 justify-self-center rounded-full" />
						<Skeleton className="h-4 w-20 justify-self-center self-center" />
						<Skeleton className="h-8 w-8 justify-self-end rounded-md" />
					</div>
				))}
			</div>
		</div>
	);
}

function VersionsBranchesSkeleton() {
	const groupKeys = ["versions-group-1", "versions-group-2"];

	return (
		<div className="p-1 py-4">
			{groupKeys.map((groupKey, groupIndex) => {
				const isLastGroup = groupIndex === groupKeys.length - 1;

				return (
					<div key={groupKey} className="relative">
						<div className="flex justify-between">
							<div className="flex items-center gap-2">
								<Skeleton className="h-7 w-7 rounded-md" />
								<Skeleton className="h-4 w-36" />
							</div>

							{groupIndex < 1 && (
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										<span className="w-7" />
										<span />
									</div>
									<div className="flex gap-2 text-sm text-muted-foreground">
										<Skeleton className="h-5 w-20" />
									</div>
								</div>
							)}
						</div>

						<div
							className={`ml-3 border-l-2 border-border pl-4 py-3 ${isLastGroup ? "pb-0" : "pb-4"}`}
						>
							<div
								key={`${groupKey}-commit`}
								className="relative flex items-start gap-4 border-b border-border py-3 pl-4"
							>
								<Skeleton className="h-8 w-8 rounded-md" />

								<div className="flex-1">
									<div className="flex items-center justify-between">
										<div className="w-full space-y-2">
											<Skeleton className="h-4 w-[42%]" />
											<Skeleton className="h-4 w-[30%]" />
										</div>

										<div className="flex items-center gap-4">
											<Skeleton className="h-6 w-24 rounded" />
											<Skeleton className="h-6 w-20 rounded-sm" />
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				);
			})}
		</div>
	);
}

function MemoryTableSkeleton() {
	const rowSkeletonKeys = [
		"memory-row-1",
		"memory-row-2",
		"memory-row-3",
		"memory-row-4",
		"memory-row-5",
		"memory-row-6",
	];

	return (
		<div className="overflow-hidden rounded-md">
			<div className="grid h-[54px] grid-cols-[1.3fr_2.2fr_1fr_1fr_0.7fr] items-center gap-4 bg-muted px-[14px] text-sm font-medium leading-5 text-muted-foreground">
				<Skeleton className="h-4 w-8" />
				<Skeleton className="h-4 w-10" />
				<Skeleton className="h-4 w-14" />
				<Skeleton className="h-4 w-14" />
				<Skeleton className="h-4 w-12 justify-self-center" />
			</div>

			<div className="divide-y">
				{rowSkeletonKeys.map((rowKey) => (
					<div
						key={rowKey}
						className="grid grid-cols-[1.3fr_2.2fr_1fr_1fr_0.7fr] gap-4 px-[14px] py-4"
					>
						<Skeleton className="h-4 w-[68%] self-center" />
						<Skeleton className="h-4 w-[84%] self-center" />
						<Skeleton className="h-4 w-20 self-center" />
						<Skeleton className="h-4 w-20 self-center" />
						<Skeleton className="h-8 w-8 justify-self-center rounded-md" />
					</div>
				))}
			</div>
		</div>
	);
}

function LogsTableSkeleton() {
	const headerWidths = [
		"w-8",
		"w-24",
		"w-12",
		"w-12",
		"w-20",
		"w-16",
		"w-14",
		"w-16",
		"w-16",
	];
	const headerSkeletonKeys = [
		"logs-header-select",
		"logs-header-time",
		"logs-header-input",
		"logs-header-output",
		"logs-header-model",
		"logs-header-status",
		"logs-header-cost",
		"logs-header-prompt-tokens",
		"logs-header-total-tokens",
	];
	const rowSkeletonKeys = [
		"log-row-1",
		"log-row-2",
		"log-row-3",
		"log-row-4",
		"log-row-5",
		"log-row-6",
	];

	return (
		<div className="overflow-hidden bg-card text-card-foreground">
			<div className="grid h-[52.5px] grid-cols-[48px_180px_1fr_1fr_180px_120px_110px_110px_110px] items-center gap-3 bg-muted px-3">
				{headerWidths.map((width, index) => (
					<Skeleton
						key={headerSkeletonKeys[index]}
						className={`h-4 ${width} justify-self-center`}
					/>
				))}
			</div>

			<div className="divide-y divide-border">
				{rowSkeletonKeys.map((rowKey) => (
					<div
						key={rowKey}
						className="grid grid-cols-[48px_180px_1fr_1fr_180px_120px_110px_110px_110px] items-center gap-3 px-3 py-3"
					>
						<Skeleton className="h-4 w-4 justify-self-center rounded-full" />
						<Skeleton className="h-4 w-28 justify-self-center" />
						<Skeleton className="hidden h-4 w-14 justify-self-center lg:block" />
						<Skeleton className="hidden h-4 w-16 justify-self-center lg:block" />
						<Skeleton className="h-4 w-24 justify-self-center" />
						<Skeleton className="hidden h-4 w-14 justify-self-center xl:block" />
						<Skeleton className="hidden h-4 w-16 justify-self-center md:block" />
						<Skeleton className="hidden h-4 w-14 justify-self-center sm:block" />
						<Skeleton className="hidden h-4 w-16 justify-self-center sm:block" />
					</div>
				))}
			</div>
		</div>
	);
}

export {
	PlaygroundMainSkeleton,
	PlaygroundSettingsSkeleton,
	ModelsSettingsControlsSkeleton,
	TestcasesTableSkeleton,
	VersionsBranchesSkeleton,
	MemoryTableSkeleton,
	LogsTableSkeleton,
};
