import { upsertQA } from "../lib/localStore.js";

// ─── TOPIC 1: Snowflake Architecture ─────────────────────────────────────────
const SNOWFLAKE_ARCHITECTURE = [
  {
    question: "What is Snowflake's core architecture and what makes it unique?",
    answer: `Snowflake uses a **multi-cluster, shared data architecture** that separates storage, compute, and cloud services into independent layers:

**Layer 1 — Cloud Services (the brain):**
- Authentication, access control (RBAC), query optimization, metadata management
- Always-on, serverless, no management needed

**Layer 2 — Virtual Warehouses (compute):**
- MPP clusters of compute nodes (EC2/Azure VMs)
- Auto-suspend when idle, auto-resume on query
- Multiple warehouses can run simultaneously against the SAME data
- Scale up (larger node) or scale out (more nodes) independently

**Layer 3 — Centralized Storage:**
- Data stored in Snowflake's internal columnar format (Parquet-like)
- Compressed and micro-partitioned automatically
- Stored in cloud object storage (S3, Azure Blob, GCS)
- Data shared across ALL warehouses with zero copy

**What makes it unique:**
1. **Zero copy cloning:** Clone a 10TB table in seconds — clones share underlying storage
2. **Time travel:** Query data as it was at any point in the past (up to 90 days)
3. **Data sharing:** Share live data with other Snowflake accounts without copying
4. **Near-unlimited concurrency:** Multiple warehouses = no resource contention
5. **Semi-structured native support:** Query JSON, Avro, Parquet directly with VARIANT type`,
    aliases: ["snowflake architecture", "snowflake how it works", "snowflake storage compute separation", "snowflake multi cluster"],
  },
  {
    question: "What are Snowflake Virtual Warehouses and how do you size them correctly?",
    answer: `**Virtual Warehouses (VWs)** are named compute clusters in Snowflake. They are the unit of compute resource consumption.

**Sizes:**
| Size | Nodes | Credits/Hour | Use Case |
|---|---|---|---|
| XS | 1 | 1 | Dev, simple queries, Cortex LLM calls |
| S | 2 | 2 | Standard analytics |
| M | 4 | 4 | Complex joins, moderate workloads |
| L | 8 | 8 | Heavy analytics, large transformations |
| XL | 16 | 16 | Very large datasets |
| 2XL–6XL | 32–256 | 32–256 | Data engineering, massive parallelism |

**Sizing strategy:**
1. Start small (XS/S), observe query performance
2. If queries queue > scale out (add clusters) 
3. If queries run slow but no queue > scale up (larger node)
4. Enable **auto-suspend** (2–5 minutes) to minimize cost when idle
5. Enable **auto-resume** so queries trigger automatic startup

**For restaurant reservation AI system:**
- \`CORTEX_WH (XS)\`: Cortex AI function calls and chatbot queries — lightweight
- \`ETL_WH (S)\`: Data ingestion from booking APIs — moderate
- \`ANALYTICS_WH (S)\`: Management reporting — scheduled, not concurrent

\`\`\`sql
CREATE WAREHOUSE CORTEX_WH
  WAREHOUSE_SIZE = 'XSMALL'
  AUTO_SUSPEND = 120       -- suspend after 2 min idle
  AUTO_RESUME = TRUE
  INITIALLY_SUSPENDED = TRUE;
\`\`\``,
    aliases: ["snowflake virtual warehouse", "snowflake warehouse sizing", "warehouse credits", "snowflake compute clusters"],
  },
  {
    question: "What is Snowflake's micro-partitioning and how does it affect query performance?",
    answer: `**Micro-partitioning** is Snowflake's automatic data organization mechanism. All data is divided into micro-partitions of 50–500MB compressed, each storing column metadata (min, max values per column).

**How it enables pruning:**
\`\`\`sql
-- Query: reservations on a specific date
SELECT * FROM reservations WHERE reservation_date = '2025-02-07';
\`\`\`
Snowflake checks metadata: "Does this micro-partition's date range overlap 2025-02-07?" 
→ If max_date < 2025-02-07 or min_date > 2025-02-07: **skip entirely** (pruned)
→ Only scans the partitions that could contain the date

**Clustering keys** — manual optimization for high-cardinality filter columns:
\`\`\`sql
-- If you almost always filter by restaurant_id and reservation_date:
ALTER TABLE reservations CLUSTER BY (restaurant_id, DATE(reservation_datetime));
\`\`\`

**Result:** Queries that filter on clustering key columns scan only the relevant micro-partitions, dramatically reducing bytes scanned = faster and cheaper queries.

**When to cluster:**
- Table > 1TB
- Consistent filter patterns on specific columns
- Query times are unacceptably slow despite proper warehouse sizing

**SYSTEM$CLUSTERING_INFORMATION()** → shows clustering health score (0-1, higher = better).`,
    aliases: ["micro partitioning", "snowflake clustering", "clustering keys", "snowflake query performance", "partition pruning"],
  },
];

// ─── TOPIC 2: Snowflake Data Ingestion ───────────────────────────────────────
const SNOWFLAKE_INGESTION = [
  {
    question: "What are the main data loading methods in Snowflake and when to use each?",
    answer: `**Loading methods:**

**1. COPY INTO (bulk batch load):**
\`\`\`sql
-- Load from internal stage
COPY INTO reservations
FROM @restaurant_stage/reservations/
FILE_FORMAT = (TYPE = 'CSV' SKIP_HEADER = 1 FIELD_OPTIONALLY_ENCLOSED_BY = '"')
ON_ERROR = 'CONTINUE';

-- Load from S3 external stage  
COPY INTO bookings
FROM 's3://my-bucket/bookings/2025/'
CREDENTIALS = (AWS_KEY_ID = '...' AWS_SECRET_KEY = '...')
FILE_FORMAT = (TYPE = 'PARQUET');
\`\`\`
Use for: Initial loads, daily batch ETL, large historical data migration.

**2. Snowpipe (micro-batch streaming):**
Event-driven loading triggered by S3/Azure Blob notification or REST API.
Latency: seconds to minutes. Serverless, pay-per-load.
\`\`\`sql
CREATE PIPE reservation_pipe AUTO_INGEST = TRUE AS
  COPY INTO reservations FROM @reservation_stage FILE_FORMAT = (TYPE = 'JSON');
\`\`\`

**3. Kafka Connector:**
For real-time streaming from Kafka topics → Snowflake tables.
Use for: high-frequency booking events, real-time analytics.

**4. Snowflake Connector for Python (Snowpark):**
\`\`\`python
session.write_pandas(df, "RESERVATIONS", auto_create_table=True, overwrite=False)
\`\`\`

**5. Partner ETL tools:**
Fivetran, dbt, Airbyte for managed, automated pipelines.`,
    aliases: ["snowflake data loading", "copy into snowflake", "snowpipe", "snowflake ingestion methods", "load data snowflake"],
  },
  {
    question: "What is a Snowflake Stage and how do you use it?",
    answer: `A **Stage** is a named location (internal Snowflake storage or external cloud storage) where data files are staged before loading.

**Types:**

**Internal Stage:**
\`\`\`sql
-- User stage (per user, auto-created)
PUT file://reservations.csv @~/;

-- Table stage (per table, auto-created)
PUT file://bookings.json @%BOOKINGS;

-- Named internal stage (explicit, shareable)
CREATE STAGE restaurant_stage ENCRYPTION = (TYPE = 'SNOWFLAKE_SSE');
PUT file://menu.csv @restaurant_stage/menu/;
\`\`\`

**External Stage (S3):**
\`\`\`sql
CREATE STAGE s3_reservation_stage
  URL = 's3://my-restaurant-data/reservations/'
  CREDENTIALS = (AWS_ROLE = 'arn:aws:iam::123:role/snowflake-role')
  FILE_FORMAT = (TYPE = 'CSV');
\`\`\`

**Listing and removing files:**
\`\`\`sql
LIST @restaurant_stage;
REMOVE @restaurant_stage/menu/old_menu.csv;
\`\`\`

**For restaurant AI use case:**
- Store document chunks (menu PDFs, policy docs) in internal stage
- Cortex Search Service indexes from these stages
- New documents auto-indexed within TARGET_LAG window`,
    aliases: ["snowflake stage", "snowflake named stage", "PUT command snowflake", "internal external stage"],
  },
  {
    question: "What is Snowpark and how does it differ from writing SQL in Snowflake?",
    answer: `**Snowpark** is Snowflake's DataFrame API for Python, Java, and Scala that lets you write data transformation code that executes **within Snowflake's compute engine** — not on your local machine.

**Key difference from SQL:**
- SQL: Write queries as strings, limited reusability
- Snowpark: Write Python code, fully composable, testable, IDE-friendly

**Snowpark Python basics:**
\`\`\`python
from snowflake.snowpark import Session
from snowflake.snowpark.functions import col, lit, sum as sum_, avg, when

# Connect
session = Session.builder.configs({
    "account": "myaccount",
    "user": "user",
    "password": "pass",
    "warehouse": "CORTEX_WH",
    "database": "RESTAURANT_DB",
    "schema": "PUBLIC"
}).create()

# DataFrame operations (lazy — no data moved yet)
df = session.table("RESERVATIONS")

# Filter + aggregate
summary = (
    df
    .filter(col("STATUS") == lit("confirmed"))
    .group_by("RESTAURANT_ID", "DAYOFWEEK(RESERVATION_DATETIME)")
    .agg(
        sum_("PARTY_SIZE").alias("total_guests"),
        avg("PARTY_SIZE").alias("avg_party_size"),
        count("*").alias("total_bookings")
    )
    .sort(col("total_bookings").desc())
)

# Trigger execution
summary.show()  # or .to_pandas() or .write.save_as_table("SUMMARY_TABLE")
\`\`\`

**Snowpark UDFs (User-Defined Functions):**
\`\`\`python
@udf(return_type=StringType(), input_types=[StringType()])
def format_phone(phone: str) -> str:
    return phone.replace("-", "").replace(" ", "")
\`\`\``,
    aliases: ["snowpark python", "what is snowpark", "snowpark dataframe", "snowpark vs SQL", "snowpark tutorial"],
  },
];

// ─── TOPIC 3: Snowflake for AI/ML ────────────────────────────────────────────
const SNOWFLAKE_FOR_AI = [
  {
    question: "How does Snowflake position itself as an AI Data Cloud?",
    answer: `Snowflake's **AI Data Cloud** strategy centers on making AI/ML a native, governed capability rather than an external add-on:

**Key pillars:**

**1. Data Foundation:**
- Unified storage for structured + semi-structured + unstructured data
- Iceberg tables for open table format compatibility (no vendor lock-in)
- Automatic governance (RBAC, masking, row-level security)

**2. Native AI Services (Cortex):**
- No data movement: AI runs where data lives
- SQL-callable LLM functions (COMPLETE, SEARCH, ANALYST)
- Managed fine-tuning, embedding, search

**3. Snowpark ML (Python-native ML):**
\`\`\`python
from snowflake.ml.modeling.preprocessing import StandardScaler
from snowflake.ml.modeling.ensemble import RandomForestClassifier

# Train entirely inside Snowflake
clf = RandomForestClassifier(n_estimators=100, label_cols=["CANCELLATION"])
clf.fit(training_df)
clf.predict(test_df)
\`\`\`

**4. Snowflake ML Ops (Model Registry):**
\`\`\`python
registry = Registry(session=session)
model_version = registry.log_model(clf, model_name="cancellation_predictor", version_name="v1")
\`\`\`

**5. Streamlit in Snowflake:**
Build and deploy AI-powered data apps directly in Snowflake — no external hosting needed.

**For restaurant system:** All components (data, RAG index, LLM calls, analytics, app) can live within one Snowflake environment with unified governance.`,
    aliases: ["snowflake AI data cloud", "snowflake ML platform", "snowflake AI strategy", "snowflake for AI", "snowflake ML"],
  },
  {
    question: "What is the Snowflake Model Registry and how do you use it?",
    answer: `The **Model Registry** is Snowflake's MLOps tool for versioning, managing, and deploying ML models within Snowflake.

**Core capabilities:**
- Version control for ML models
- Metadata and metrics tracking
- Model serving via SQL or Snowpark (no external inference server needed)
- RBAC-controlled access to production models

**Typical workflow:**
\`\`\`python
from snowflake.ml.registry import Registry
from snowflake.ml.modeling.ensemble import GradientBoostingClassifier
from snowflake.snowpark import Session

session = Session.builder.configs(connection_params).create()
registry = Registry(session=session, database_name="RESTAURANT_DB", schema_name="ML_MODELS")

# 1. Train model in Snowpark
clf = GradientBoostingClassifier(
    input_cols=["DAY_OF_WEEK", "HOUR", "PARTY_SIZE", "LEAD_TIME_DAYS"],
    label_cols=["IS_NO_SHOW"]
)
clf.fit(train_df)

# 2. Log to registry
model_ref = registry.log_model(
    model=clf,
    model_name="no_show_predictor",
    version_name="v2",
    metrics={"train_accuracy": 0.87, "val_accuracy": 0.84},
    comment="Added lead_time_days feature"
)

# 3. Serve predictions in SQL
registry.get_model("no_show_predictor").version("v2").run(
    test_df,
    function_name="predict"
)
\`\`\`

**For restaurant system:** Train a no-show prediction model, register it in Snowflake, then call it via SQL in the booking pipeline to flag high-risk reservations for confirmation reminders.`,
    aliases: ["snowflake model registry", "MLops snowflake", "model versioning snowflake", "deploy model snowflake"],
  },
  {
    question: "What are Snowflake ML Functions and how do they differ from Cortex LLM functions?",
    answer: `**Snowflake ML Functions** are AutoML SQL functions for classical ML tasks (no model training required, no LLM):

| ML Function | Task | SQL |
|---|---|---|
| **FORECAST** | Time-series prediction | \`SNOWFLAKE.ML.FORECAST(...)\` |
| **ANOMALY_DETECTION** | Detect unusual patterns | \`SNOWFLAKE.ML.DETECT_ANOMALIES(...)\` |
| **CLASSIFICATION** | Binary/multi-class predict | \`SNOWFLAKE.ML.CLASSIFY(...)\` |
| **TOP_INSIGHTS** | Root cause analysis | \`SNOWFLAKE.ML.TOP_INSIGHTS(...)\` |
| **CONTRIBUTION_EXPLORER** | Metric attribution | \`SNOWFLAKE.ML.CONTRIBUTION_EXPLORER(...)\` |

**Example — Forecasting reservation demand:**
\`\`\`sql
-- Step 1: Create forecasting model on historical data
CREATE SNOWFLAKE.ML.FORECAST reservation_forecast (
    INPUT_DATA => SYSTEM$REFERENCE('TABLE', 'DAILY_RESERVATION_COUNTS'),
    TIMESTAMP_COLNAME => 'reservation_date',
    TARGET_COLNAME => 'total_bookings'
);

-- Step 2: Generate 14-day forecast
CALL reservation_forecast!FORECAST(FORECASTING_PERIODS => 14);
\`\`\`

**Cortex LLM Functions** = text-in, text-out (COMPLETE, SUMMARIZE, SENTIMENT)
**ML Functions** = tabular data-in, predictions/scores-out (FORECAST, CLASSIFY)

**Combined use:** Use ML Functions to predict peak days → feed into Cortex COMPLETE to auto-generate a staffing recommendation memo: "Based on forecasts, next Friday expects 47 covers. Consider adding 2 staff."`,
    aliases: ["snowflake ML functions", "snowflake forecast", "snowflake anomaly detection", "ML functions vs cortex", "AutoML snowflake"],
  },
  {
    question: "What is Streamlit in Snowflake and how is it useful for AI applications?",
    answer: `**Streamlit in Snowflake (SiS)** lets you deploy Python/Streamlit web apps directly inside Snowflake — data stays within Snowflake, no external hosting needed.

**Benefits over traditional deployment:**
- Zero infrastructure management (no servers, containers, Kubernetes)
- Data stays in Snowflake (no API calls to extract data)
- Snowflake RBAC applies to app access automatically
- Can call Snowpark, Cortex, ML functions natively

**Example — Restaurant Management Dashboard:**
\`\`\`python
import streamlit as st
from snowflake.snowpark.context import get_active_session
from snowflake.cortex import Complete

session = get_active_session()

st.title("🍽️ Restaurant AI Dashboard")

# Real-time metrics from Snowflake
metrics = session.sql("""
    SELECT
        COUNT(*) AS today_bookings,
        SUM(party_size) AS expected_covers,
        COUNT_IF(status = 'cancelled') AS cancellations
    FROM reservations
    WHERE DATE(reservation_datetime) = CURRENT_DATE()
""").to_pandas()

col1, col2, col3 = st.columns(3)
col1.metric("Today's Bookings", metrics['TODAY_BOOKINGS'][0])
col2.metric("Expected Covers", metrics['EXPECTED_COVERS'][0])
col3.metric("Cancellations", metrics['CANCELLATIONS'][0])

# AI-powered insight
if st.button("Generate AI Insights"):
    data_str = metrics.to_string()
    insight = Complete("mistral-large2", f"Analyze this restaurant data and give 2 actionable insights:\\n{data_str}")
    st.write(insight)
\`\`\`

Deploy via: Snowsight UI → Streamlit → New App → paste code.`,
    aliases: ["streamlit in snowflake", "SiS", "snowflake app development", "streamlit snowflake AI", "build app snowflake"],
  },
];

// ─── TOPIC 4: Snowflake Governance ───────────────────────────────────────────
const SNOWFLAKE_GOVERNANCE = [
  {
    question: "How does Snowflake RBAC (Role-Based Access Control) work?",
    answer: `Snowflake uses a **hierarchical RBAC model** where all access is granted to roles, and roles are assigned to users.

**Core system roles:**
| Role | Privilege |
|---|---|
| ACCOUNTADMIN | Full account control (God mode) |
| SYSADMIN | Create/manage warehouses and databases |
| USERADMIN | Create and manage users and roles |
| SECURITYADMIN | Grant and manage object privileges |
| PUBLIC | Auto-granted to all users (minimal) |

**Best practice role hierarchy for restaurant AI system:**
\`\`\`sql
-- Create application-specific roles
CREATE ROLE restaurant_ai_role;
CREATE ROLE restaurant_analyst_role;
CREATE ROLE restaurant_admin_role;

-- Grant hierarchy
GRANT ROLE restaurant_ai_role TO ROLE restaurant_admin_role;
GRANT ROLE restaurant_analyst_role TO ROLE restaurant_admin_role;
GRANT ROLE restaurant_admin_role TO ROLE SYSADMIN;

-- Grant privileges to AI role
GRANT USAGE ON DATABASE restaurant_db TO ROLE restaurant_ai_role;
GRANT USAGE ON SCHEMA restaurant_db.public TO ROLE restaurant_ai_role;
GRANT SELECT ON ALL TABLES IN SCHEMA restaurant_db.public TO ROLE restaurant_ai_role;
GRANT DATABASE ROLE SNOWFLAKE.CORTEX_USER TO ROLE restaurant_ai_role;  -- enable Cortex

-- Assign to user
GRANT ROLE restaurant_ai_role TO USER ai_service_account;
\`\`\`

**Principle of least privilege:** AI service account only gets SELECT + Cortex. No INSERT/DELETE/DROP.`,
    aliases: ["snowflake RBAC", "snowflake access control", "snowflake roles", "snowflake permissions", "RBAC snowflake"],
  },
  {
    question: "What is Dynamic Data Masking in Snowflake and how do you use it for PII protection?",
    answer: `**Dynamic Data Masking** applies masking policies to columns so different roles see different data representations — **without changing the underlying stored data**.

\`\`\`sql
-- Create masking policy for phone numbers
CREATE MASKING POLICY phone_mask AS (phone_number TEXT) RETURNS TEXT ->
  CASE
    WHEN CURRENT_ROLE() IN ('RESTAURANT_ADMIN_ROLE', 'SYSADMIN') 
      THEN phone_number                        -- full number for admins
    WHEN CURRENT_ROLE() = 'RESTAURANT_ANALYST_ROLE'
      THEN CONCAT(LEFT(phone_number, 4), '****', RIGHT(phone_number, 2))  -- partial
    ELSE '***-****-****'                       -- fully masked for AI role
  END;

-- Create policy for email
CREATE MASKING POLICY email_mask AS (email TEXT) RETURNS TEXT ->
  CASE
    WHEN CURRENT_ROLE() IN ('RESTAURANT_ADMIN_ROLE') THEN email
    ELSE CONCAT('****@', SPLIT_PART(email, '@', 2))  -- mask local part
  END;

-- Apply to columns
ALTER TABLE reservations MODIFY COLUMN customer_phone SET MASKING POLICY phone_mask;
ALTER TABLE reservations MODIFY COLUMN customer_email SET MASKING POLICY email_mask;
\`\`\`

**Effect on Cortex:**
When \`restaurant_ai_role\` calls \`SNOWFLAKE.CORTEX.COMPLETE()\` on a query that includes \`customer_phone\`, Cortex receives the **masked** value \`***-****-****\` — the LLM never sees actual PII.

This is critical for GDPR/PDPA compliance in a customer-facing AI system.`,
    aliases: ["dynamic data masking", "snowflake PII protection", "masking policy snowflake", "data masking GDPR", "snowflake PII"],
  },
  {
    question: "What is Row Access Policy in Snowflake and when is it useful?",
    answer: `**Row Access Policy** filters rows from query results based on who is querying — different users see different subsets of the same table.

**Use case for multi-restaurant system:**
A single \`reservations\` table stores bookings for 50 restaurant locations. Each restaurant manager should only see their own restaurant's data.

\`\`\`sql
-- Create a mapping table: user → restaurant_id
CREATE TABLE user_restaurant_access (
  username TEXT,
  restaurant_id TEXT
);

INSERT INTO user_restaurant_access VALUES
  ('manager_hanoi', 'REST_001'),
  ('manager_hcmc', 'REST_002'),
  ('admin_user', NULL);  -- NULL means access all

-- Create row access policy
CREATE ROW ACCESS POLICY restaurant_access_policy
AS (row_restaurant_id TEXT) RETURNS BOOLEAN ->
  -- SYSADMIN sees everything
  CURRENT_ROLE() = 'SYSADMIN'
  OR
  -- Users see only their authorized restaurants
  EXISTS (
    SELECT 1 FROM user_restaurant_access
    WHERE username = CURRENT_USER()
      AND (restaurant_id = row_restaurant_id OR restaurant_id IS NULL)
  );

-- Apply to table
ALTER TABLE reservations ADD ROW ACCESS POLICY restaurant_access_policy ON (restaurant_id);
\`\`\`

Now \`manager_hanoi\` running \`SELECT * FROM reservations\` automatically gets only REST_001 rows — no WHERE clause needed, and they can't bypass this filter.

**Combined with Cortex:** Cortex Search and COMPLETE() respect row access policies, so the AI chatbot for REST_001 can never retrieve data from REST_002.`,
    aliases: ["row access policy snowflake", "row level security snowflake", "multi tenant snowflake", "snowflake row filter"],
  },
  {
    question: "What is Snowflake Time Travel and how is it useful?",
    answer: `**Time Travel** allows you to query historical versions of data — before updates, deletes, or drops — without any special setup.

**How long:** 
- Standard edition: up to 1 day (default)
- Enterprise edition: up to 90 days (configurable)

**Syntax:**
\`\`\`sql
-- Query table as it was 1 hour ago
SELECT * FROM reservations AT (OFFSET => -3600);

-- Query as it was at a specific timestamp
SELECT * FROM reservations AT (TIMESTAMP => '2025-02-07 14:00:00'::TIMESTAMP_TZ);

-- Query before a specific statement was executed (use query ID)
SELECT * FROM reservations BEFORE (STATEMENT => '01b2c3d4-e5f6...');
\`\`\`

**Practical use cases for restaurant system:**

**1. Recover accidentally deleted reservations:**
\`\`\`sql
-- Restore deleted rows from 30 minutes ago
INSERT INTO reservations
SELECT * FROM reservations BEFORE (OFFSET => -1800)
WHERE booking_id NOT IN (SELECT booking_id FROM reservations);
\`\`\`

**2. Audit: what changed today?**
\`\`\`sql
SELECT a.*, b.*
FROM reservations AS a
FULL OUTER JOIN reservations AT (OFFSET => -86400) AS b  -- yesterday
  ON a.booking_id = b.booking_id
WHERE a.status != b.status;  -- find status changes in last 24h
\`\`\`

**3. Restore a dropped table:**
\`\`\`sql
UNDROP TABLE reservations_backup;
\`\`\``,
    aliases: ["snowflake time travel", "query historical data", "undrop table", "snowflake data recovery", "time travel query"],
  },
];

// ─── TOPIC 5: Snowflake Data Sharing & Marketplace ──────────────────────────
const SNOWFLAKE_SHARING = [
  {
    question: "What is Snowflake Data Sharing and how does it work?",
    answer: `**Data Sharing** lets you share live Snowflake data with other Snowflake accounts **without copying data** — the consumer queries your data via a shared view.

**How it works:**
\`\`\`sql
-- PROVIDER side: Create a share
CREATE SHARE restaurant_analytics_share;

-- Grant access to database/schema/tables
GRANT USAGE ON DATABASE restaurant_db TO SHARE restaurant_analytics_share;
GRANT USAGE ON SCHEMA restaurant_db.public TO SHARE restaurant_analytics_share;
GRANT SELECT ON TABLE restaurant_db.public.reservations TO SHARE restaurant_analytics_share;

-- Add consumer account
ALTER SHARE restaurant_analytics_share ADD ACCOUNTS = 'consumer_account_identifier';
\`\`\`

\`\`\`sql
-- CONSUMER side: Create database from share
CREATE DATABASE shared_restaurant_data FROM SHARE provider_account.restaurant_analytics_share;

-- Query immediately — live data, zero copies, zero storage cost for consumer
SELECT * FROM shared_restaurant_data.public.reservations;
\`\`\`

**Key properties:**
- **Zero copy:** No data duplication
- **Always fresh:** Consumer sees real-time changes
- **Governed:** Provider controls exactly which tables/columns are shared
- **Cross-cloud:** Can share across AWS/Azure/GCP regions

**Use case:** Corporate HQ shares a read-only analytics view of all restaurant locations to a third-party analytics firm — without giving them database credentials or copying data.`,
    aliases: ["snowflake data sharing", "share data snowflake", "data marketplace snowflake", "snowflake secure share"],
  },
  {
    question: "What is the Snowflake Marketplace and how can it benefit an AI restaurant system?",
    answer: `**Snowflake Marketplace** is a data exchange where providers publish datasets that consumers can access instantly into their Snowflake account — no ETL, no data movement.

**Relevant datasets for restaurant AI:**
1. **Weather data** (Tomorrow.io, Weather Source): Correlate weather with reservation demand → "Rainy Friday nights = 15% more no-shows"
2. **Holiday/events calendar**: Automatically flag local holidays, concerts, sports events → adjust pricing/staffing
3. **Consumer spending data**: Industry benchmarks for restaurant revenue, average cover price
4. **Demographic data**: Neighborhood income, age, dining preferences for new location analysis
5. **Social sentiment data**: Yelp/Google reviews aggregated for competitor analysis

**Example integration:**
\`\`\`sql
-- After mounting weather dataset from Marketplace
SELECT
    r.reservation_date,
    r.total_bookings,
    w.avg_temperature_c,
    w.precipitation_mm,
    w.weather_description
FROM daily_reservation_summary r
JOIN marketplace_weather.public.daily_forecast w
  ON r.reservation_date = w.forecast_date
  AND r.city = w.city
WHERE r.reservation_date >= DATEADD('month', -3, CURRENT_DATE());
-- Feeds into Cortex ML FORECAST or COMPLETE for demand prediction
\`\`\`

**No API keys, no ETL pipelines** — Marketplace datasets are queryable immediately via SQL after subscription.`,
    aliases: ["snowflake marketplace", "snowflake data exchange", "third party data snowflake", "marketplace datasets"],
  },
];

// ─── TOPIC 6: Snowflake Optimization & Cost ──────────────────────────────────
const SNOWFLAKE_OPTIMIZATION = [
  {
    question: "What are the main cost optimization strategies in Snowflake?",
    answer: `**Snowflake costs = compute credits + storage + cloud services fees**

**Compute optimization (biggest lever):**

**1. Auto-suspend + auto-resume:**
\`\`\`sql
ALTER WAREHOUSE CORTEX_WH SET AUTO_SUSPEND = 60;  -- 1 minute idle timeout
\`\`\`

**2. Use the right warehouse size:**
Run EXPLAIN or QUERY_HISTORY to find slow queries. Right-size rather than over-provision.

**3. Separate workloads into dedicated warehouses:**
Dev/test use XS; production analytics use S/M; never share warehouses between heavy ETL and light queries.

**4. Query result caching (free):**
Identical queries within 24 hours return cached results — 0 compute credits consumed.
Ensure queries are deterministic to benefit from this.

**5. Resource Monitors:**
\`\`\`sql
CREATE RESOURCE MONITOR monthly_budget
  WITH CREDIT_QUOTA = 500
  TRIGGERS ON 80 PERCENT DO NOTIFY
           ON 100 PERCENT DO SUSPEND;
ALTER WAREHOUSE ANALYTICS_WH SET RESOURCE_MONITOR = monthly_budget;
\`\`\`

**Storage optimization:**

**6. Set appropriate data retention (Time Travel):**
\`\`\`sql
ALTER TABLE event_logs SET DATA_RETENTION_TIME_IN_DAYS = 1;  -- don't keep 90 days for logs
\`\`\`

**7. Regularly run VACUUM / PURGE for old micro-partitions.**

**8. Compress staging files:** Use Parquet or ORC (columnar) instead of CSV for bulk loads.`,
    aliases: ["snowflake cost optimization", "reduce snowflake costs", "snowflake credits", "snowflake billing optimization"],
  },
  {
    question: "How do you diagnose slow Snowflake queries?",
    answer: `**Query diagnosis workflow:**

**Step 1: Check QUERY_HISTORY:**
\`\`\`sql
SELECT
    query_id,
    query_text,
    total_elapsed_time / 1000 AS duration_seconds,
    bytes_scanned / 1e9 AS gb_scanned,
    partitions_scanned,
    partitions_total,
    ROUND(partitions_scanned / partitions_total * 100, 1) AS pct_partitions_scanned,
    queued_overload_time,    -- time waiting for warehouse
    compilation_time
FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
WHERE start_time >= DATEADD('hour', -1, CURRENT_TIMESTAMP())
  AND total_elapsed_time > 5000  -- > 5 seconds
ORDER BY total_elapsed_time DESC;
\`\`\`

**Key indicators:**
- \`pct_partitions_scanned = 100%\` → no pruning, missing clustering key
- High \`queued_overload_time\` → warehouse too small, need to scale out
- High \`compilation_time\` → very complex query or query too large

**Step 2: Use QUERY_PROFILE (Snowsight UI):**
Visual execution plan → identify bottleneck node (e.g., HashJoin using 90% of time).

**Step 3: Diagnose and fix:**
| Symptom | Root Cause | Fix |
|---|---|---|
| 100% partitions scanned | No matching clustering key | Add clustering key or rewrite filter |
| High queue time | Insufficient concurrency | Add clusters (multi-cluster WH) or scale up |
| Large data spill to disk | Insufficient memory | Scale up warehouse size |
| Slow JOIN | Missing join column statistics | ANALYZE TABLE or restructure join |`,
    aliases: ["slow snowflake query", "query optimization snowflake", "snowflake query profiling", "diagnose snowflake performance"],
  },
];

// ─── AGGREGATE ALL Q&A ───────────────────────────────────────────────────────
const ALL_QA = [
  ...SNOWFLAKE_ARCHITECTURE,
  ...SNOWFLAKE_INGESTION,
  ...SNOWFLAKE_FOR_AI,
  ...SNOWFLAKE_GOVERNANCE,
  ...SNOWFLAKE_SHARING,
  ...SNOWFLAKE_OPTIMIZATION,
];

// ─── SEED RUNNER ─────────────────────────────────────────────────────────────
async function seed() {
  console.log(`\n🏔️  Seeding Snowflake for AI KB — ${ALL_QA.length} Q&A pairs\n`);

  let success = 0;
  let failed = 0;

  for (const qa of ALL_QA) {
    try {
      await upsertQA(qa.question, qa.answer, qa.aliases ?? []);
      console.log(`  ✅ ${qa.question.slice(0, 75)}...`);
      success++;
    } catch (err) {
      console.error(`  ❌ FAILED: ${qa.question.slice(0, 75)}`);
      console.error(`     Error:`, err);
      failed++;
    }
  }

  console.log(`\n─────────────────────────────────────────`);
  console.log(`✅ Seeded: ${success} | ❌ Failed: ${failed} | Total: ${ALL_QA.length}`);
  console.log(`─────────────────────────────────────────\n`);

  process.exit(failed > 0 ? 1 : 0);
}

seed();
