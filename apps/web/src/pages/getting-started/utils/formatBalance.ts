export function formatBalance(balance: number | null): string {
	if (balance === null) {
		return "$0.00";
	}

	return `$${balance.toFixed(2)}`;
}
