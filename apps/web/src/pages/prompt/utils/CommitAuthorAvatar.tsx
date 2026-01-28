import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const COMMIT_AVATAR_LETTER_COLOR_MAP: Record<string, string> = {
	A: "bg-[#D6CFFF]",
	B: "bg-[#BBCAFF]",
	C: "bg-[#BFDEFF]",
	D: "bg-[#D5F0FF]",
	E: "bg-[#D7EFEB]",
	F: "bg-[#D6F6E6]",
	G: "bg-[#DEEADE]",
	H: "bg-[#E7F5C8]",
	I: "bg-[#FFE4F2]",
	J: "bg-[#FFD7D8]",
	K: "bg-[#FFE6B1]",
	L: "bg-[#F9ECDB]",
	M: "bg-[#D6CFFF]",
	N: "bg-[#BBCAFF]",
	O: "bg-[#BFDEFF]",
	P: "bg-[#D5F0FF]",
	Q: "bg-[#D7EFEB]",
	R: "bg-[#D6F6E6]",
	S: "bg-[#DEEADE]",
	T: "bg-[#E7F5C8]",
	U: "bg-[#FFE4F2]",
	V: "bg-[#FFD7D8]",
	W: "bg-[#FFE6B1]",
	X: "bg-[#F9ECDB]",
	Y: "bg-[#D6CFFF]",
	Z: "bg-[#BBCAFF]",
};

function getCommitAvatarColor(name: string): string {
	const firstLetter = name[0]?.toUpperCase() || "";
	return COMMIT_AVATAR_LETTER_COLOR_MAP[firstLetter] ?? "bg-[#D6CFFF]";
}

function isLetter(char: string): boolean {
	return /^[a-zA-Z]$/.test(char);
}

export interface CommitAuthorAvatarProps {
	author: { name: string; picture?: string | null };
}

export function CommitAuthorAvatar({ author }: CommitAuthorAvatarProps) {
	const picture = author.picture ?? "/assets/avatars/shadcn.jpg";
	const firstChar = author.name?.[0] ?? "";
	const isNonLetter = !firstChar || !isLetter(firstChar);

	const initial = isNonLetter ? "G" : firstChar.toUpperCase();
	const colorClass = isNonLetter
		? "bg-black text-white"
		: getCommitAvatarColor(author.name ?? "U");

	return (
		<Avatar className="h-5 w-5 rounded-full">
			<AvatarImage
				src={picture}
				alt={author.name}
				referrerPolicy="no-referrer"
				className="rounded-full"
			/>
			<AvatarFallback className={`rounded-full text-[10px] font-bold ${colorClass}`}>
				{initial}
			</AvatarFallback>
		</Avatar>
	);
}
