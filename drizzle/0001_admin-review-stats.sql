CREATE TYPE "public"."review_verdict" AS ENUM('approved', 'rejected');--> statement-breakpoint
CREATE TABLE "report_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"product" "product" NOT NULL,
	"verdict" "review_verdict" NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_reviews_report_id_unique" UNIQUE("report_id")
);
--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "generation_cost_krw" integer;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "quality_score" integer;