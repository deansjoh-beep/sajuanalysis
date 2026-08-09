CREATE TABLE "usage_events" (
	"day" varchar(10) NOT NULL,
	"event" varchar(32) NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "usage_events_day_event_pk" PRIMARY KEY("day","event")
);
