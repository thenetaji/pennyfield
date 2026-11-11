ALTER TABLE `categories` ADD `is_business` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `side` text;--> statement-breakpoint
UPDATE `categories` SET `is_business` = 1 WHERE lower(trim(`name`)) = 'business' OR lower(trim(coalesce(`group_name`, ''))) = 'business' OR `id` IN (
  SELECT t.`category_id` FROM `transactions` t
  LEFT JOIN `transaction_tags` tt ON tt.`transaction_id` = t.`id` AND tt.`tag_id` IN (SELECT `id` FROM `tags` WHERE lower(trim(`name`)) = 'business')
  WHERE t.`category_id` IS NOT NULL AND t.`kind` IN ('expense', 'income')
  GROUP BY t.`category_id`
  HAVING count(DISTINCT tt.`transaction_id`) * 2 > count(DISTINCT t.`id`)
);--> statement-breakpoint
UPDATE `transactions` SET `side` = 'business' WHERE `kind` IN ('expense', 'income')
  AND `id` IN (SELECT `transaction_id` FROM `transaction_tags` WHERE `tag_id` IN (SELECT `id` FROM `tags` WHERE lower(trim(`name`)) = 'business'))
  AND coalesce((SELECT `is_business` FROM `categories` c WHERE c.`id` = `transactions`.`category_id`), 0) = 0;
