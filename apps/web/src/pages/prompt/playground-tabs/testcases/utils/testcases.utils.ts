import type { TestStatus } from "@/types/TestСase";

/**
 * Получить начальный статус фильтрации из URL параметров
 */
export const getInitialStatus = (searchParams: URLSearchParams): TestStatus[] => {
	const status = searchParams.get("status");
	if (status === "passed") return ["OK"];
	if (status === "failed") return ["NOK"];
	return [];
};

/**
 * Получить текст для кнопки запуска тестов в зависимости от выбранного фильтра
 */
export const getRunTestsButtonLabel = (selectedValue: string): string => {
	switch (selectedValue) {
		case "all":
			return "Run All";
		case "nok":
			return "Run All Failed";
		case "need_run":
			return "Run All Need Run";
		case "passed":
			return "Run All Passed";
		case "selected":
			return "Run Selected";
		default:
			return "Run Tests";
	}
};

/**
 * Получить читаемый текст для чипса статуса
 */
export const getStatusChipLabel = (status: TestStatus): string => {
	switch (status) {
		case "OK":
			return "Passed";
		case "NOK":
			return "Failed";
		case "NEED_RUN":
			return "Need run";
		default:
			return status;
	}
};
