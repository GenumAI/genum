import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CommitSelect } from "./CommitSelect";
import { Button } from "@/components/ui/button";
import { BarChart2 } from "lucide-react";

type Author = {
	id: number;
	name: string;
	email: string;
	picture: string;
};

type PromptVersion = {
	branchName: string;
	id: number;
	commitMsg: string;
	commitHash: string;
	createdAt: string;
	author: Author;
};

type TAuthorInfo = {
	name: string;
	author: string;
	date: string;
	branch: string;
};

export const CommitDropdowns = ({
	sortedVersions,
	firstAuthor,
	secondAuthor,
}: {
	sortedVersions: PromptVersion[];
	firstAuthor: TAuthorInfo | null;
	secondAuthor: TAuthorInfo | null;
}) => {
	const [searchParams, setSearchParams] = useSearchParams();
	const commitA = searchParams.get("commitA") || "current";
	const commitB = searchParams.get("commitB") || "";
	const navigate = useNavigate();
	const params = useParams();

	const handleChangeCommitA = (val: string) => {
		setSearchParams((prev) => {
			prev.set("commitA", val);
			return prev;
		});
	};
	const handleChangeCommitB = (val: string) => {
		setSearchParams((prev) => {
			prev.set("commitB", val);
			return prev;
		});
	};

	return (
		<div className="flex flex-col gap-2.5 mb-4">
			<div className="flex items-center gap-2 p-0 text-[20px] font-semibold leading-[28px]">
				Commit comparison
			</div>
			<div className="flex flex-col md:flex-row p-0 gap-4">
				<div className="flex flex-col gap-4">
					<div className="flex flex-row md:justify-start justify-between gap-2.5">
						<CommitSelect
							value={commitA}
							onChange={handleChangeCommitA}
							versions={sortedVersions}
							placeholder="Current prompt"
						/>
						{commitA !== "current" && (
							<Button
								variant="secondary"
								onClick={() =>
									navigate(
										`/${params.orgId}/${params.projectId}/prompt/${params.id}/versions/${commitA}`,
									)
								}
								className="font-normal"
								disabled={!commitA}
							>
								View
							</Button>
						)}
					</div>
					{firstAuthor && !(firstAuthor.author === "Not" && !secondAuthor?.author) && (
						<div className="flex items-center gap-2">
							<div className="flex flex-shrink-0 flex-grow-0 items-center justify-center rounded-full w-4 h-4 bg-[#D7EFEB] dark:bg-muted text-[10px]">
								{firstAuthor.author[0]}
							</div>
							<div className=" flex gap-2 text-[#71717A] text-sm">
								{firstAuthor.author} commited{" "}
								<div className="font-[600]">{firstAuthor.date}</div>
							</div>
						</div>
					)}
				</div>

				<div className="flex h-10 items-center justify-center">
					<BarChart2 className="stroke-[#71717A]" />
				</div>

				<div className="flex gap-4 flex-col">
					<div className="flex flex-row md:justify-start justify-between gap-2.5">
						<CommitSelect
							value={commitB}
							onChange={handleChangeCommitB}
							versions={sortedVersions}
							placeholder="Select second commit"
						/>
						<Button
							variant="secondary"
							className="font-normal"
							disabled={!commitB}
							onClick={() =>
								navigate(
									`/${params.orgId}/${params.projectId}/prompt/${params.id}/versions/${commitB}`,
								)
							}
						>
							View
						</Button>
					</div>
					{secondAuthor && (
						<div className="flex items-center gap-2">
							<div className="flex flex-shrink-0 flex-grow-0 items-center justify-center rounded-full w-4 h-4 bg-[#D7EFEB] dark:bg-muted text-[10px]">
								{secondAuthor.author[0]}
							</div>
							<div className=" flex gap-2 text-[#71717A] text-sm">
								{secondAuthor.author} commited{" "}
								<div className="font-[600]">{secondAuthor.date}</div>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
