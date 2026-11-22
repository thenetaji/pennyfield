CREATE TABLE `investment_payouts` (
	`id` text PRIMARY KEY NOT NULL,
	`investment_id` text NOT NULL,
	`kind` text NOT NULL,
	`date_key` text NOT NULL,
	`gross` integer NOT NULL,
	`tds` integer DEFAULT 0 NOT NULL,
	`account_id` text,
	`transaction_id` text,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`investment_id`) REFERENCES `investments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `investment_payouts_investment_idx` ON `investment_payouts` (`investment_id`);--> statement-breakpoint
CREATE INDEX `investment_payouts_date_idx` ON `investment_payouts` (`date_key`);--> statement-breakpoint
CREATE TABLE `investments` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`issuer` text DEFAULT '' NOT NULL,
	`platform` text DEFAULT '' NOT NULL,
	`reference` text DEFAULT '' NOT NULL,
	`rating` text DEFAULT '' NOT NULL,
	`listed` integer DEFAULT false NOT NULL,
	`amount` integer NOT NULL,
	`currency` text NOT NULL,
	`rate` real,
	`payout` text NOT NULL,
	`buy_date` text NOT NULL,
	`maturity_date` text,
	`closed_on` text,
	`from_account_id` text,
	`buy_transaction_id` text,
	`close_transaction_id` text,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `investments_maturity_idx` ON `investments` (`maturity_date`);