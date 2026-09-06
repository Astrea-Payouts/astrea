export interface PrizeRow {
	id: string;
	label: string;
	amount: number;
	currency?: string;
}

export interface PrizesStepData {
	prizes: PrizeRow[];
	currency: string;
	adminWalletBalance: number;
}

export interface PrizeSummary {
	totalAmount: number;
	adminWalletBalance: number;
	isOverBudget: boolean;
	deficit: number;
	remainingBalance: number;
	rowCount: number;
}

export interface PrizeValidationResult {
	isValid: boolean;
	errors: Record<string, string>;
}
