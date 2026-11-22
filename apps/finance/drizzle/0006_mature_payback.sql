ALTER TABLE `transactions` ADD `funds_transaction_id` text REFERENCES transactions(id) ON DELETE cascade;--> statement-breakpoint
ALTER TABLE `transactions` ADD `no_funding` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `transactions_funds_idx` ON `transactions` (`funds_transaction_id`);