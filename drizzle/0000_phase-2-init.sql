CREATE TYPE "public"."order_status" AS ENUM('paid', 'generated', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."product" AS ENUM('premium', 'yearly2026', 'jobCareer', 'loveMarriage');--> statement-breakpoint
CREATE TABLE "codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(12) NOT NULL,
	"myeongsik" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_no" text NOT NULL,
	"payment_key" text NOT NULL,
	"code_id" uuid NOT NULL,
	"product" "product" NOT NULL,
	"status" "order_status" DEFAULT 'paid' NOT NULL,
	"amount" integer NOT NULL,
	"followup_used" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_no_unique" UNIQUE("order_no")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"product" "product" NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone DEFAULT now() + interval '72 hours' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_code_id_codes_id_fk" FOREIGN KEY ("code_id") REFERENCES "public"."codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_code_id_codes_id_fk" FOREIGN KEY ("code_id") REFERENCES "public"."codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "codes_code_idx" ON "codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "orders_code_id_idx" ON "orders" USING btree ("code_id");--> statement-breakpoint
CREATE INDEX "reports_expires_at_idx" ON "reports" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "reports_code_id_idx" ON "reports" USING btree ("code_id");