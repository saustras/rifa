CREATE TYPE "public"."assignment_mode" AS ENUM('random', 'customer_choice');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('raffle_created', 'raffle_updated', 'order_created', 'proof_uploaded', 'order_approved', 'order_rejected', 'number_reserved', 'number_assigned', 'draw_result_registered');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('email', 'telegram');--> statement-breakpoint
CREATE TYPE "public"."notification_job_status" AS ENUM('queued', 'processing', 'delivered', 'failed', 'retrying');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('order_pending_review', 'order_approved', 'order_rejected', 'draw_result_registered');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending_review', 'paid', 'rejected', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."raffle_number_status" AS ENUM('available', 'reserved', 'assigned', 'blocked', 'winner', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."raffle_status" AS ENUM('draft', 'scheduled', 'active', 'paused', 'closed', 'drawn', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('public_buyer', 'seller', 'platform_admin', 'auditor');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text,
	"actor_user_id" text,
	"actor_role" "role",
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" "audit_action" NOT NULL,
	"before_data" jsonb,
	"after_data" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"full_name" text NOT NULL,
	"document_type" text,
	"document_number" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"city" text,
	"accepted_terms_at" timestamp with time zone,
	"is_adult_confirmed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "draw_results" (
	"id" text PRIMARY KEY NOT NULL,
	"raffle_id" text NOT NULL,
	"external_source" text NOT NULL,
	"external_draw_date" timestamp with time zone,
	"winning_number" integer NOT NULL,
	"winner_order_id" text,
	"winner_customer_id" text,
	"evidence_url" text,
	"notes" text,
	"registered_by_user_id" text,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"order_id" text,
	"raffle_id" text,
	"channel" "notification_channel" NOT NULL,
	"type" "notification_type" NOT NULL,
	"recipient" text NOT NULL,
	"status" "notification_job_status" DEFAULT 'queued' NOT NULL,
	"payload_ref" text,
	"idempotency_key" text NOT NULL,
	"provider_message_id" text,
	"error_message" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_numbers" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"raffle_number_id" text NOT NULL,
	"number" integer NOT NULL,
	"display_number" text NOT NULL,
	"status" "raffle_number_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"raffle_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"status" "order_status" DEFAULT 'pending_review' NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'COP' NOT NULL,
	"numbers_requested" integer DEFAULT 1 NOT NULL,
	"payment_proof_url" text,
	"payment_proof_storage_key" text,
	"payment_proof_mime_type" text,
	"payment_proof_size_bytes" integer,
	"payment_proof_uploaded_at" timestamp with time zone,
	"reviewed_by_user_id" text,
	"reviewed_at" timestamp with time zone,
	"review_idempotency_key" text,
	"rejection_reason" text,
	"admin_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raffle_numbers" (
	"id" text PRIMARY KEY NOT NULL,
	"raffle_id" text NOT NULL,
	"number" integer NOT NULL,
	"display_number" text NOT NULL,
	"status" "raffle_number_status" DEFAULT 'available' NOT NULL,
	"reserved_by_order_id" text,
	"assigned_to_order_id" text,
	"reserved_at" timestamp with time zone,
	"assigned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raffle_prizes" (
	"id" text PRIMARY KEY NOT NULL,
	"raffle_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"image_url" text,
	"commercial_value" numeric(12, 2),
	"position" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raffles" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"status" "raffle_status" DEFAULT 'draft' NOT NULL,
	"cover_image_url" text,
	"price_per_number" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'COP' NOT NULL,
	"number_min" integer DEFAULT 0 NOT NULL,
	"number_max" integer NOT NULL,
	"number_padding" integer DEFAULT 2 NOT NULL,
	"assignment_mode" "assignment_mode" NOT NULL,
	"reservation_ttl_minutes" integer DEFAULT 30 NOT NULL,
	"draw_source_name" text,
	"draw_date" timestamp with time zone,
	"draw_time" text,
	"draw_rule" text,
	"terms" text,
	"payment_method_label" text,
	"payment_account_holder" text,
	"payment_account_type" text,
	"payment_account_number" text,
	"payment_document_number" text,
	"payment_instructions" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sellers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"status" text DEFAULT 'active' NOT NULL,
	"telegram_chat_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"seller_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" DEFAULT 'seller' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draw_results" ADD CONSTRAINT "draw_results_raffle_id_raffles_id_fk" FOREIGN KEY ("raffle_id") REFERENCES "public"."raffles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draw_results" ADD CONSTRAINT "draw_results_winner_order_id_orders_id_fk" FOREIGN KEY ("winner_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draw_results" ADD CONSTRAINT "draw_results_winner_customer_id_customers_id_fk" FOREIGN KEY ("winner_customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draw_results" ADD CONSTRAINT "draw_results_registered_by_user_id_users_id_fk" FOREIGN KEY ("registered_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD CONSTRAINT "notification_logs_raffle_id_raffles_id_fk" FOREIGN KEY ("raffle_id") REFERENCES "public"."raffles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_numbers" ADD CONSTRAINT "order_numbers_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_numbers" ADD CONSTRAINT "order_numbers_raffle_number_id_raffle_numbers_id_fk" FOREIGN KEY ("raffle_number_id") REFERENCES "public"."raffle_numbers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_raffle_id_raffles_id_fk" FOREIGN KEY ("raffle_id") REFERENCES "public"."raffles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_numbers" ADD CONSTRAINT "raffle_numbers_raffle_id_raffles_id_fk" FOREIGN KEY ("raffle_id") REFERENCES "public"."raffles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_prizes" ADD CONSTRAINT "raffle_prizes_raffle_id_raffles_id_fk" FOREIGN KEY ("raffle_id") REFERENCES "public"."raffles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffles" ADD CONSTRAINT "raffles_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_seller_created_idx" ON "audit_logs" USING btree ("seller_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "customers_seller_email_idx" ON "customers" USING btree ("seller_id","email");--> statement-breakpoint
CREATE INDEX "customers_seller_document_idx" ON "customers" USING btree ("seller_id","document_number");--> statement-breakpoint
CREATE UNIQUE INDEX "draw_results_raffle_unique" ON "draw_results" USING btree ("raffle_id");--> statement-breakpoint
CREATE INDEX "notification_logs_seller_status_idx" ON "notification_logs" USING btree ("seller_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_logs_idempotency_unique" ON "notification_logs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "order_numbers_order_idx" ON "order_numbers" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_numbers_order_number_unique" ON "order_numbers" USING btree ("order_id","raffle_number_id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_numbers_raffle_number_unique" ON "order_numbers" USING btree ("raffle_number_id");--> statement-breakpoint
CREATE INDEX "orders_seller_status_idx" ON "orders" USING btree ("seller_id","status");--> statement-breakpoint
CREATE INDEX "orders_raffle_status_idx" ON "orders" USING btree ("raffle_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_review_idempotency_unique" ON "orders" USING btree ("review_idempotency_key");--> statement-breakpoint
CREATE INDEX "raffle_numbers_raffle_status_idx" ON "raffle_numbers" USING btree ("raffle_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "raffle_numbers_raffle_number_unique" ON "raffle_numbers" USING btree ("raffle_id","number");--> statement-breakpoint
CREATE INDEX "raffle_prizes_raffle_idx" ON "raffle_prizes" USING btree ("raffle_id");--> statement-breakpoint
CREATE INDEX "raffles_seller_idx" ON "raffles" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "raffles_status_idx" ON "raffles" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "raffles_seller_slug_unique" ON "raffles" USING btree ("seller_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "sellers_email_unique" ON "sellers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_seller_idx" ON "users" USING btree ("seller_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_seller_email_unique" ON "users" USING btree ("seller_id","email");