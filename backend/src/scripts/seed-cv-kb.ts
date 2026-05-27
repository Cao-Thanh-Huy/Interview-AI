/**
 * seed-cv-kb.ts
 *
 * Bulk-seeds ~66 Q&A entries based on Cao Thanh Huy's CV (Data Engineer at TMA Solutions)
 * into memory.db via the existing upsertQA pipeline.
 *
 * Run:  npx tsx src/scripts/seed-cv-kb.ts
 *
 * Persona: Senior Data Engineer / Solution Architect (5 years experience)
 * Depth:   High-level interview-ready (3–5 bullets), technically accurate
 * Lang:    English only
 */

import { upsertQA } from '../lib/localStore.js'

interface QAEntry {
  question: string
  answer: string
  aliases: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
//  TOPIC 1: Background & Self-Introduction (6 Q&A)
// ─────────────────────────────────────────────────────────────────────────────
const TOPIC_1: QAEntry[] = [
  {
    question: 'Tell me about yourself and your background as a data engineer.',
    answer: `I'm a Data Engineer with 5 years of experience designing and building enterprise-scale data platforms. I work at TMA Solutions, where I lead data engineering engagements across multiple client projects spanning healthcare, financial services, cloud analytics, and AI-driven data systems.
• My core focus is Lakehouse architecture — building full-stack data platforms using distributed object storage (S3, MinIO, ADLS), open table formats (Apache Iceberg, Delta Lake), and distributed query engines (Athena, Trino, Databricks, Snowflake) on both on-premise and cloud environments.
• I specialize in large-scale data ingestion, metadata-driven ETL/ELT pipeline orchestration, and storage optimization — all datasets I work with are stored as Parquet with partition-based layouts to enable efficient distributed query processing.
• Recently I've extended into AI-integrated data systems — I built Deckand, a GenAI Text-to-SQL data agent that enables natural language querying over enterprise data lakes using LLMs and FastAPI.`,
    aliases: [
      'Walk me through your background and experience',
      'Introduce yourself as a data engineer',
      'What have you been working on for the past 5 years?',
      'Tell me about your data engineering career',
    ],
  },
  {
    question: 'What is your primary area of expertise as a data engineer?',
    answer: `My primary expertise is Lakehouse architecture — designing and implementing the full storage-to-query stack for enterprise data platforms at scale.
• Storage and format layer: Parquet files with partition-optimized layouts (date, source_system, entity_type) on S3, MinIO, or Azure Data Lake Storage, managed via Apache Iceberg or Delta Lake for ACID transactions, schema evolution, and time travel.
• Catalog and metadata: AWS Glue Catalog, Project Nessie (Iceberg REST Catalog), or Snowflake — providing a unified metadata layer that multiple compute engines can read simultaneously.
• Distributed compute: Athena, Trino, Apache Spark/Databricks, and Snowflake — chosen per workload type. Athena for serverless interactive SQL; Trino for on-premise federated queries; Databricks/Spark for complex large-scale transformations; Snowflake for enterprise warehousing with Data Vault.
• Metadata-driven pipeline orchestration: I build configurable ETL/ELT platforms where pipeline behavior is driven by configuration, not hardcoded logic — enabling self-service pipeline creation without engineering intervention.`,
    aliases: [
      'What do you specialize in as a data engineer?',
      'What is your strongest skill in data engineering?',
      'What is your core competency?',
      'What are you best at in data engineering?',
    ],
  },
  {
    question: 'What types of projects have you worked on and in which industries?',
    answer: `I've worked across six major projects covering healthcare, financial services, cloud analytics, security, and AI/GenAI domains — all involving large-scale data at enterprise scale.
• Customer Data Platforms (CDPs): built two enterprise CDPs — one fully on-premise using MinIO, Trino, Project Nessie, and Dagster; one cloud-native on AWS using S3, Glue Catalog, Athena, and Lambda — both handling ingestion from multiple heterogeneous data sources.
• Healthcare analytics (Humana): built distributed Spark and Databricks pipelines for large-scale patient and claims data processing on Azure, integrated into Azure Synapse Analytics for BI consumption.
• Financial data platform (Resimac): designed a Data Vault Lakehouse using Azure Data Lake Storage, Snowflake (Raw Vault, Business Vault, Consumption Layer), Delta Lake, and Snowflake Cortex AI for lending and loan eligibility analytics.
• GenAI data system (Deckand): built a Text-to-SQL data agent using LLMs and FastAPI on an AWS Data Lakehouse (S3, Glue, Athena), enabling natural language querying over datasets containing millions of records.
• Security analytics (Phishing Simulation): built a cloud-native analytics platform on AWS and Databricks with Terraform-managed infrastructure for phishing simulation campaign analytics.`,
    aliases: [
      'What projects have you worked on?',
      'Walk me through your project portfolio',
      'What industries have you worked in as a data engineer?',
      'Give me examples of your data engineering work',
    ],
  },
  {
    question: 'What is TMA Solutions and what is your role there?',
    answer: `TMA Solutions is a technology and software development company that provides engineering services and solutions to enterprise clients globally.
• My role is Data Engineer — I work on client-facing engagements where I architect and implement data platforms to meet specific client analytical, operational, and compliance requirements.
• For each engagement, I own the full data engineering lifecycle: requirements analysis, architecture design, technology selection, pipeline implementation, performance optimization, and production deployment.
• I interact directly with client stakeholders to translate business data requirements into technical solutions — from proof-of-concept through production delivery.`,
    aliases: [
      'What does TMA Solutions do?',
      'What is your current role?',
      'What do you do at TMA Solutions?',
      'Describe your current position and company',
    ],
  },
  {
    question: 'How do you approach the design of a new data engineering project from scratch?',
    answer: `My approach follows a structured five-step process: requirements → architecture → data layer design → pipeline strategy → observability.
• Requirements analysis: understand data sources (volume, variety, velocity, update frequency), downstream consumers (BI dashboards, ML models, operational APIs), freshness SLAs, and compliance constraints.
• Architecture selection: choose storage layer (S3 vs ADLS vs MinIO), table format (Iceberg vs Delta Lake vs Parquet), catalog (Glue vs Nessie vs Snowflake), and compute engine (Athena vs Trino vs Databricks vs Snowflake) based on query patterns, team skills, and infrastructure constraints.
• Data layer design: define Bronze (raw, schema-on-read), Silver (cleaned, standardized, schema-on-write), and Gold/Consumption (aggregated, query-optimized) layers. For enterprise platforms, add Data Vault in the business layer.
• Pipeline strategy: metadata-driven where possible — pipelines are parametrized by configuration so adding a new data source is a config task, not a code deployment.
• Observability from day one: define metrics (row counts, latency, freshness), alerting thresholds, and data quality gates before writing the first pipeline — not after go-live.`,
    aliases: [
      'How do you start a new data engineering project?',
      'What is your process for designing a data platform?',
      'How do you architect a data solution from scratch?',
      'Your approach to data engineering project design',
    ],
  },
  {
    question: 'What cloud platforms and tools are you most experienced with?',
    answer: `I have deep hands-on experience across both AWS and Azure data stacks, plus on-premise Lakehouse tooling.
• AWS: S3 (Parquet data lake storage), Glue Catalog (metadata), Athena (serverless SQL), Lambda (event-driven triggers), EC2, API Gateway, CloudWatch (observability) — primary stack for CDP Cloud and Deckand projects.
• Azure: Azure Data Lake Storage Gen2 (object storage), Azure Synapse Analytics (warehousing + serverless SQL), Azure Databricks (Spark processing), Azure Machine Learning (MLOps), Azure DevOps (CI/CD) — used at Humana and Resimac.
• On-premise Lakehouse: MinIO (S3-compatible object storage), Trino (distributed SQL engine), Project Nessie (Iceberg-compatible transactional catalog), Dagster (pipeline orchestration) — built for the CDP On-Premise project.
• Data platforms: Snowflake (enterprise warehousing + Data Vault + Cortex AI), Databricks (Spark + Delta Lake + MLflow), Apache Spark (distributed processing).
• Programming: Python (PySpark, FastAPI, boto3, pandas), SQL (Athena/Presto dialect, Snowflake SQL, Spark SQL).`,
    aliases: [
      'What cloud platforms do you use?',
      'What tools and technologies are you experienced with?',
      'List your main data engineering technologies',
      'AWS vs Azure experience as a data engineer',
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
//  TOPIC 2: Lakehouse Architecture (8 Q&A)
// ─────────────────────────────────────────────────────────────────────────────
const TOPIC_2: QAEntry[] = [
  {
    question: 'What is a Lakehouse architecture and why do you use it?',
    answer: `A Lakehouse combines the low-cost scalable storage of a Data Lake with the ACID transactions, schema enforcement, and query performance traditionally associated with a Data Warehouse.
• The enabler is an open table format (Apache Iceberg, Delta Lake, Apache Hudi) layered on top of Parquet files in object storage (S3, ADLS, MinIO). The table format adds a transaction log, metadata layer, and statistics on top of the raw Parquet files.
• This gives you: ACID transactions (safe concurrent writes without corruption), schema evolution (add/rename columns without rewriting data), time travel (query data as of any past snapshot), and partition pruning (skip irrelevant Parquet files at query time based on partition metadata).
• I prefer Lakehouse because it decouples storage from compute: Athena, Trino, Spark, and Snowflake External Tables can all query the same Parquet data simultaneously — no duplication, no ETL between systems.
• It handles both large-scale batch processing and near-real-time incremental workloads on the same storage layer — a single platform for multiple consumption patterns.`,
    aliases: [
      'What is a Lakehouse?',
      'Lakehouse vs Data Lake vs Data Warehouse',
      'Why use Lakehouse architecture instead of a traditional warehouse?',
      'Explain the Lakehouse architectural pattern',
    ],
  },
  {
    question: 'Can you explain the on-premise Lakehouse you built using MinIO, Trino, and Project Nessie?',
    answer: `This was a fully on-premise Enterprise Customer Data Platform built for clients who could not move data to the cloud due to compliance or infrastructure constraints.
• MinIO is an S3-compatible object storage server deployed on-premise — it stores all data as Parquet files organized by partition directories (e.g., source_system/partition_date/). MinIO is API-compatible with S3, so all tooling that works with S3 works with MinIO unchanged.
• Project Nessie is an open-source transactional catalog implementing the Apache Iceberg REST Catalog specification. It manages table metadata (schema, partition spec, snapshot history) and supports Git-like catalog branching — different pipeline teams can work on isolated catalog branches without interfering with each other.
• Trino is the distributed SQL query engine — it connects to Nessie as its Iceberg catalog and queries Parquet files on MinIO. Any Trino cluster node can execute SQL across terabytes of Parquet data in parallel via MPP execution.
• Dagster orchestrates all ingestion and transformation pipelines as software-defined assets, providing full lineage tracking from raw source files through to the final Consumption Layer tables.`,
    aliases: [
      'Explain your on-premise Lakehouse architecture',
      'MinIO Trino Project Nessie stack explained',
      'How did you build the on-premise CDP data platform?',
      'On-premise Lakehouse components and design',
    ],
  },
  {
    question: 'How did you design the AWS-based Lakehouse for the cloud CDP project?',
    answer: `The cloud CDP on AWS is a serverless-first, fully managed Lakehouse built around the S3, Glue Catalog, and Athena trio.
• Storage layer: Amazon S3 stores all data as Parquet files, organized by partition key hierarchies (e.g., source=crm/year=2024/month=01/day=15/). Partition layout is designed around the most common Athena query predicates to maximize partition pruning efficiency.
• Catalog layer: AWS Glue Data Catalog manages all table metadata — schema, partition locations, data types. Glue Crawlers auto-register new partitions after each pipeline run, making data immediately available for Athena queries.
• Compute layer: Amazon Athena executes serverless SQL directly against S3 Parquet — no cluster to provision. Athena's Presto-based engine supports partition pruning, predicate pushdown into Parquet row groups, and columnar projection to minimize data scanned.
• Processing layer: AWS Glue ETL Jobs (serverless Spark) for heavy transformations; AWS Lambda for event-driven, lightweight processing triggered by S3 events; EC2-based services for persistent stateful processing.
• Observability: Amazon CloudWatch captures all pipeline execution metrics, custom business metrics (rows_processed, data_freshness), and alarms for pipeline failures and SLA breaches.`,
    aliases: [
      'AWS Lakehouse architecture design',
      'S3 Glue Catalog Athena data platform explained',
      'How did you design the cloud CDP on AWS?',
      'Cloud-native Lakehouse architecture on AWS',
    ],
  },
  {
    question: 'What is Project Nessie and how does it compare to AWS Glue Catalog?',
    answer: `Both serve as catalog layers for Lakehouse architectures — they store table metadata, schema, and partition information that query engines use to locate data. The key differences are operational model and features.
• Project Nessie: open-source, self-hosted, Git-like branching model. You create named branches of the entire catalog — teams can commit schema changes on a branch, test with Trino queries, and merge to main without disrupting production. Implements the Apache Iceberg REST Catalog API, making it compatible with any Iceberg-aware engine.
• AWS Glue Catalog: fully managed, AWS-native, serverless. Zero operational burden — AWS maintains it. Natively integrated with Athena, EMR, Glue ETL, and Lake Formation (permissions). No branching; flat namespace of databases and tables.
• I use Nessie for on-premise multi-engine architectures where catalog branching is needed for safe concurrent development. I use Glue Catalog for AWS-native architectures where Athena is the primary query engine and simplicity of operations is the priority.`,
    aliases: [
      'What is Project Nessie?',
      'Project Nessie vs AWS Glue Catalog comparison',
      'Apache Iceberg catalog options and trade-offs',
      'How does Nessie work as a data catalog?',
    ],
  },
  {
    question: 'What partitioning strategy do you use for large-scale Parquet datasets?',
    answer: `Partition design is one of the most impactful decisions in Lakehouse architecture — it directly determines query latency and cost for Athena, Trino, and Snowflake External Table queries.
• Partition key selection: choose keys matching the most frequent query predicates. Time-based partitioning (partition_date, year/month/day hierarchy) is almost always the primary key since analytical queries almost always have a date range filter.
• Compound partitioning: add a secondary high-selectivity key (source_system, region, entity_type) when queries commonly filter on both dimensions — enables compound partition pruning that dramatically reduces data scanned.
• Target Parquet file size: 128MB–512MB per file. Smaller files cause the "small file problem" — excessive metadata reads and task overhead in Athena, Trino, and Spark. Larger files reduce write parallelism.
• File compaction: I run periodic OPTIMIZE or Spark repartition() jobs to compact small files (produced by frequent small incremental loads) into right-sized files. In Iceberg, this is a single ALTER TABLE EXECUTE OPTIMIZE statement.
• Hidden partitioning (Iceberg): Iceberg supports hidden partitioning where the partition column doesn't need to exist in the data — the catalog stores the partition transform (e.g., days(event_timestamp)) and applies it transparently during writes and reads.`,
    aliases: [
      'What partitioning strategy do you use for Parquet data?',
      'How do you partition data in the Lakehouse?',
      'Partition pruning strategy for Athena and Trino',
      'How do you optimize Parquet storage for large datasets?',
    ],
  },
  {
    question: 'What is the difference between Delta Lake and Apache Iceberg, and when do you choose each?',
    answer: `Both are open table formats providing ACID transactions, time travel, schema evolution, and partition management over Parquet files. The primary difference is compute engine integration and ecosystem.
• Delta Lake: originated at Databricks, tightly integrated with Apache Spark and the Databricks platform. The transaction log (delta_log) is a sequence of JSON commit files stored alongside Parquet data. Native support in Databricks, good Spark integration, but historically weaker support outside the Databricks ecosystem.
• Apache Iceberg: originated at Netflix, now an Apache Software Foundation top-level project. Compute-agnostic — natively supported by Athena, Trino, Presto, Spark, Snowflake External Tables, and Flink. Better choice for multi-engine architectures where the same dataset must be accessed by different compute engines.
• My choice: I use Delta Lake in Databricks-centric projects (Humana on Azure Databricks) because of the tight Databricks integration (AutoLoader, OPTIMIZE, Z-Ordering). I use Apache Iceberg in multi-engine architectures (CDP On-Premise with Trino + Nessie) because its broad engine support means I'm not locked into one query engine.`,
    aliases: [
      'Delta Lake vs Apache Iceberg — which do you use?',
      'When do you choose Delta Lake over Iceberg?',
      'Open table format comparison for Lakehouse',
      'Differences between Delta Lake and Apache Iceberg',
    ],
  },
  {
    question: 'How do you implement data versioning and time travel in your Lakehouse?',
    answer: `Time travel is a native capability of both Iceberg and Delta Lake — it requires no additional infrastructure, only a correctly maintained transaction log.
• Mechanism: every write operation (INSERT, UPDATE, DELETE, MERGE) commits a new snapshot to the transaction log. Each snapshot references the exact set of Parquet files that constitute the table at that point in time. Old Parquet files are retained (not deleted) until explicitly expired.
• Iceberg time travel query: SELECT * FROM table FOR SYSTEM_TIME AS OF TIMESTAMP '2024-01-15 00:00:00' — returns the table as it existed at that timestamp.
• Delta Lake time travel: SELECT * FROM delta.\`s3://bucket/path\` VERSION AS OF 42 — queries by snapshot version number; or TIMESTAMP AS OF '2024-01-15' for timestamp-based travel.
• Snapshot retention and garbage collection: I configure retention policies — typically keep 30 days of snapshots for compliance and debugging, then expire older snapshots and run VACUUM (Delta) or expire_snapshots (Iceberg) to reclaim orphaned Parquet file storage.
• Practical uses: reprocessing a date range after a pipeline bug (roll back to pre-bug snapshot), audit trail queries for compliance, and A/B comparison of transformation output versions.`,
    aliases: [
      'How does time travel work in your data platform?',
      'Data versioning in Iceberg and Delta Lake',
      'How do you query historical data in the Lakehouse?',
      'Snapshot management and time travel explained',
    ],
  },
  {
    question: 'How do you handle schema evolution in your Lakehouse pipelines?',
    answer: `Schema evolution — adding, renaming, or removing columns from a live table — is one of the hardest operational challenges in data pipelines. Iceberg and Delta Lake handle it natively, but it still requires careful process discipline.
• Adding columns: both Iceberg and Delta Lake support safe column addition without rewriting existing Parquet files. New columns appear as NULL in historical data unless backfilled. Athena, Trino, and Spark transparently handle reading Parquet files with different column sets.
• Renaming columns: Iceberg supports column renaming at the metadata level — the physical Parquet files are not rewritten; the catalog maps old column IDs to new names. Delta Lake also supports RENAME COLUMN since Delta 2.0.
• Schema-on-read vs schema-on-write: in the Bronze layer I use schema-on-read (accepting any incoming format). Silver and above enforce schema-on-write — Iceberg and Delta Lake reject writes that don't conform to the defined schema.
• Metadata-driven tracking: I maintain a schema registry that records column definitions and evolution history. Pipelines check the registry at runtime to determine how to map incoming source columns to the canonical schema — enabling automatic handling of source schema changes within defined bounds.`,
    aliases: [
      'How do you handle source schema changes in your pipelines?',
      'Schema evolution strategy in Lakehouse architecture',
      'What happens when a source system adds or renames a column?',
      'Apache Iceberg schema evolution capabilities',
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
//  TOPIC 3: ETL/ELT Pipelines & Orchestration (8 Q&A)
// ─────────────────────────────────────────────────────────────────────────────
const TOPIC_3: QAEntry[] = [
  {
    question: 'What is the difference between ETL and ELT, and when do you use each?',
    answer: `ETL and ELT differ in where transformation happens — before or after loading into the target system. The rise of distributed query engines has made ELT the dominant pattern for modern data platforms.
• ETL (Extract, Transform, Load): data is transformed in a processing layer before loading into the target. Historically necessary when the target warehouse had limited compute. Still appropriate for very strict data masking requirements where raw data must never touch the target system.
• ELT (Extract, Load, Transform): raw data is loaded into the data lake first (Bronze layer), then transformed using the full compute power of the distributed query engine (Spark, Athena, Trino, Snowflake). This is my primary pattern in all Lakehouse projects.
• Why ELT for Lakehouse: raw data is preserved for reprocessing (no data loss from pre-load transformation), transformations leverage massively parallel distributed engines, and you cleanly separate storage cost (cheap object storage) from compute cost (pay-per-use).
• ETL is still appropriate for: streaming data with stateful transformations before landing (Spark Structured Streaming), or when source data contains PII that must be masked before any storage.`,
    aliases: [
      'ETL vs ELT — what is the difference?',
      'When do you use ETL versus ELT?',
      'Why prefer ELT over ETL in modern data platforms?',
      'ELT pattern in Lakehouse architecture',
    ],
  },
  {
    question: 'What is a metadata-driven pipeline and why did you build one in the CDP projects?',
    answer: `A metadata-driven pipeline is one where the pipeline's behavior — source, target, transformations, partitioning, schedule — is controlled by configuration data in a metadata store, not hardcoded in pipeline code.
• Instead of writing a new pipeline for every new data source, you define a configuration record: source_type (Postgres, REST API, S3 file), connection_params, target_table, partition_key, ingestion_mode (full/incremental), and schedule. A generic pipeline engine reads this config and executes accordingly.
• In the CDP On-Premise project: I built a self-service orchestration platform analogous to AWS Glue Studio — data engineers configure pipelines through a YAML file or API call; the Dagster-based engine generates and executes the DAG dynamically from the configuration.
• Benefits: adding a new source system is a configuration task (minutes) instead of a code deployment (days). Bug fixes in the generic pipeline engine propagate to all pipelines simultaneously. Non-engineers can trigger pipelines via an API interface without touching code.
• The metadata store also doubles as the pipeline inventory — you can query it to answer: "which sources feed this target table?" or "which pipelines ran in the last 24 hours?" — providing operational visibility without additional tooling.`,
    aliases: [
      'What is a metadata-driven pipeline?',
      'How do you build configurable and dynamic ETL pipelines?',
      'Self-service pipeline orchestration design',
      'Dynamic pipeline generation from configuration',
    ],
  },
  {
    question: 'How does Dagster work as a pipeline orchestrator and why did you choose it?',
    answer: `Dagster is a data orchestration platform that models pipelines as software-defined assets — you define data assets (tables, files, models) and Dagster manages their dependencies, freshness, and execution.
• Software-defined assets: instead of scheduling tasks that produce unnamed outputs, you declare named assets with clear upstream/downstream dependencies. Dagster's asset graph shows the full lineage from raw source files to Consumption Layer tables — automatically, without extra configuration.
• Asset freshness and partitioning: Dagster natively understands time-partitioned assets (daily Parquet partitions, for example) and can determine which partitions are stale and need reprocessing. You don't need to implement partition tracking logic manually.
• Built-in observability: every asset materialization records metadata — rows written, schema, execution time, custom metrics — visible in the Dagster UI without additional instrumentation.
• Why Dagster over Airflow: Airflow schedules task execution; Dagster understands data lineage and asset freshness. For a Lakehouse where the primary abstraction is data assets (tables, partitions), Dagster's model maps directly to the architecture. Dagster also has a significantly better developer experience for testing pipeline logic in isolation.`,
    aliases: [
      'How does Dagster work?',
      'Why use Dagster instead of Airflow for orchestration?',
      'Dagster software-defined assets explained',
      'Dagster vs Airflow for data pipeline orchestration',
    ],
  },
  {
    question: 'How do you build CDC (Change Data Capture) pipelines?',
    answer: `CDC captures row-level changes from source transactional databases (INSERTs, UPDATEs, DELETEs) continuously, rather than doing expensive full table scans for each pipeline run.
• Source capture: read from the database transaction log (Debezium for PostgreSQL and MySQL using logical replication) or use source-system CDC APIs. This produces a stream of change events: operation_type (I/U/D), before_image, after_image, commit_timestamp, and primary key.
• Landing in Bronze: change events land as append-only Parquet files in the Bronze layer with a standardized envelope schema: source_system, operation_type, event_timestamp, primary_key, payload. No records are ever deleted from Bronze.
• MERGE into Silver: downstream transformation jobs apply the CDC events to the Silver layer using MERGE (UPSERT/DELETE) operations — Iceberg MERGE INTO or Delta Lake MERGE INTO. The MERGE matches on primary key: UPDATE for 'U' events, INSERT for 'I' events, DELETE for 'D' events (typically a soft delete with is_deleted=true rather than physical deletion).
• Exactly-once semantics: use idempotency keys (commit_timestamp + primary_key) and deduplication in the MERGE to handle duplicate CDC events from retry scenarios.`,
    aliases: [
      'How do you implement Change Data Capture pipelines?',
      'CDC pipeline design and implementation',
      'How do you sync database changes into the Lakehouse?',
      'Debezium CDC pipeline for data lakes',
    ],
  },
  {
    question: 'How do you ingest data from multiple heterogeneous data sources?',
    answer: `Multi-source ingestion requires a connector abstraction layer that normalizes different source protocols into a common output format, so downstream pipeline logic is source-agnostic.
• Connector registry: each source type has a standard connector implementation with a common interface. For example: PostgresConnector, RestApiConnector, S3FileConnector, KafkaConnector — all implement extract() which returns a Spark DataFrame or writes Parquet to the landing zone.
• Synchronization strategy by source type: relational databases use watermark-based incremental extraction (WHERE updated_at > :last_run_watermark) or CDC; REST APIs use paginated polling with cursor/timestamp pagination; file drops use S3 event notifications triggering Lambda; streaming sources use Kafka consumers.
• Bronze layer convergence: all sources land data with a common envelope schema — source_system, ingestion_timestamp, partition_date, and the original payload fields. This means Silver layer transformation logic only needs to handle the canonical Bronze schema.
• In the CDP projects: we ingested from 10+ enterprise source systems simultaneously — ERP, CRM, POS, web analytics, mobile events — using this connector framework. Adding a new source required only a new connector configuration, not new pipeline code.`,
    aliases: [
      'How do you handle ingestion from multiple data sources?',
      'Multi-source ingestion architecture',
      'How do you integrate different data sources into the Lakehouse?',
      'Heterogeneous data source ingestion design',
    ],
  },
  {
    question: 'How do you ensure pipeline reliability and handle failures in production?',
    answer: `Pipeline reliability is built from three principles: idempotency (safe to re-run), isolation (failures don't corrupt good data), and observability (failures are detected immediately and automatically).
• Idempotent pipelines: every pipeline job is safe to re-run. For partition-based loads: overwrite the target partition entirely (partition overwrite semantics) — a re-run produces identical results without duplication. For MERGE-based loads: idempotency is guaranteed by matching on primary key.
• Write-then-commit: write Parquet files to a staging prefix first, then atomically rename/move to the final partition location — or use Iceberg/Delta Lake transactions that only make data visible on successful commit. A failed job leaves no partial data visible to query engines.
• Retry policies: transient errors (network timeouts, API rate limits) trigger automatic retries with exponential backoff configured in Dagster or Glue. Max 3 retries before marking the run as failed and alerting.
• Data quality gates at each stage boundary: row count validation, null checks on key columns, and schema conformance checks. If any check fails, the pipeline halts and alerts before bad data propagates downstream.`,
    aliases: [
      'How do you handle pipeline failures in production?',
      'Pipeline reliability and fault tolerance design',
      'How do you make data pipelines resilient to failures?',
      'Error handling and retry strategy in ETL pipelines',
    ],
  },
  {
    question: 'How do you implement incremental versus full refresh data loading?',
    answer: `The choice between incremental and full refresh depends on data volume, source system capabilities, and the complexity of detecting changes.
• Full refresh: drop and reload the entire target table or partition. Appropriate for small reference/dimension tables (<1M rows) or sources that don't expose a change timestamp. Simple to implement, but impractical at TB scale.
• Watermark-based incremental: query the source for records where updated_at > last_successful_run_timestamp. Load only new and changed records, then MERGE into the target table. Requires a reliable, indexed watermark column in the source.
• Partition-based incremental (append-only data): for event streams and logs, data is immutable once written. Load each day's data into its own partition — once written, a partition is never reprocessed. This is the most efficient pattern for log data, clickstreams, and IoT events.
• CDC-based incremental: for sources that don't have a reliable watermark but do have CDC available — capture all row-level changes from the database transaction log. Most accurate incremental pattern, catches UPDATE and DELETE operations that watermark-based approaches miss.`,
    aliases: [
      'Incremental vs full refresh pipeline strategy',
      'How do you implement incremental data loading?',
      'Watermark-based vs partition-based incremental loading',
      'When do you use full refresh versus incremental pipeline?',
    ],
  },
  {
    question: 'What pipeline orchestration tools have you used and how do they compare?',
    answer: `I've used Dagster, AWS Glue, Databricks Workflows, and Terraform across different projects — each with distinct strengths for different architectural contexts.
• Dagster: used in the on-premise CDP. Asset-first model with automatic lineage tracking, excellent Python-native development, and a powerful UI for monitoring asset materialization history. Best choice when data asset lineage and freshness management are priorities.
• AWS Glue (ETL Jobs + Workflows): used in the cloud CDP. Serverless, deeply integrated with the AWS ecosystem (Glue Catalog, S3, Athena, CloudWatch). Lower setup overhead than Dagster but less flexible for complex DAG logic and weaker developer experience for local testing.
• Databricks Workflows: used at Humana and Phishing Simulation. Tightly integrated with Databricks notebooks and Spark clusters — best for Databricks-centric architectures where most processing is Spark or SQL notebooks. Multi-task workflow graph with retry policies and cluster management.
• Terraform: not an orchestrator per se, but I use Terraform to define all pipeline infrastructure (Lambda, Glue Jobs, S3 event notifications) as code — ensuring reproducible, version-controlled environments. Particularly important in the Phishing Simulation project where the platform deploys across multiple client environments.`,
    aliases: [
      'What orchestration tools have you used?',
      'Dagster vs AWS Glue vs Databricks Workflows comparison',
      'How do you compare pipeline orchestration tools?',
      'Which workflow orchestrator do you recommend and why?',
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
//  TOPIC 4: Distributed Processing — Spark & Databricks (7 Q&A)
// ─────────────────────────────────────────────────────────────────────────────
const TOPIC_4: QAEntry[] = [
  {
    question: 'How do you use Apache Spark for large-scale data processing in your projects?',
    answer: `Spark is my primary distributed processing engine for transformations at a scale where single-node processing would be either too slow or cost-prohibitive.
• Core use case: multi-table JOIN operations across large Parquet datasets, complex window functions (rolling aggregations, sessionization, ranking) over time-series data, and data quality scans that must process the full dataset.
• I write PySpark transformations as modular functions parametrized by input paths, output paths, and partition keys — enabling reuse across pipeline stages and different datasets.
• Databricks-hosted Spark: I use Delta Lake as the table format, Databricks AutoLoader for incremental file detection from S3/ADLS, and Databricks Workflows for job scheduling with cluster lifecycle management.
• At Humana: Spark processed high-volume healthcare datasets (patient records, claims data) from Azure Storage Account — PySpark jobs performed ingestion, cleansing, deduplication, and transformation before writing Delta tables consumed by Azure Synapse Analytics.`,
    aliases: [
      'How do you use Apache Spark in your projects?',
      'Spark for large-scale data transformation',
      'PySpark data engineering approach',
      'How do you process big data with Spark?',
    ],
  },
  {
    question: 'How do you optimize Spark jobs for performance on large-scale datasets?',
    answer: `Spark performance tuning is about reducing data movement (shuffles), minimizing data read (predicate pushdown and partition pruning), and correctly sizing compute resources for the workload.
• Partition tuning: set spark.sql.shuffle.partitions explicitly based on data volume. Default is 200, which is too low for large datasets and too high for small ones. Target 128MB–256MB per shuffle partition.
• Predicate pushdown: structure WHERE clauses to filter data as early as possible in the query plan. With Parquet + Iceberg/Delta Lake, predicates push down to the storage layer — Spark skips entire Parquet row groups or partition directories that don't match the filter.
• Broadcast JOINs: for JOINs between a large table and a small dimension table (<100MB), force a broadcast JOIN (spark.broadcast or explicit broadcast() hint) — eliminates the expensive SortMergeJoin shuffle.
• Avoiding data skew: identify skewed keys (a single JOIN key value with 10x more data than others) and apply salting or use Databricks's AQE (Adaptive Query Execution) which handles skew automatically by splitting large tasks.
• File compaction before output: call repartition() before writing final Parquet output to ensure right-sized files (128MB–512MB) — preventing the small file problem that degrades downstream Athena and Trino query performance.`,
    aliases: [
      'How do you optimize Spark job performance?',
      'Spark performance tuning techniques',
      'How do you make Spark jobs run faster on large datasets?',
      'Spark optimization strategies for big data',
    ],
  },
  {
    question: 'What is Databricks and how have you used it across your projects?',
    answer: `Databricks is a unified data and AI platform built on Apache Spark, providing managed Spark clusters, collaborative notebooks, Delta Lake integration, Databricks Workflows for orchestration, and MLflow for ML experiment tracking.
• At Humana: I built large-scale healthcare data ingestion and transformation pipelines using Databricks PySpark notebooks processing patient and claims data from Azure Storage Account. Databricks AutoLoader handled incremental file detection, Delta Lake managed ACID transactions, and transformed data was written to Azure Synapse Analytics via Synapse external tables.
• At Phishing Simulation: I used Databricks on AWS to build ETL pipelines ingesting learner behavioral data from S3, processing with distributed Spark transformations, and writing analytics-ready Parquet tables queryable by Athena.
• Databricks AutoLoader was particularly valuable: it monitors S3 and ADLS paths for new files using file notifications (SQS on AWS, Azure Event Grid on Azure), processing each new file exactly once — eliminating the need for manual file tracking or partition registration.`,
    aliases: [
      'What is Databricks?',
      'How have you used Databricks in your projects?',
      'Databricks experience across different projects',
      'What did you build using Databricks?',
    ],
  },
  {
    question: 'What is Databricks AutoLoader and when would you use it?',
    answer: `AutoLoader is Databricks's incremental file ingestion feature that automatically detects and processes new files landing in cloud storage (S3, ADLS, GCS) without manual file tracking or partition management.
• How it works: in file notification mode, AutoLoader uses S3 Event Notifications → SQS (AWS) or Azure Event Grid → Azure Event Hub (Azure) to receive real-time notifications when new files land. In directory listing mode, it periodically scans the directory and detects new files by comparing against a checkpoint of previously processed files.
• Exactly-once processing: AutoLoader maintains a checkpoint in cloud storage that records which files have been processed. Retries are safe — each file is processed exactly once regardless of failures.
• Schema inference and evolution: AutoLoader can infer schema from the first batch and automatically evolve the schema as new columns appear in incoming files — configurable to fail, rescue unknown columns into a separate field, or auto-merge.
• I use AutoLoader in trigger-available mode (trigger=availableNow) rather than continuous streaming — it processes all new files since the last checkpoint in a single micro-batch run, then terminates. This gives incremental semantics without a continuously running streaming cluster.`,
    aliases: [
      'What is Databricks AutoLoader?',
      'How does AutoLoader handle incremental file ingestion?',
      'Databricks AutoLoader vs manual file scanning',
      'When would you use Databricks AutoLoader?',
    ],
  },
  {
    question: 'How does Databricks integrate with Azure (Azure Databricks) and AWS?',
    answer: `Databricks runs as a managed service on both Azure and AWS — the core Spark and Delta Lake capabilities are identical, but the cloud integrations differ by platform.
• Azure Databricks (used at Humana): natively integrates with Azure Data Lake Storage Gen2 via managed identity or service principal authentication — no credential management in code. Delta tables in ADLS are directly accessible from Azure Synapse Analytics via Synapse Link or Synapse Serverless SQL, enabling seamless data sharing. Azure Active Directory governs user and group access to Databricks workspaces.
• Databricks on AWS (used at Phishing Simulation): accesses S3 via IAM instance profiles attached to EC2 worker nodes — no credentials stored in notebooks or job configs. Data written to S3 as Delta or Parquet is queryable by Athena using Glue Catalog external table definitions.
• Unity Catalog: Databricks's cross-cloud governance layer — a single catalog for all Delta tables spanning AWS and Azure environments, with column-level access control and automatic data lineage tracking across all Databricks workspaces.`,
    aliases: [
      'How does Databricks integrate with Azure?',
      'Databricks on AWS vs Azure Databricks differences',
      'Azure Databricks data platform integration',
      'Databricks cloud platform integration patterns',
    ],
  },
  {
    question: 'What is the difference between batch processing and stream processing, and how do you decide which to use?',
    answer: `Batch and stream processing represent a fundamental architectural trade-off between operational simplicity and data freshness latency.
• Batch processing: data is accumulated over a defined time window (hourly, daily) and processed in bulk. Advantages: simple to implement, efficient (large files, optimal partition sizes), compatible with all storage and compute engines. Appropriate when freshness SLA is hours to days.
• Stream processing: data is processed continuously as it arrives — sub-second to seconds latency. Requires a streaming engine (Spark Structured Streaming, Flink, Kafka Streams) and a streaming-compatible storage format. Higher operational complexity and cost.
• My current projects all use batch or micro-batch: S3 event triggers on file arrival invoke Lambda → Glue jobs or Databricks AutoLoader processes files within minutes of landing. This provides sufficient freshness for BI dashboards and analytical workflows.
• For true streaming requirements (fraud detection, real-time operational dashboards with <1 minute freshness): I would add Kafka for event streaming and Spark Structured Streaming or Flink for continuous processing — though none of my current projects required sub-minute latency.`,
    aliases: [
      'Batch vs stream processing — how do you decide?',
      'When do you use streaming vs batch data processing?',
      'Real-time vs batch in your data engineering projects',
      'Stream processing vs batch processing trade-offs',
    ],
  },
  {
    question: 'How do you handle data skew in Spark for large-scale distributed processing?',
    answer: `Data skew occurs when one or more key values have disproportionately more data than others — causing a few Spark tasks to process 10–100x more data than the rest, creating a bottleneck that stalls the entire job.
• Detection: identify skewed keys by checking the distribution of the JOIN or GROUP BY key column. If a few values account for >50% of the data, skew is likely.
• Salting technique: add a random suffix (0 to N) to the skewed key in one table, and replicate the other table N times (CROSS JOIN with integers 0 to N). This distributes the skewed key across N partitions. Remove the salt suffix after the join.
• Databricks AQE (Adaptive Query Execution): Databricks's Spark runtime includes AQE which automatically detects and handles skew at runtime — it splits large skewed tasks into smaller ones without manual intervention. Enabled by spark.sql.adaptive.enabled=true.
• Skew JOIN hint: in Spark 3.x, use SELECT /*+ SKEW('large_table', 'skewed_column') */ — tells Spark which column is skewed so it applies specialized handling.
• For Humana healthcare data: claim records for certain high-volume providers (large hospital networks) were heavily skewed. We applied salting on the provider_id key for the aggregation step.`,
    aliases: [
      'How do you handle Spark data skew?',
      'Data skew problem and solutions in Spark',
      'How do you fix skewed partitions in PySpark?',
      'Spark skew join optimization techniques',
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
//  TOPIC 5: AWS Cloud Data Stack (7 Q&A)
// ─────────────────────────────────────────────────────────────────────────────
const TOPIC_5: QAEntry[] = [
  {
    question: 'Can you describe your experience with the AWS data engineering stack?',
    answer: `I've built two major data platforms on AWS: the cloud-native CDP and the Phishing Simulation Analytics Platform — both using a serverless-first architectural approach.
• Core data stack: S3 for scalable Parquet object storage, AWS Glue Data Catalog for centralized table metadata management, Amazon Athena for serverless SQL queries directly on S3, AWS Lambda for event-driven pipeline triggering, and Amazon CloudWatch for full observability.
• Processing layer: AWS Glue ETL Jobs (serverless Spark) for heavy transformation workloads; Lambda for lightweight event-driven processing; EC2-based services for persistent processing services requiring stateful operation.
• Infrastructure as code: all AWS resources — S3 buckets, Glue Catalog databases/tables, Lambda functions, IAM roles, API Gateway endpoints, CloudWatch alarms — are defined in Terraform or AWS CDK, ensuring reproducible environments.
• API layer: I exposed pipeline management functions (trigger pipeline, check job status, query data stats) as REST APIs via API Gateway backed by Lambda, enabling operational control without direct AWS console access.`,
    aliases: [
      'What AWS services have you used for data engineering?',
      'AWS data engineering stack experience',
      'Tell me about your AWS data platform experience',
      'AWS services used in your projects',
    ],
  },
  {
    question: 'How does Amazon Athena work and what are its strengths and limitations?',
    answer: `Amazon Athena is a serverless, interactive SQL query service that executes SQL directly on data stored in S3, using a Presto-based distributed query engine. You pay only for the data scanned per query (approximately $5 per TB scanned).
• How it works: Athena reads table schema from AWS Glue Catalog, resolves partition locations from the catalog, and distributes query execution across a managed Presto cluster. Query results are written to an S3 output location and returned to the client.
• Key strengths: zero cluster management (fully serverless), native Glue Catalog integration, supports Parquet (columnar, compressed), ORC, JSON, and CSV. Partition pruning and Parquet predicate pushdown dramatically reduce data scanned and query cost.
• Query cost optimization: a well-partitioned table queried by its partition key scans only the relevant S3 partitions. Combined with Parquet's columnar projection (Athena only reads the columns in the SELECT clause), a query that would scan 1TB of raw data might scan only 10GB of well-structured Parquet — a 100x cost reduction.
• Limitations: Athena is optimized for read-heavy analytical queries. It does not support row-level DML (UPDATE, DELETE) natively — MERGE operations require writing new Parquet files and managing partitions externally (or using Iceberg tables on Athena v3). Query startup latency is ~1–3 seconds — not suitable for sub-second operational queries.`,
    aliases: [
      'How does Amazon Athena work?',
      'Athena strengths and limitations for data engineering',
      'Athena vs Redshift vs Spark for SQL analytics',
      'When would you use Amazon Athena?',
    ],
  },
  {
    question: 'How does AWS Glue Data Catalog work and what role does it play in your architecture?',
    answer: `AWS Glue Data Catalog is a fully managed metadata repository that stores table definitions — schema, column names and types, partition keys, and S3 data location — used by Athena, Glue ETL, EMR, and Spark on EC2 as a shared Hive Metastore.
• Role in Lakehouse: it is the single source of truth for table schemas and partition locations. When Athena executes a query, it resolves which S3 prefixes to read by querying the Glue Catalog for the table's partition map — this is how partition pruning works.
• Glue Crawlers: automated schema discovery — they scan S3 paths, infer schema from Parquet files, and register or update table definitions in the catalog. I configure Crawlers to run after each pipeline batch to register new partitions automatically.
• In my CDP AWS project: every ingestion job writes Parquet files to the appropriate S3 partition prefix, then runs an AWS SDK call (batch_create_partition or a Glue Crawler) to register the new partition in the Glue Catalog. Athena can then immediately query the new data.
• Lake Formation integration: for fine-grained access control, AWS Lake Formation sits on top of Glue Catalog and enforces column-level and row-level security — controlling which IAM users or roles can access which tables and columns.`,
    aliases: [
      'How does AWS Glue Data Catalog work?',
      'What is the role of Glue Catalog in your architecture?',
      'Glue Catalog vs Hive Metastore',
      'AWS Glue Catalog metadata management explained',
    ],
  },
  {
    question: 'How do you use AWS Lambda in your data pipelines?',
    answer: `Lambda functions serve as the event-driven trigger and lightweight processing layer in my AWS pipelines — not as heavy transformation engines. Heavy processing goes to Glue ETL or Athena.
• S3 event-driven ingestion: S3 PUT events trigger Lambda functions that validate incoming files (format check, file size sanity check) and invoke Glue ETL Jobs or Step Functions to process the data. This creates a push-based, near-real-time ingestion pipeline without polling.
• API Gateway + Lambda: I expose pipeline management endpoints as REST APIs — trigger a specific pipeline, check job status, initiate a data quality report. API Gateway handles authentication and throttling; Lambda executes the business logic (boto3 calls to Glue, Step Functions, or Athena).
• Lightweight transformations: small fan-out or aggregation operations that complete within Lambda's 15-minute timeout and 10GB memory limit — for example, computing file statistics, splitting large files into smaller chunks for parallel Glue processing.
• Lambda limitations I respect: 15-minute execution timeout, 10GB max memory, and no persistent state. For jobs exceeding these limits (large Spark transformations, long-running aggregations), Lambda is only the trigger; Glue, Athena, or Databricks does the actual work.`,
    aliases: [
      'How do you use AWS Lambda in data engineering?',
      'Lambda for data pipeline triggering and processing',
      'Serverless data pipeline design with Lambda',
      'Lambda vs Glue ETL for data processing',
    ],
  },
  {
    question: 'How do you implement monitoring and observability for AWS data pipelines using CloudWatch?',
    answer: `I treat observability as a first-class architectural concern — metrics, logs, and alarms are designed into the pipeline, not added as an afterthought.
• Structured logging: all pipeline code emits structured JSON logs to CloudWatch Logs with consistent fields: job_name, source_table, partition_date, rows_processed, bytes_written, duration_ms, and status. JSON format enables CloudWatch Logs Insights queries for operational analytics.
• Custom metrics: pipeline code publishes custom CloudWatch Metrics with dimensions (job_name, source_system, environment) for: rows_ingested, files_processed, error_count, and data_freshness_seconds. These appear on operational dashboards alongside infrastructure metrics.
• CloudWatch Alarms: alert on error_count > 0 for any pipeline run (PagerDuty/SNS notification), data freshness > 2x SLA (warning), and Athena query P95 latency exceeding baseline (query performance degradation detection).
• Dashboards: I build a data platform health dashboard in CloudWatch showing: pipeline success rates by source, daily ingestion volumes per table, P95 pipeline duration trends, and current data freshness per critical table — giving operations team a single pane of glass.`,
    aliases: [
      'How do you monitor AWS data pipelines?',
      'CloudWatch for data pipeline observability',
      'How do you build monitoring for AWS data platforms?',
      'Logging and alerting strategy for AWS data workflows',
    ],
  },
  {
    question: 'What is serverless data processing on AWS and when is it appropriate?',
    answer: `Serverless means the cloud provider manages all server provisioning, scaling, and availability — you define the code and execution parameters, the platform handles the rest.
• Amazon Athena: serverless SQL on S3. Submit a query; Athena allocates query compute capacity automatically. Scales to any query complexity. No cluster startup time overhead per query (though ~1–3s query planning time exists). Pay per TB scanned.
• AWS Glue ETL: serverless Spark. Define the job, specify DPU count (processing units); Glue starts a Spark cluster, runs the job, and terminates the cluster. Startup overhead ~2–3 minutes. Pay per DPU-hour.
• AWS Lambda: serverless functions. Sub-second cold start for small Python functions. Maximum 15 minutes, 10GB memory. Pay per millisecond of execution.
• When serverless is appropriate: intermittent batch workloads with unpredictable or variable timing (Athena, Glue ETL); lightweight event-driven processing (Lambda). Serverless is not appropriate for continuously running streaming workloads or very long-running transformations where provisioned cluster economics are better.`,
    aliases: [
      'What is serverless data processing on AWS?',
      'Serverless vs provisioned cluster for data processing',
      'When to use serverless vs managed clusters for data engineering?',
      'Athena, Glue, and Lambda as serverless data tools',
    ],
  },
  {
    question: 'How do you manage infrastructure as code for AWS data platforms?',
    answer: `All infrastructure in my AWS data platforms is defined as code — no manual console-based resource creation. This ensures reproducibility, auditability, and safe environment promotion.
• Terraform: my primary IaC tool for AWS. S3 buckets (with versioning, lifecycle rules, encryption), Glue Catalog databases and tables, Lambda functions, IAM roles and policies, CloudWatch alarms, and API Gateway resources are all defined in Terraform modules organized by layer (storage, catalog, compute, observability).
• Environment management: dev, staging, and prod environments use the same Terraform code with environment-specific variable files (terraform.tfvars). This eliminates configuration drift between environments and makes promoting infrastructure changes identical to code promotion.
• CI/CD integration: Terraform plan runs automatically in GitHub Actions on PR creation — the plan output shows exactly what infrastructure will change before it's applied. Terraform apply runs on merge to main, with manual approval gates for production.
• In the Phishing Simulation project: Terraform was essential because the platform needed to deploy to multiple client AWS accounts with identical configurations — Terraform modules parametrized by account and region handled this cleanly.`,
    aliases: [
      'How do you manage infrastructure as code on AWS?',
      'Terraform for AWS data platform infrastructure',
      'IaC strategy for data engineering projects',
      'Infrastructure automation for AWS data pipelines',
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
//  TOPIC 6: Azure Data Stack (5 Q&A)
// ─────────────────────────────────────────────────────────────────────────────
const TOPIC_6: QAEntry[] = [
  {
    question: 'What Azure data services have you worked with and in which projects?',
    answer: `My Azure experience spans two projects — Humana (healthcare analytics) and Resimac (financial data platform) — covering the full Azure data stack.
• Azure Data Lake Storage Gen2 (ADLS): hierarchical namespace object storage used as the Lakehouse storage layer at both Humana and Resimac. ADLS supports POSIX-style directory semantics and atomic renames — important for Spark's partition commit semantics.
• Azure Databricks: managed Databricks on Azure, used at Humana for large-scale PySpark ingestion and transformation pipelines. Integrates natively with ADLS via managed identity — no credentials in code.
• Azure Synapse Analytics: enterprise analytics service used at Humana for BI consumption. Synapse Serverless SQL queries Delta tables in ADLS directly, enabling Lakehouse query patterns for Power BI dashboards without loading data into a separate warehouse.
• Azure Machine Learning: used at Resimac to support MLOps workflows — delivering clean, versioned feature datasets from the Snowflake Consumption Layer to the ML team's training pipelines.
• Azure DevOps: CI/CD pipelines for both projects — Databricks notebook deployment via DBFS, Terraform infrastructure apply, and Python package deployment to Lambda-equivalent Azure Functions.`,
    aliases: [
      'What Azure data services have you used?',
      'Azure data engineering experience and projects',
      'Tell me about your Azure data stack',
      'Azure vs AWS experience for data platforms',
    ],
  },
  {
    question: 'How does Azure Synapse Analytics work and when would you use it?',
    answer: `Azure Synapse is Microsoft's unified analytics service that combines a dedicated MPP data warehouse (Synapse Dedicated SQL Pool), serverless SQL queries over data lakes (Synapse Serverless SQL), and managed Spark clusters (Synapse Spark Pools) — all within a single workspace.
• Synapse Serverless SQL: queries Parquet, Delta, or CSV files directly in ADLS using T-SQL — analogous to Amazon Athena on AWS. No cluster provisioning, pay per TB scanned. I used this at Humana to expose processed Databricks Delta tables to Power BI dashboards without creating a separate data warehouse layer.
• Synapse Dedicated SQL Pool: a provisioned MPP data warehouse analogous to Amazon Redshift — optimized for high-concurrency analytical queries against structured, pre-loaded data. Appropriate when query performance consistency is required for large numbers of concurrent users.
• When I use Synapse vs Databricks for transformation: Synapse Spark Pools for transformations directly integrated with the Synapse workspace and Azure data services; Databricks when the team is already using the Databricks platform and benefits from Delta Lake and MLflow integration.
• At Humana: Synapse Serverless SQL served as the BI query layer — Power BI connected directly to Synapse, which queried Delta tables in ADLS — a clean Lakehouse query architecture without a separate warehouse copy of the data.`,
    aliases: [
      'How does Azure Synapse Analytics work?',
      'Synapse Analytics use cases and architecture',
      'Azure Synapse vs Databricks vs Snowflake comparison',
      'When would you use Azure Synapse Analytics?',
    ],
  },
  {
    question: 'How does Azure Data Lake Storage Gen2 differ from Amazon S3?',
    answer: `Both ADLS Gen2 and S3 are object storage services designed for large-scale data — they share the core property of cheap, durable, scalable storage accessed via HTTP. The key differences are in namespace semantics, access control, and Azure ecosystem integration.
• Hierarchical Namespace (HNS): ADLS Gen2 adds true directory semantics to Azure Blob Storage — directory rename and delete are atomic operations (metadata-only, O(1) time). This is critical for Spark's partition commit pattern, which relies on atomic directory renames. S3 is a flat namespace; "directory" operations are emulated by prefix operations and are not atomic (a large directory rename on S3 is actually N individual object copies + deletes).
• Access control: ADLS Gen2 supports POSIX-compatible ACLs at file and directory level — fine-grained row/column level access without Lake Formation. S3 uses IAM policies and bucket-level ACLs.
• Azure ecosystem integration: ADLS Gen2 integrates natively with Azure Active Directory for identity-based access, Azure Databricks via managed identity, and Synapse Analytics via Synapse Link.
• Performance: for Spark workloads with heavy directory listing (Databricks AutoLoader, partition discovery), ADLS Gen2's HNS performs significantly better than S3 flat namespace listing.`,
    aliases: [
      'ADLS Gen2 vs Amazon S3 comparison',
      'How does Azure Data Lake Storage work?',
      'Differences between Azure and AWS object storage',
      'Why use ADLS instead of S3 on Azure?',
    ],
  },
  {
    question: 'How do you implement CI/CD for data pipeline code using Azure DevOps?',
    answer: `In both Azure projects, all pipeline code, infrastructure, and configuration are Git-managed — Azure DevOps Pipelines (YAML-based) handle the full CI/CD lifecycle.
• Code structure: Databricks notebooks and PySpark scripts, SQL transformation logic, Terraform infrastructure definitions, and environment configuration files all live in the same Git repository, promoting "data platform as code" discipline.
• CI on PR: run pytest unit tests against PySpark transformation functions (using mock DataFrames to avoid needing a live cluster), validate Terraform plans (terraform plan --detailed-exitcode), run flake8/black linting, and validate SQL syntax.
• CD on merge to main: Databricks notebooks sync to DBFS or Databricks Repos via the Databricks CLI; Terraform apply updates infrastructure (Synapse, ADLS policies, Azure ML pipelines); Lambda-equivalent functions deploy via ZIP; CloudWatch/Azure Monitor dashboard configs apply.
• Environment promotion: code promotes dev → staging → prod via pull request gates. Staging runs a smoke test on a representative data sample (e.g., one week of production data). Production promotion requires a manual approval gate in the Azure DevOps pipeline.`,
    aliases: [
      'How do you implement CI/CD for data pipelines on Azure?',
      'Azure DevOps for data engineering CI/CD',
      'Automated deployment strategy for data pipeline code',
      'CI/CD pipeline design for Databricks and Azure data platforms',
    ],
  },
  {
    question: 'What is Azure Machine Learning and how did you integrate it in the Resimac project?',
    answer: `Azure Machine Learning (Azure ML) is Microsoft's end-to-end cloud ML platform — covering data management, managed compute for model training, experiment tracking (MLflow integration), model registry, and deployment infrastructure.
• At Resimac: my role was specifically on the data engineering side — delivering clean, versioned, and schema-stable feature datasets from the Snowflake Consumption Layer to the Azure ML team. I did not build models; I built the data infrastructure that feeds them.
• Integration pattern: Snowflake Consumption Layer tables (loan features, customer financial history, risk indicators) are exported to ADLS as Parquet files on a defined schedule. Azure ML Data Assets point to these ADLS paths — the ML team registers them as versioned datasets in Azure ML.
• Data quality for ML: ML models are particularly sensitive to upstream data changes. I implemented schema pinning (Azure ML dataset versions are immutable), data drift alerting (row count and feature distribution checks before each dataset refresh), and feature documentation to communicate expected value ranges and semantics to the ML team.
• MLOps loop: model inference results and feature importance scores are written back to ADLS, then loaded into Snowflake for downstream reporting — closing the data loop between the ML platform and the data warehouse.`,
    aliases: [
      'What is Azure Machine Learning?',
      'How did you integrate Azure ML at Resimac?',
      'MLOps data engineering with Azure ML',
      'Data engineering for machine learning feature pipelines',
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
//  TOPIC 7: Snowflake & Data Vault (7 Q&A)
// ─────────────────────────────────────────────────────────────────────────────
const TOPIC_7: QAEntry[] = [
  {
    question: 'What is Snowflake and what are its strengths for enterprise data platforms?',
    answer: `Snowflake is a cloud-native data platform (delivered as SaaS) built on a unique multi-cluster shared data architecture. Its defining characteristic is the complete separation of storage and compute.
• Storage: data lives in cloud object storage (S3, ADLS, or GCS) in Snowflake's proprietary columnar-compressed format — managed entirely by Snowflake.
• Compute: virtual warehouses are independent compute clusters that can be started, suspended, and resized in seconds. Multiple warehouses can query the same data simultaneously without resource contention — ideal for mixed workloads (BI, ETL, ad-hoc analytics).
• Key strengths: zero-copy cloning (instant copies of tables/schemas for dev/test environments as metadata-only operations — no data duplication); automatic clustering and query optimization via micro-partition statistics; native semi-structured data support (VARIANT/JSON without schema definition).
• At Resimac: Snowflake served as the enterprise data warehouse layer built on a Data Vault architecture, integrating data from Azure Data Lake Storage (via External Stages or Delta Lake) across three logical layers — Raw Vault, Business Vault, and Consumption Layer.`,
    aliases: [
      'What is Snowflake and why use it?',
      'Snowflake strengths for enterprise data warehousing',
      'Why choose Snowflake over other data warehouses?',
      'Snowflake architecture and key features',
    ],
  },
  {
    question: 'What is Data Vault modeling and how did you implement it at Resimac?',
    answer: `Data Vault is a data modeling methodology designed for enterprise data warehouses that need agility, historical auditability, and the ability to integrate data from many source systems without restructuring when requirements change.
• Data Vault is built on three entity types: Hubs store business keys (the unique identifiers meaningful to the business, e.g., customer_id, loan_id) with a hash surrogate key and load metadata. Links store relationships between Hubs (e.g., which customer has which loan) — enabling many-to-many relationships. Satellites store descriptive attributes (customer name, address, loan amount) with full historical tracking — every change creates a new row; records are never updated.
• At Resimac: Raw Vault loads data directly from the Bronze/Silver layer, source-aligned, with no business rules — a faithful record of what came from the source and when. Business Vault applies cross-source business rules: standardizing customer identity across the origination, servicing, and CRM systems into a single canonical customer entity.
• Consumption Layer: purpose-built Snowflake views and materialized tables for specific use cases — loan performance dashboards, eligibility scoring inputs, and regulatory reporting. These use dimensional modeling (star schema) optimized for BI query patterns.
• The key benefit at Resimac: Raw Vault is immutable — when business rules change (which happens frequently in financial services), you only modify Business Vault logic and re-derive the Consumption Layer. The audit trail in Raw Vault is never touched.`,
    aliases: [
      'What is Data Vault methodology?',
      'Data Vault modeling explained',
      'How did you implement Data Vault at Resimac?',
      'Hubs, Links, and Satellites in Data Vault explained',
    ],
  },
  {
    question: 'Can you explain the Raw Vault, Business Vault, and Consumption Layer architecture you built at Resimac?',
    answer: `These three layers form the core structure of the Snowflake Data Vault implementation at Resimac, each with a distinct purpose and data contract.
• Raw Vault: the foundation layer — a technically accurate, source-aligned copy of all incoming data. Each source system's business keys become Hubs; each source-to-source relationship becomes a Link; all descriptive attributes become Satellites with load_date, load_end_date (for current record identification), and record_source. No business transformations — if the source sends bad data, Raw Vault records it faithfully.
• Business Vault: sits above Raw Vault and applies business rules, cross-source integrations, and derived computations. At Resimac, a key challenge was customer identity resolution — the same customer existed in origination, servicing, and CRM systems with slightly different IDs and name spellings. Business Vault's same-as links and bridge tables unified these into a single canonical customer entity.
• Consumption Layer: Snowflake views and materialized tables built for specific downstream use cases. Loan performance dashboards use a star schema (fact_loan_performance + dim_customer + dim_product). Eligibility scoring uses a wide, denormalized feature table optimized for batch ML scoring. Regulatory compliance reports use point-in-time (PIT) tables that reconstruct the data state at any historical date.`,
    aliases: [
      'Explain the Data Vault layers at Resimac',
      'Raw Vault Business Vault Consumption Layer explained',
      'How is Snowflake Data Vault structured at Resimac?',
      'Data Vault layer architecture and purpose',
    ],
  },
  {
    question: 'What is Snowflake Cortex AI and how did you integrate it at Resimac?',
    answer: `Snowflake Cortex AI is Snowflake's native AI and ML service that provides LLM inference, text analytics, semantic search, and AI-powered querying directly within Snowflake — without moving data outside the Snowflake security boundary.
• How it works: Cortex functions are standard SQL functions — SNOWFLAKE.CORTEX.COMPLETE('model_name', prompt) calls an LLM; SNOWFLAKE.CORTEX.SEARCH enables semantic vector search over Snowflake tables. Compute runs on Snowflake's managed infrastructure. Data never leaves Snowflake, which is critical for Resimac's financial data compliance requirements.
• Cortex Analyst: Snowflake's natural language-to-SQL capability. Given a semantic model (table descriptions, column definitions, metric definitions), Cortex Analyst converts business questions into Snowflake SQL queries — enabling non-technical stakeholders to query loan performance data without SQL knowledge.
• At Resimac: I integrated Cortex AI for two use cases — Cortex Analyst for business user self-service querying over the Consumption Layer, and Cortex COMPLETE for generating structured analytical summaries from loan portfolio data for management reporting workflows.
• Data engineering role: my responsibility was preparing the Consumption Layer tables with the metadata and semantic model definitions that Cortex Analyst requires — column descriptions, metric definitions, relationship documentation — not the LLM configuration itself.`,
    aliases: [
      'What is Snowflake Cortex AI?',
      'How does Cortex AI work in Snowflake?',
      'Snowflake Cortex AI integration at Resimac',
      'AI-powered analytics in Snowflake',
    ],
  },
  {
    question: 'How do you optimize query performance in Snowflake?',
    answer: `Snowflake query performance optimization operates at four levels: table design (clustering), query design, warehouse sizing, and result/metadata caching.
• Clustering keys: Snowflake automatically organizes data into micro-partitions (~100MB each) during writes. For large tables with heavy filter conditions on specific columns (e.g., WHERE load_date BETWEEN ... or WHERE customer_id = ...), define a clustering key on those columns. Snowflake reorganizes micro-partitions to colocate similar values, enabling micro-partition pruning at query time.
• Materialized views: pre-compute expensive aggregations or complex JOIN results as materialized views. Snowflake automatically maintains them as base tables change. Useful for Consumption Layer aggregations queried frequently by BI tools.
• Result cache: Snowflake caches query results for 24 hours — an identical query against unchanged data returns from cache in milliseconds with zero compute cost. I structure BI tool queries (Power BI, Tableau) to maximize cache hits by standardizing query patterns.
• Virtual warehouse sizing: right-size warehouses for the workload. Small (2-node) warehouses for light BI queries; Medium (4-node) for moderate reporting; Large (8-node) or XL for complex ETL loading. Enable auto-suspend at 60 seconds to eliminate idle cost.
• Query Profile: use Snowflake's Query Profile UI to identify performance bottlenecks — full table scans (missing clustering), large data spills to disk (warehouse undersized), or cartesian JOINs (missing JOIN condition).`,
    aliases: [
      'How do you optimize Snowflake query performance?',
      'Snowflake performance tuning strategies',
      'How do you make Snowflake queries run faster?',
      'Snowflake clustering keys and micro-partition pruning',
    ],
  },
  {
    question: 'What is Delta Lake and how did you use it in the Resimac project?',
    answer: `Delta Lake is an open-source storage layer developed by Databricks that adds ACID transaction semantics to Apache Parquet files stored on cloud object storage (S3, ADLS, GCS).
• Core capabilities: every write operation (INSERT, UPDATE, DELETE, MERGE) is recorded in a JSON transaction log (the delta_log folder). This log enables: ACID guarantees (reads never see partial writes), time travel (query any historical snapshot), schema enforcement (reject writes that violate the defined schema), and schema evolution (safely add columns).
• At Resimac: Delta Lake was the table format used in the ADLS intermediate layer. Raw data from source systems (origination platform, servicing system, CRM) landed as Delta tables in ADLS Gen2. Spark jobs performed Bronze → Silver transformations using Delta MERGE operations for CDC-based upserts. The final Silver Delta tables were then loaded into Snowflake via COPY INTO from External Stages.
• Why Delta Lake at Resimac: financial data processing requires ACID guarantees — partial writes or dirty reads in loan data could cause incorrect eligibility decisions. Delta Lake's transaction log prevented these scenarios at the storage layer, before data entered Snowflake.
• Time travel usage: when a source system reissued historical loan data with corrections, Delta Lake time travel allowed us to verify exactly what data was in the table before and after the correction — critical for audit trails in financial services.`,
    aliases: [
      'What is Delta Lake?',
      'How did you use Delta Lake at Resimac?',
      'Delta Lake ACID transactions for financial data',
      'Delta Lake vs Parquet for data lake storage',
    ],
  },
  {
    question: 'How do you load data from Azure Data Lake Storage into Snowflake?',
    answer: `Data flows from ADLS into Snowflake via Snowflake's External Stage mechanism, using either COPY INTO for batch loading or Snowpipe for automated continuous loading.
• External Stage: define a Snowflake External Stage pointing to the ADLS Gen2 container path, authenticated via a service principal with Storage Blob Data Reader access. The stage acts as a reference to the ADLS location that Snowflake's COPY engine can read from.
• COPY INTO (batch): COPY INTO snowflake_table FROM @azure_stage/path/ FILE_FORMAT = (TYPE = PARQUET) — reads all Parquet files from the stage path into the Snowflake table. Efficient for scheduled daily batch loads. Snowflake tracks which files have been loaded (load history) to prevent duplicate ingestion.
• Snowpipe (continuous): Snowpipe listens for Azure Event Grid notifications when new files land in ADLS. On file arrival, Snowpipe automatically triggers a COPY INTO, loading new data within minutes. Used at Resimac for near-real-time ingestion of servicing system updates.
• External Tables (alternative): instead of loading data into Snowflake, define an External Table that queries ADLS Parquet files directly. No storage cost in Snowflake, but slower query performance than native tables. I use External Tables for large historical archives where query frequency is low, and native loaded tables for frequently queried operational data.`,
    aliases: [
      'How do you load data from Azure into Snowflake?',
      'Snowflake COPY INTO vs Snowpipe vs External Table',
      'Ingesting data from ADLS to Snowflake',
      'Snowflake data loading patterns from Azure',
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
//  TOPIC 8: GenAI Text-to-SQL — Deckand Project (6 Q&A)
// ─────────────────────────────────────────────────────────────────────────────
const TOPIC_8: QAEntry[] = [
  {
    question: 'Can you describe the Deckand GenAI Text-to-SQL project and what problem it solves?',
    answer: `Deckand is a GenAI-powered data assistant platform that enables business users to query enterprise datasets by asking questions in natural language — eliminating the SQL knowledge barrier between business stakeholders and their data.
• Problem: the data lake contains millions of records across dozens of tables. Data analysts are a bottleneck — every ad-hoc business question requires an analyst to write SQL, run the query, and format the result. This creates 2–5 day turnaround for what should be instant answers.
• Solution: Deckand converts a natural language question ("What are the top 10 customers by revenue in the Northeast region last quarter?") into Athena-compatible SQL, executes it, and returns the result in real time via a chat interface.
• Architecture: FastAPI backend (REST/WebSocket chat API), LLM for SQL generation (prompted with schema context), AWS Data Lakehouse (S3 + Glue Catalog) as the data layer, and Amazon Athena for SQL execution. All data stays on the existing Lakehouse — no new storage layer.
• The hardest engineering problem was SQL accuracy: LLMs generate SQL that looks syntactically correct but references wrong table/column names or makes incorrect JOIN assumptions. Our metadata-driven schema context management was the primary solution.`,
    aliases: [
      'Tell me about the Deckand project',
      'What is the Deckand Text-to-SQL data agent?',
      'GenAI Text-to-SQL system architecture',
      'How does the Deckand data agent work?',
    ],
  },
  {
    question: 'How does the Text-to-SQL pipeline work end-to-end in Deckand?',
    answer: `The pipeline has five stages: schema retrieval → prompt construction → LLM SQL generation → validation → execution and response.
• Stage 1 — Schema context retrieval: when a user submits a question, the system identifies the most relevant tables using keyword matching and semantic similarity against the metadata store. Only the schemas of relevant tables are included in the LLM prompt — not the full catalog (which would exceed context limits and confuse the model).
• Stage 2 — Prompt construction: the prompt is assembled with: system instruction (SQL dialect is Athena SQL / Presto; output only SQL), the relevant table schemas with column descriptions, inter-table relationships, sample categorical values for key columns, and the user's question.
• Stage 3 — LLM SQL generation: the assembled prompt is sent to the LLM API. The model returns SQL targeting Athena's Presto SQL dialect.
• Stage 4 — SQL validation: the generated SQL is parsed using a SQL parser library (e.g., SQLGlot) to verify syntactic correctness. References to table names and columns not in the schema context are flagged and rejected before execution.
• Stage 5 — Athena execution and response: validated SQL executes on Athena against the S3 data lake. Results are fetched from S3 output, formatted as a table or summary, and returned via the FastAPI response.`,
    aliases: [
      'How does the Text-to-SQL pipeline work?',
      'Walk me through the SQL generation pipeline in Deckand',
      'LLM SQL generation pipeline steps explained',
      'How does the system convert natural language to SQL?',
    ],
  },
  {
    question: 'How did you handle LLM hallucination in SQL generation at Deckand?',
    answer: `SQL hallucination — where the LLM generates SQL that looks valid but references non-existent tables, wrong column names, or makes incorrect semantic assumptions — was the primary reliability challenge.
• Schema grounding: the LLM never generates table or column names from memory. All valid table names, column names, data types, and relationships are explicitly injected into the prompt from the Glue Catalog metadata at query time. If a name doesn't appear in the schema context, the LLM physically cannot include it in the generated SQL.
• Business glossary and column descriptions: beyond raw schema, we enriched metadata with natural language descriptions for each table and column (e.g., column: net_revenue, description: "total billed amount in USD minus refunds, after discount application"). This reduces semantic ambiguity that causes incorrect JOIN choices or wrong column selection.
• Pre-execution SQL validation: the generated SQL is parsed before submission to Athena. A validation layer checks: all referenced table names exist in the schema context, all referenced column names exist in the specified table schemas, and basic JOIN clause completeness. Invalid SQL triggers a retry with an error-augmented prompt.
• Execution error feedback loop: if Athena returns a query execution error (syntax error, column not found), the error message is appended to the conversation and the LLM is prompted to correct the SQL — up to 2 retries before surfacing an error to the user.`,
    aliases: [
      'How do you prevent LLM hallucination in Text-to-SQL?',
      'SQL accuracy and grounding in Text-to-SQL systems',
      'How do you ground LLM SQL generation with schema context?',
      'LLM hallucination mitigation in Deckand',
    ],
  },
  {
    question: 'What is metadata-driven schema context management in Deckand?',
    answer: `Metadata-driven schema context means the LLM prompt is constructed dynamically from a curated metadata store at query time — not hardcoded — so schema changes propagate automatically to future LLM calls.
• Metadata store contents: for each table in the Glue Catalog, we maintain: table description (business purpose), column descriptions (business meaning, valid range, examples), inter-table relationship definitions (conceptual foreign keys — the data lake doesn't enforce FK constraints, but our metadata documents the expected JOIN relationships), and sample categorical values for high-selectivity columns (e.g., region: ["Northeast", "Southeast", "Midwest"]).
• Relevance-based retrieval: instead of including all table schemas in every prompt (which would exceed the LLM context window and introduce noise), a retrieval step selects the N most relevant tables for the user's question using keyword extraction and embedding similarity.
• Schema versioning: the metadata store is versioned — when the underlying Parquet schema changes (new column added by a pipeline update), a metadata update job synchronizes the store with the Glue Catalog. All subsequent LLM calls automatically receive the updated schema.
• Why this is important: without metadata management, adding a new column to a source table requires manual prompt updates. With metadata-driven context, schema changes propagate automatically — no engineering work required to keep the Text-to-SQL system aligned with evolving schemas.`,
    aliases: [
      'What is schema context management in Text-to-SQL?',
      'How do you provide schema context to the LLM for SQL generation?',
      'Metadata-driven prompting for Text-to-SQL systems',
      'Semantic layer design for LLM SQL generation',
    ],
  },
  {
    question: 'What technology stack did you use for Deckand and what were the key architecture decisions?',
    answer: `The stack was chosen to minimize operational complexity while maximizing SQL accuracy and scalability.
• Data layer: AWS S3 (Parquet storage) + AWS Glue Data Catalog (metadata) + Amazon Athena (SQL execution). The decision to use Athena was deliberate — query patterns in a chat interface are completely unpredictable (any question, any complexity). A provisioned cluster would be idle most of the time and underpowered during peaks. Athena's serverless model scales automatically and costs nothing when idle.
• Backend: FastAPI (Python) — asynchronous request handling (Athena query submission and polling are async), automatic OpenAPI documentation, and natural compatibility with the Python data ecosystem (boto3, pandas, sqlglot, sentence-transformers for retrieval).
• LLM integration: LLM API (foundation model provider) called via standard REST API with structured prompting. The architecture is model-agnostic — swapping the LLM provider requires only changing the API call, not the pipeline architecture.
• Metadata retrieval: lightweight embedding-based retrieval (sentence-transformers) for table relevance scoring — which tables are most relevant to the user's question — before schema context assembly.
• SQL validation: SQLGlot — a Python SQL parser and transpiler — used for pre-execution SQL parsing and Athena dialect validation.`,
    aliases: [
      'What tech stack did you use for Deckand?',
      'Deckand technology choices and architecture decisions',
      'Why FastAPI and Athena for the Text-to-SQL system?',
      'Technical architecture of the Deckand data agent',
    ],
  },
  {
    question: 'How do you handle query performance for real-time chat-based analytics in Deckand?',
    answer: `Chat users expect near-real-time responses — we target under 10 seconds for most queries, which requires a combination of Athena query optimization and application-level caching.
• Athena partition pruning: the Parquet data lake is partitioned by date and source. Well-structured LLM-generated SQL that includes WHERE clauses matching partition keys scans only the relevant partitions — a query against 1 year of data can scan only 1 day's partition (1/365 of the data) when the date filter is correctly applied. Partition pruning is the single biggest performance lever.
• Result caching: frequently asked questions often generate identical SQL (or close to it). Athena's 24-hour result cache returns cached results instantly for identical queries against unchanged data. We also implement an application-level cache (Redis or DynamoDB) for user-specific recent queries.
• Query complexity classification: before execution, we estimate query cost using EXPLAIN (Athena supports EXPLAIN in Athena v3) or rule-based classification. For queries estimated to scan >100GB, we surface a "this might take a moment" message to manage UX expectations.
• Query timeout and circuit breaker: maximum Athena query timeout set at 30 seconds. If the generated SQL produces an excessively long-running query, the system cancels it and prompts the user to refine their question (e.g., "Could you narrow the date range? This query is scanning a large amount of data.").`,
    aliases: [
      'How do you handle latency for chat-based analytical queries?',
      'Query performance optimization for Text-to-SQL systems',
      'Real-time query processing in Deckand',
      'Athena performance for interactive natural language queries',
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
//  TOPIC 9: Data Modeling, Quality & Governance (6 Q&A)
// ─────────────────────────────────────────────────────────────────────────────
const TOPIC_9: QAEntry[] = [
  {
    question: 'What data modeling approaches do you use in your Lakehouse architectures?',
    answer: `I use a layered approach, combining Medallion architecture for the Lakehouse layers with Data Vault for enterprise warehouse modeling and dimensional modeling for BI-consumption layers.
• Medallion (Bronze/Silver/Gold): Bronze is raw, schema-on-read ingestion — data lands as-is from the source. Silver is cleaned, standardized, and schema-on-write — deduplication, null handling, type casting, and field normalization applied. Gold/Consumption is aggregated, business-ready, optimized for downstream queries.
• Data Vault (enterprise warehousing): used at Resimac for the Snowflake layer — Hubs (business keys), Links (relationships), and Satellites (descriptive attributes with full history). Designed for auditability, historical tracking, and integration of many source systems without restructuring.
• Dimensional modeling (Kimball star schema): used in the Consumption Layer for BI-facing tables — fact tables surrounded by dimension tables. Optimized for analytical query performance and BI tool compatibility (Power BI, Tableau).
• In practice: I combine Data Vault (flexibility, auditability) in the business layer and dimensional modeling (performance, simplicity) in the consumption layer — each layer uses the modeling approach that best serves its purpose.`,
    aliases: [
      'What data modeling approaches do you use?',
      'Medallion architecture vs Data Vault vs dimensional modeling',
      'How do you model data in your Lakehouse?',
      'Bronze Silver Gold layers explained',
    ],
  },
  {
    question: 'How do you implement data quality checks in your pipelines?',
    answer: `Data quality checks are pipeline stage gates — they run after each transformation layer and halt the pipeline with an alert if quality thresholds are violated, preventing bad data from propagating downstream.
• Schema validation (Bronze → Silver): enforce schema-on-write using Iceberg or Delta Lake schema enforcement. Any row or batch that violates the defined schema is rejected. Schema mismatches alert the data team immediately.
• Completeness checks: after each ingestion batch, compare rows_loaded vs expected_row_count derived from source system metadata or historical baseline. A deviation exceeding 5% (configurable per table) triggers a warning; 20% deviation halts the pipeline.
• Null checks on mandatory columns: primary keys, business keys, and partition keys are checked for nulls after every transformation. A null business key indicates an ingestion extraction failure.
• Referential integrity: verify that foreign key values in Silver fact records exist in the corresponding dimension tables — catches missing dimension records before they cause incorrect JOIN results in the Consumption Layer.
• Freshness checks: monitor max(ingestion_timestamp) per table after each pipeline run. If data freshness exceeds the defined SLA (e.g., daily batch must land by 6am), an alert fires before downstream BI dashboards query stale data.`,
    aliases: [
      'How do you implement data quality in your pipelines?',
      'Data quality strategy and data quality gates',
      'What data validation checks do you run in ETL pipelines?',
      'How do you prevent bad data from entering the data lake?',
    ],
  },
  {
    question: 'How do you handle data deduplication in your pipelines?',
    answer: `Deduplication is critical for both correctness (avoiding double-counting in analytics) and cost (avoiding processing the same data multiple times).
• Window function deduplication: for source systems that deliver duplicate rows (same primary key, same or slightly different content), I use ROW_NUMBER() OVER (PARTITION BY primary_key ORDER BY updated_at DESC) to select the most recent version per key, filtering to row_number = 1.
• MERGE/UPSERT pattern: for incremental loads, I use MERGE INTO (Delta Lake or Iceberg) matching on the primary key — UPDATE if the key exists with newer data, INSERT if the key is new. This enforces primary key uniqueness at the storage layer.
• Hash-based deduplication: compute a content hash (MD5 or SHA256 of all non-metadata columns) and use it as an idempotency key — records with identical hashes are deduplicated regardless of timestamp. Useful for idempotent re-runs of pipeline batches where the same source data is re-delivered.
• At Resimac: financial data arrived from three source systems for the same customers with overlapping extracts. We applied strict business-key-based deduplication in the Business Vault layer — the Data Vault same-as link explicitly tracked which source records mapped to the same canonical customer identity.`,
    aliases: [
      'How do you handle duplicate data in your pipelines?',
      'Data deduplication strategy in data engineering',
      'How do you deduplicate records in a Lakehouse?',
      'Deduplication techniques in ETL pipelines',
    ],
  },
  {
    question: 'What is your approach to data lineage and governance?',
    answer: `Lineage and governance are not optional — in enterprise environments with compliance requirements (financial services, healthcare), they are mandatory and should be designed from the start, not retrofitted.
• Lineage at the orchestration layer: Dagster's software-defined asset model automatically tracks lineage — every asset knows its upstream dependencies. The Dagster asset graph shows the full dependency chain from raw S3 ingestion through Bronze, Silver, and Gold tables to the final Consumption Layer.
• Lineage at the Databricks layer: Databricks Unity Catalog provides automatic column-level data lineage for all Delta Lake tables on the platform — shows which upstream columns contributed to each downstream column after transformations.
• Access governance: principle of least privilege enforced at every layer — S3 bucket policies and IAM roles (AWS), ADLS ACLs and service principal RBAC (Azure), Snowflake RBAC with role hierarchies (DE_ROLE, BI_ROLE, ANALYST_ROLE), and Databricks Unity Catalog for table-level permissions.
• Secrets management: credentials never hardcoded in pipeline code. AWS Secrets Manager, Azure Key Vault, and HashiCorp Vault (on-premise CDP) store all connection strings, API keys, and service principals — accessed at pipeline runtime via SDK calls.`,
    aliases: [
      'How do you implement data lineage?',
      'Data governance approach in your data platforms',
      'How do you track data lineage in your pipelines?',
      'Lineage and governance in enterprise data engineering',
    ],
  },
  {
    question: 'How do you approach data cleansing and standardization in the Silver layer?',
    answer: `The Silver layer is the primary standardization point in the Medallion architecture — it transforms raw, inconsistent Bronze data into a canonical, reliable representation that all downstream layers can trust.
• Data type normalization: enforce consistent types across all sources. Dates are normalized to ISO 8601 (YYYY-MM-DD) or UTC timestamps. Numeric fields cast to consistent precision (DECIMAL(18,4) for financial amounts). Boolean flags standardized (Y/N strings converted to true/false).
• String standardization: trim leading/trailing whitespace, normalize case (UPPER for codes, PROPER for names), handle encoding issues (UTF-8 normalization). Remove control characters that cause downstream parsing failures.
• Null handling strategy: distinguish between semantic nulls (field genuinely not applicable), missing data (should have a value but wasn't provided), and sentinel values (source uses -1, "N/A", or "UNKNOWN" to mean null). Each is treated differently — semantic nulls remain null; sentinel values are mapped to null with a separate flag column.
• At Resimac: customer financial data arrived with inconsistent address formats, date representations across source systems, and loan amounts sometimes in different currencies. Silver standardization included address parsing, date format unification, and currency conversion to AUD as the base currency — all applied deterministically from documented transformation rules.`,
    aliases: [
      'How do you cleanse data in the Silver layer?',
      'Data cleansing and standardization strategy',
      'How do you handle inconsistent data from multiple sources?',
      'Silver layer transformation and data normalization',
    ],
  },
  {
    question: 'How do you version and document your data models and pipeline code?',
    answer: `Schema-as-code and documentation-as-code are practices I follow — data models and their documentation live in Git alongside the pipeline code that implements them.
• Schema-as-code: table schemas are defined in Python (Iceberg schema definitions, Spark StructType definitions), Terraform (Glue Catalog table resource definitions), or dbt model files — all version-controlled in Git. Schema changes are implemented as versioned migration scripts applied in sequence.
• Data dictionary: I maintain column-level documentation in Confluence or directly in the catalog. For Snowflake, I use COMMENT ON COLUMN statements to embed descriptions in the catalog itself — visible in Snowflake's Information Schema and picked up automatically by Cortex AI's semantic model.
• dbt (data build tool): in some projects, dbt manages the transformation layer — model SQL files, tests (not_null, unique, accepted_values), and documentation (schema.yml) live together. dbt generates an interactive data lineage graph and documentation site from these definitions automatically.
• Change management: schema changes that break downstream consumers (column renames, type changes) follow a deprecation process — old column kept alongside new column for one sprint, downstream consumers migrated, old column removed in a subsequent deploy.`,
    aliases: [
      'How do you version and document data models?',
      'Schema as code approach for data pipelines',
      'Data model documentation strategy',
      'How do you maintain data dictionaries for large data platforms?',
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
//  TOPIC 10: Observability, CI/CD & Production Operations (6 Q&A)
// ─────────────────────────────────────────────────────────────────────────────
const TOPIC_10: QAEntry[] = [
  {
    question: 'How do you implement observability for production data pipelines?',
    answer: `I treat observability as a first-class engineering concern — metrics, logs, and alerts are designed into the pipeline architecture alongside the business logic.
• Metrics I always instrument: rows_ingested_count (vs expected from source), bytes_written, pipeline_duration_seconds (vs P95 baseline), error_count, and data_freshness_seconds (time elapsed since last successful run for each table).
• Structured logging: all pipeline code emits structured JSON logs with consistent fields: job_name, source_table, partition_date, status, rows_processed, duration_ms, and error_message if applicable. Structured logs enable CloudWatch Logs Insights or Azure Monitor Log Analytics queries for operational analytics — not just grep.
• Alerting strategy: three tiers — pipeline failure (error_count > 0) triggers immediate PagerDuty/email; data freshness > 1.5x SLA triggers a warning alert; row count deviation > 10% from historical baseline triggers anomaly investigation.
• Dashboards: I build a data platform health dashboard showing current status for every production table: last successful run timestamp, rows processed in the last 24 hours, and current freshness lag vs SLA — giving operations a single-pane view without querying logs.`,
    aliases: [
      'How do you monitor production data pipelines?',
      'Observability strategy for data engineering pipelines',
      'How do you detect when a data pipeline fails?',
      'Metrics and alerting for data platform observability',
    ],
  },
  {
    question: 'How do you manage data freshness SLAs for downstream consumers?',
    answer: `Freshness SLAs define the maximum acceptable lag between source data change and the data being available to downstream consumers — they must be defined, monitored, and communicated explicitly.
• SLA definition: each Consumption Layer table has a documented freshness SLA agreed with downstream consumers: daily batch tables (e.g., overnight ETL completes by 6am); near-real-time tables (e.g., data no older than 15 minutes during business hours).
• Freshness monitoring: a monitoring job runs after every pipeline execution, recording max(ingestion_timestamp) for each target table. A central freshness tracking table stores current lag for every downstream-facing table — queryable by operations and queryable by BI tools to display "data as of" timestamps on dashboards.
• Alerting on SLA breach: if freshness_lag > SLA_threshold, an alert fires before consumers query stale data — giving the data team time to investigate and either restore the pipeline or notify consumers of the delay.
• Consumer communication: freshness SLAs are documented in a data catalog accessible to all downstream teams. BI dashboards display the "data as of" timestamp prominently — users know the currency of what they're seeing without asking the data team.`,
    aliases: [
      'How do you manage data freshness SLAs?',
      'Data freshness monitoring and SLA management',
      'How do you ensure data is current for consumers?',
      'Freshness tracking for production data pipelines',
    ],
  },
  {
    question: 'How do you implement CI/CD for data pipeline code?',
    answer: `All pipeline code — PySpark transformations, SQL queries, orchestration definitions, and infrastructure configuration — lives in Git and deploys through automated CI/CD pipelines.
• Code structure: pipeline code, infrastructure (Terraform), and environment configuration are co-located in the same repository. This means a single pull request can update both the Spark transformation logic and the corresponding Glue Job resource definition.
• CI on pull request: run pytest unit tests against transformation functions (using mock DataFrames to test logic without a live cluster), validate Terraform plans, run code linting (flake8, black), and validate SQL syntax for any SQL files.
• CD on merge to main: deploy updated pipeline code to the target environment — Databricks notebooks sync via DBFS or Databricks Repos; Glue scripts upload to S3; Lambda functions deploy as ZIP packages; Terraform apply updates all infrastructure changes.
• Environment promotion: dev → staging → prod. Staging uses a representative subset of production data (e.g., one month's worth). The staging run must complete successfully and pass all data quality checks before production promotion is approved. Production promotion requires a manual approval gate.`,
    aliases: [
      'How do you implement CI/CD for data pipeline code?',
      'Automated deployment strategy for data pipelines',
      'GitHub Actions or Azure DevOps for data engineering deployment',
      'Testing strategy for data pipeline code',
    ],
  },
  {
    question: 'How do you handle production data pipeline incidents?',
    answer: `Incident response for data pipelines follows a detect → triage → remediate → prevent cycle, with a focus on minimizing data freshness impact for downstream consumers.
• Detection: automated alerts via CloudWatch alarms or Dagster failure sensors detect failures within 1–5 minutes of occurrence. All failures are surfaced to a dedicated data platform monitoring channel.
• Triage: examine the structured pipeline logs — look for the first ERROR or EXCEPTION entry, note the job stage (ingestion, transformation, quality check), and identify the error category (source connectivity, schema mismatch, compute resource, downstream dependency failure).
• Common failure patterns and remedies: schema drift (source added a new column — update Silver transformation to handle the new column gracefully); S3/ADLS permission denied (IAM role change — restore permissions); data volume spike (2x normal volume — scale up Glue DPUs or Databricks cluster size); API rate limit (retry with backoff after cooldown period).
• Recovery: most pipelines are idempotent — re-trigger the failed run for the affected partition. The pipeline overwrites the target partition with a correct result. For MERGE-based pipelines, the MERGE is naturally idempotent on the primary key.
• Post-incident: for recurring failure patterns, implement a preventive fix — schema drift detection before processing, volume anomaly early warning alerts, or circuit breakers on external API calls.`,
    aliases: [
      'How do you handle data pipeline failures in production?',
      'Incident response process for data pipelines',
      'How do you debug and recover failing data jobs?',
      'Production data pipeline troubleshooting approach',
    ],
  },
  {
    question: 'How do you ensure data security and access control in your data platforms?',
    answer: `Security is layered across storage, catalog, compute, and code — no single control point is relied upon exclusively.
• Storage layer: S3 bucket policies with default deny + explicit allow for specific IAM roles (no public access); ADLS Gen2 with Azure AD-based service principal authentication and POSIX ACLs at the directory level. Server-side encryption enabled on all buckets (SSE-S3 or SSE-KMS on AWS; Azure Storage Service Encryption on ADLS).
• Catalog and compute layer: Snowflake RBAC with role-per-team granularity (DE_ROLE for data engineers, BI_ROLE for BI consumers, ANALYST_ROLE for ad-hoc queries) with column-level masking policies for PII fields. Databricks Unity Catalog for table-level and column-level access control on Databricks workspaces.
• Secrets management: credentials are never in source code or pipeline configuration files. AWS Secrets Manager, Azure Key Vault, or HashiCorp Vault (on-premise CDP) store all connection strings and API keys — accessed at runtime via SDK calls. Vault access is audited.
• Data in transit: TLS for all API calls, Snowflake JDBC connections, and Databricks cluster communication. Data never transferred over unencrypted channels.`,
    aliases: [
      'How do you secure data in your data platforms?',
      'Data security and access control strategy',
      'How do you manage secrets and credentials in data pipelines?',
      'RBAC and data governance for enterprise data platforms',
    ],
  },
  {
    question: 'How do you optimize and manage cloud infrastructure costs for large-scale data platforms?',
    answer: `Cost optimization is an ongoing engineering discipline — not a one-time exercise. I target cost efficiency at storage, compute, and query layers simultaneously.
• Storage optimization: Parquet with Snappy or Zstd compression typically reduces storage by 5–10x vs raw CSV or JSON. S3 Intelligent-Tiering automatically moves infrequently accessed data (older partitions, historical archives) to cheaper storage classes — transparent to query engines.
• Compute optimization: Athena costs $5/TB scanned — partition pruning + Parquet columnar projection routinely achieves 90%+ reduction in data scanned vs unstructured storage. Snowflake virtual warehouses auto-suspend after 60 seconds of inactivity, eliminating idle cost. Databricks clusters auto-terminate after configurable idle timeout.
• Right-sizing: match virtual warehouse or cluster size to the workload. Oversized clusters waste money; undersized clusters cause spill-to-disk and slow performance. I baseline P95 job completion times at each tier and right-size accordingly.
• Spot/preemptible instances: for fault-tolerant Spark batch jobs (idempotent, restartable), I use AWS Spot Instances or Azure Spot VMs — up to 70% cost reduction vs on-demand. The pipeline must be designed to handle node interruption gracefully (checkpoint-based recovery).
• Cost allocation tagging: all AWS/Azure resources tagged by project, environment, and team — CloudWatch Cost Explorer and Azure Cost Management provide per-project cost visibility, enabling actionable cost review conversations with stakeholders.`,
    aliases: [
      'How do you optimize cloud costs for data platforms?',
      'Cost management strategy for AWS and Azure data engineering',
      'How do you reduce Athena query costs?',
      'Cloud cost optimization for data engineering infrastructure',
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
//  COMBINED DATASET
// ─────────────────────────────────────────────────────────────────────────────
const ALL_QA: QAEntry[] = [
  ...TOPIC_1,
  ...TOPIC_2,
  ...TOPIC_3,
  ...TOPIC_4,
  ...TOPIC_5,
  ...TOPIC_6,
  ...TOPIC_7,
  ...TOPIC_8,
  ...TOPIC_9,
  ...TOPIC_10,
]

// ─────────────────────────────────────────────────────────────────────────────
//  SEED RUNNER
// ─────────────────────────────────────────────────────────────────────────────
async function seed() {
  console.log(`\n🚀 Starting CV Knowledge Base seed (Cao Thanh Huy — Data Engineer)`)
  console.log(`   Total Q&A entries: ${ALL_QA.length}\n`)

  const stats = { inserted: 0, updated: 0, blocked: 0, error: 0 }

  for (let i = 0; i < ALL_QA.length; i++) {
    const entry = ALL_QA[i]
    const prefix = `[${String(i + 1).padStart(2, '0')}/${ALL_QA.length}]`

    try {
      const result = await upsertQA(entry.question, entry.answer, entry.aliases)
      const key = result.status === 'inserted' ? 'inserted'
                : result.status === 'updated'  ? 'updated'
                : 'blocked'
      stats[key]++

      const icon = result.status === 'inserted' ? '✅' : result.status === 'updated' ? '🔄' : '⏭️'
      console.log(`${prefix} ${icon} [${result.status}] ${entry.question.substring(0, 70)}...`)
    } catch (err) {
      stats.error++
      console.error(`${prefix} ❌ ERROR: ${entry.question.substring(0, 60)}`)
      console.error(`        ${err}`)
    }
  }

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`✅  Inserted (new):      ${stats.inserted}`)
  console.log(`🔄  Updated (dedupe):    ${stats.updated}`)
  console.log(`⏭️  Blocked (duplicate): ${stats.blocked}`)
  console.log(`❌  Errors:              ${stats.error}`)
  console.log(`${'─'.repeat(60)}`)
  console.log(`📦  Total processed:    ${ALL_QA.length}`)
  console.log(`\n🎉 CV seed complete! memory.db is ready.\n`)

  process.exit(0)
}

seed().catch((err) => {
  console.error('Fatal seed error:', err)
  process.exit(1)
})
