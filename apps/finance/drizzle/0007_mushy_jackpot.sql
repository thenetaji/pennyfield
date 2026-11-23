CREATE TABLE `investment_schedule` (
	`id` text PRIMARY KEY NOT NULL,
	`investment_id` text NOT NULL,
	`date_key` text NOT NULL,
	`kind` text NOT NULL,
	`amount` integer NOT NULL,
	FOREIGN KEY (`investment_id`) REFERENCES `investments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `investment_schedule_investment_idx` ON `investment_schedule` (`investment_id`);--> statement-breakpoint
ALTER TABLE `investments` ADD `first_payout_date` text;--> statement-breakpoint
ALTER TABLE `investments` ADD `coupon_amount` integer;--> statement-breakpoint
ALTER TABLE `investments` ADD `redemption_amount` integer;