-- Add logistics and priority columns to transfers table
ALTER TABLE "transfers" 
ADD COLUMN "driver_name" varchar(100),
ADD COLUMN "vehicle_plate" varchar(20),
ADD COLUMN "tracking_number" varchar(50),
ADD COLUMN "shipping_cost" decimal(10,2) DEFAULT 0,
ADD COLUMN "priority" varchar(20) DEFAULT 'normal',
ADD COLUMN "expected_arrival" timestamptz;

-- Add comment for priority enum documentation
COMMENT ON COLUMN "transfers"."priority" IS 'low, normal, high, urgent';
