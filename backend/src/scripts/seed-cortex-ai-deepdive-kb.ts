import { upsertQA } from "../lib/localStore.js";

// ─── TOPIC 1: Snowflake Cortex AI Overview ───────────────────────────────────
const CORTEX_OVERVIEW = [
  {
    question: "What is Snowflake Cortex AI?",
    answer: `Snowflake Cortex AI is a fully managed, serverless AI/ML platform built natively inside Snowflake. It provides:
• **LLM Functions**: SQL-accessible functions like COMPLETE(), EXTRACT_ANSWER(), SUMMARIZE(), SENTIMENT(), TRANSLATE() that run frontier models without any infrastructure setup.
• **Cortex Search**: A hybrid (vector + keyword) search service for RAG pipelines, fully managed with automatic embedding.
• **Cortex Analyst**: A natural language to SQL service that converts business questions into SQL queries against Snowflake tables.
• **Cortex Fine-tuning**: Managed fine-tuning of open LLMs (Mistral, LLaMA) on your private Snowflake data, keeping data inside the platform.
• **ML Functions**: Forecasting, anomaly detection, classification without code — just SQL.

The key value proposition is **zero data movement**: your AI runs where your data already lives, eliminating latency, egress costs, and governance risks.`,
    aliases: ["cortex ai overview", "what is cortex", "snowflake ai platform", "snowflake cortex"],
  },
  {
    question: "What is the architecture of Snowflake Cortex AI?",
    answer: `Cortex AI sits as a native layer on top of Snowflake's multi-cluster compute architecture:

**Layer 1 — Storage Layer:** Structured data in Iceberg/native tables, unstructured docs in Snowflake Stages (S3-compatible object storage).

**Layer 2 — Cortex Services:**
- Cortex Search Service → indexes and embeds documents from stages/tables, exposes a REST endpoint for hybrid retrieval.
- Cortex LLM Functions → serverless GPU compute (not your Snowflake credits) invoked via SQL functions.
- Cortex Analyst → semantic layer that maps NL questions to your Snowflake schema.
- Cortex Fine-tuning → async training jobs on managed GPU clusters.

**Layer 3 — Access Patterns:**
- SQL (SELECT SNOWFLAKE.CORTEX.COMPLETE(...))
- Python Snowpark
- REST API
- Streamlit in Snowflake

**Governance:** All calls are subject to Snowflake RBAC and access policies. No data ever leaves the Snowflake VPC boundary.`,
    aliases: ["cortex architecture", "how cortex works", "cortex internal architecture"],
  },
  {
    question: "How does Snowflake Cortex differ from calling OpenAI directly?",
    answer: `Key differences:

| Dimension | OpenAI Direct | Snowflake Cortex |
|---|---|---|
| **Data Movement** | Must send data out to OpenAI API | Data stays in Snowflake VPC |
| **Governance** | You handle data masking / PII filtering | Snowflake RBAC applies automatically |
| **Setup** | API keys, rate limits, SDK management | Zero setup, SQL callable |
| **Embedding** | Must self-manage embedding + vector DB | Cortex Search handles it automatically |
| **Cost Model** | Per-token, unpredictable | Snowflake credit-based, predictable |
| **Latency** | Network round-trip to external API | Local compute, lower latency for bulk ops |
| **Fine-tuning** | OpenAI fine-tuning, data leaves boundary | Cortex fine-tuning, data never leaves |
| **Models Available** | GPT-4, o1 etc. | LLaMA 3, Mistral, Snowflake Arctic |

For enterprise data that cannot leave a security boundary, Cortex is the only viable path.`,
    aliases: ["cortex vs openai", "snowflake vs openai", "why use cortex", "cortex advantages"],
  },
];

// ─── TOPIC 2: Cortex LLM Functions ──────────────────────────────────────────
const CORTEX_LLM_FUNCTIONS = [
  {
    question: "What are the core Cortex LLM SQL functions and how do you use them?",
    answer: `Cortex LLM functions are called via SQL with the schema \`SNOWFLAKE.CORTEX.<FUNCTION>()\`:

**COMPLETE()** — General-purpose text generation:
\`\`\`sql
SELECT SNOWFLAKE.CORTEX.COMPLETE(
  'mistral-large2',
  'Summarize the following customer review: ' || review_text
) AS summary
FROM customer_reviews;
\`\`\`

**EXTRACT_ANSWER()** — QA over a passage:
\`\`\`sql
SELECT SNOWFLAKE.CORTEX.EXTRACT_ANSWER(
  document_text,
  'What is the cancellation policy?'
) AS answer
FROM contracts;
\`\`\`

**SUMMARIZE()** — Concise summary of long text:
\`\`\`sql
SELECT SNOWFLAKE.CORTEX.SUMMARIZE(meeting_transcript) AS summary FROM meetings;
\`\`\`

**SENTIMENT()** — Returns a float from -1 (negative) to +1 (positive):
\`\`\`sql
SELECT SNOWFLAKE.CORTEX.SENTIMENT(review_text) AS score FROM reviews;
\`\`\`

**TRANSLATE()** — Language translation:
\`\`\`sql
SELECT SNOWFLAKE.CORTEX.TRANSLATE(text, 'en', 'vi') AS translated FROM docs;
\`\`\`

These run at Snowflake-scale: you can run them on millions of rows via a single SQL query.`,
    aliases: ["cortex functions", "cortex sql functions", "complete function", "extract answer", "cortex summarize"],
  },
  {
    question: "How do you use COMPLETE() with a structured prompt object (system + user messages)?",
    answer: `COMPLETE() accepts a JSON-structured prompt for chat-style interactions:

\`\`\`sql
SELECT SNOWFLAKE.CORTEX.COMPLETE(
  'mistral-large2',
  [
    {
      'role': 'system',
      'content': 'You are a restaurant reservation assistant. Be concise and helpful.'
    },
    {
      'role': 'user',
      'content': 'I need a table for 4 people at 7pm tonight'
    }
  ],
  { 'temperature': 0.3, 'max_tokens': 512 }
) AS response
FROM DUAL;
\`\`\`

**Options object** supports:
- \`temperature\`: 0.0 (deterministic) to 1.0 (creative)
- \`max_tokens\`: max output tokens
- \`top_p\`: nucleus sampling parameter
- \`guardrails\`: enable/disable Cortex Guard safety filter

In Snowpark Python:
\`\`\`python
from snowflake.cortex import Complete

response = Complete(
    model="mistral-large2",
    prompt=[
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Explain RAG in 3 sentences."}
    ]
)
\`\`\``,
    aliases: ["complete structured prompt", "cortex chat format", "system user message cortex", "cortex complete options"],
  },
  {
    question: "Which LLM models are available in Snowflake Cortex and how do you choose?",
    answer: `**Available Models (as of 2025):**

| Model | Best For | Context Window |
|---|---|---|
| \`snowflake-arctic-instruct\` | Cost-efficient enterprise tasks | 4K tokens |
| \`mistral-large2\` | Complex reasoning, long context | 128K tokens |
| \`mistral-7b\` | Fast, lightweight generation | 32K tokens |
| \`llama3-70b\` | General purpose, strong reasoning | 8K tokens |
| \`llama3-8b\` | Low latency, cost-efficient | 8K tokens |
| \`llama3.1-405b\` | Highest accuracy tasks | 128K tokens |
| \`mixtral-8x7b\` | Efficient MoE architecture | 32K tokens |
| \`reka-flash\` | Multimodal + text | 100K tokens |
| \`jamba-instruct\` | Long document tasks | 256K tokens |

**Selection Strategy:**
- **Prototype/Dev:** \`llama3-8b\` (fast, cheap)
- **Production RAG:** \`mistral-large2\` or \`llama3-70b\` (quality + context)
- **Bulk batch jobs:** \`snowflake-arctic-instruct\` (cost optimized)
- **Very long documents:** \`jamba-instruct\` (256K context)`,
    aliases: ["cortex models", "which model to use", "llm models cortex", "arctic mistral llama cortex"],
  },
  {
    question: "What is Cortex Guard and when should you enable it?",
    answer: `**Cortex Guard** is Snowflake's built-in safety filter that screens LLM outputs for harmful content (violence, hate speech, PII leakage, etc.) using a secondary classifier model.

**Enable via the options parameter:**
\`\`\`sql
SELECT SNOWFLAKE.CORTEX.COMPLETE(
  'mistral-large2',
  'Generate a response to: ' || user_message,
  { 'guardrails': true }
) AS safe_response
FROM user_inputs;
\`\`\`

**When to enable:**
✅ Customer-facing chatbots (users can inject adversarial prompts)
✅ Reservation confirmation messages sent to guests
✅ Any output that gets displayed publicly or emailed

**When to disable:**
❌ Internal batch analytics (no user interaction)
❌ Code generation pipelines (strict content is fine)
❌ Latency-critical paths (Cortex Guard adds ~200ms)

**Cost:** Uses additional Snowflake credits. Evaluate the trade-off between safety and throughput for each use case.`,
    aliases: ["cortex guard", "guardrails snowflake", "safety filter cortex", "cortex safe output"],
  },
];

// ─── TOPIC 3: Cortex Search ───────────────────────────────────────────────────
const CORTEX_SEARCH = [
  {
    question: "What is Cortex Search and how does it work?",
    answer: `**Cortex Search** is Snowflake's fully managed hybrid search service for RAG applications. It combines:

1. **Dense vector search** (semantic similarity via embedding model)
2. **BM25 keyword search** (exact term matching)
3. **Reciprocal Rank Fusion** to merge and re-rank results

**How to create a Cortex Search Service:**
\`\`\`sql
CREATE OR REPLACE CORTEX SEARCH SERVICE restaurant_kb_search
  ON content_column          -- the text column to search
  ATTRIBUTES category, source  -- filterable metadata columns
  WAREHOUSE = COMPUTE_WH
  TARGET_LAG = '1 hour'
AS (
  SELECT content, category, source, chunk_id
  FROM restaurant_knowledge_base
);
\`\`\`

**Querying via SQL:**
\`\`\`sql
SELECT PARSE_JSON(
  SNOWFLAKE.CORTEX.SEARCH_PREVIEW(
    'restaurant_kb_search',
    '{
      "query": "cancellation policy for bookings",
      "columns": ["content", "category"],
      "filter": {"@eq": {"category": "policy"}},
      "limit": 5
    }'
  )
)['results'] AS search_results;
\`\`\`

**TARGET_LAG** controls how frequently the index is refreshed from the source table.`,
    aliases: ["cortex search", "what is cortex search", "cortex search service", "cortex RAG search"],
  },
  {
    question: "How do you build a RAG pipeline with Cortex Search in Snowpark Python?",
    answer: `Full RAG pipeline using Cortex Search + Cortex Complete:

\`\`\`python
from snowflake.snowpark import Session
from snowflake.core import Root

def build_rag_response(session: Session, user_question: str) -> str:
    root = Root(session)
    
    # Step 1: Retrieve relevant context from Cortex Search
    search_service = (
        root.databases["RESTAURANT_DB"]
            .schemas["PUBLIC"]
            .cortex_search_services["RESTAURANT_KB_SEARCH"]
    )
    
    results = search_service.search(
        query=user_question,
        columns=["content", "category", "source"],
        filter={"@eq": {"category": "reservation_policy"}},
        limit=5
    )
    
    # Step 2: Build context string from retrieved chunks
    context = "\\n\\n".join([r["content"] for r in results.results])
    
    # Step 3: Generate answer with Cortex Complete
    from snowflake.cortex import Complete
    
    prompt = f"""You are a restaurant AI assistant. Use the following context to answer the question.
    
Context:
{context}

Question: {user_question}

Answer concisely based only on the provided context."""
    
    response = Complete(model="mistral-large2", prompt=prompt)
    return response

# Usage
answer = build_rag_response(session, "What is the cancellation policy for large groups?")
\`\`\``,
    aliases: ["cortex search rag", "rag pipeline cortex", "cortex search python", "snowpark rag"],
  },
  {
    question: "How do you handle document chunking for Cortex Search?",
    answer: `Cortex Search requires pre-chunked text. Best practice chunking strategy:

\`\`\`python
# Using Snowflake's built-in text splitting function
import json
from snowflake.snowpark import Session

def chunk_and_load_documents(session: Session, documents: list[dict]):
    """Chunk documents and load into Snowflake table for Cortex Search indexing."""
    
    # Use Snowflake's SPLIT_TEXT_RECURSIVE_CHARACTER function
    session.sql("""
        INSERT INTO restaurant_knowledge_base (chunk_id, content, category, source)
        SELECT
            UUID_STRING() AS chunk_id,
            chunk.value AS content,
            :category AS category,
            :source AS source
        FROM TABLE(
            FLATTEN(
                SNOWFLAKE.CORTEX.SPLIT_TEXT_RECURSIVE_CHARACTER(
                    :full_text,
                    'markdown',    -- respect markdown boundaries
                    1000,          -- max chunk size (chars)
                    200            -- overlap (chars)
                )
            )
        ) AS chunk
    """, params={"category": "policy", "source": "menu.md", "full_text": "..."})

# Chunking strategy guidelines:
# - Chunk size: 500–1500 chars (too small = lost context, too large = diluted relevance)
# - Overlap: 10–20% of chunk size (preserves context at boundaries)
# - Split boundaries: paragraph > sentence > word (never mid-sentence)
# - Add metadata: source file, section header, timestamp for filtering
\`\`\`

**Cortex Search automatically re-embeds** whenever the source table updates (per TARGET_LAG).`,
    aliases: ["cortex search chunking", "document chunking cortex", "split text cortex", "chunk documents snowflake"],
  },
  {
    question: "How do you filter search results in Cortex Search?",
    answer: `Cortex Search supports structured filters using a JSON filter object:

**Equality filter:**
\`\`\`json
{ "@eq": { "category": "menu" } }
\`\`\`

**AND filter:**
\`\`\`json
{ "@and": [
    { "@eq": { "category": "reservation" } },
    { "@eq": { "source": "policy_2024.pdf" } }
]}
\`\`\`

**OR filter:**
\`\`\`json
{ "@or": [
    { "@eq": { "category": "menu" } },
    { "@eq": { "category": "pricing" } }
]}
\`\`\`

**In Python:**
\`\`\`python
results = search_service.search(
    query="table booking rules",
    columns=["content"],
    filter={
        "@and": [
            {"@eq": {"category": "reservation"}},
            {"@eq": {"language": "en"}}
        ]
    },
    limit=3
)
\`\`\`

**Best practice for restaurant RAG:** Use \`category\` as the primary filter dimension (menu, policy, FAQ, promotion) so that irrelevant knowledge doesn't contaminate LLM context.`,
    aliases: ["cortex search filter", "filter cortex search results", "cortex search metadata filter"],
  },
];

// ─── TOPIC 4: Cortex Analyst ─────────────────────────────────────────────────
const CORTEX_ANALYST = [
  {
    question: "What is Cortex Analyst and how is it different from Cortex Search?",
    answer: `**Cortex Analyst** = Natural Language → SQL → Query structured Snowflake tables.

**Cortex Search** = Natural Language → Vector/keyword search → Retrieve unstructured document chunks.

| Feature | Cortex Analyst | Cortex Search |
|---|---|---|
| **Input Data** | Structured tables (numbers, dates) | Unstructured text (docs, FAQs) |
| **Output** | SQL query + result table | Ranked text chunks |
| **Use Case** | "How many reservations last week?" | "What is the cancellation policy?" |
| **Setup** | Semantic Model YAML | CREATE CORTEX SEARCH SERVICE |

**How Cortex Analyst works:**
1. You define a **Semantic Model** (YAML) that maps your tables, columns, and relationships into business concepts.
2. User asks a NL question.
3. Cortex Analyst generates a SQL query against your Snowflake tables.
4. Returns the SQL + executed results.

\`\`\`python
import json
import requests

response = requests.post(
    url=f"{snowflake_base_url}/api/v2/cortex/analyst/message",
    json={
        "messages": [{"role": "user", "content": [{"type": "text", "text": "Total reservations by restaurant this month?"}]}],
        "semantic_model_file": "@restaurant_db.public.semantic_models/restaurant_model.yaml"
    },
    headers={"Authorization": f"Snowflake Token={jwt_token}"}
)
\`\`\``,
    aliases: ["cortex analyst", "nl to sql cortex", "natural language sql snowflake", "cortex analyst vs search"],
  },
  {
    question: "How do you build a Semantic Model YAML for Cortex Analyst?",
    answer: `A Semantic Model describes your data in business language so Cortex Analyst can generate correct SQL.

\`\`\`yaml
name: restaurant_reservation_model
description: Semantic model for restaurant reservation analytics

tables:
  - name: RESERVATIONS
    description: All restaurant table bookings
    base_table:
      database: RESTAURANT_DB
      schema: PUBLIC
      table: RESERVATIONS
    
    dimensions:
      - name: restaurant_name
        description: Name of the restaurant location
        expr: restaurant_name
        data_type: TEXT
      
      - name: booking_status
        description: Current status of the reservation (confirmed, cancelled, no-show)
        expr: status
        data_type: TEXT
        sample_values: ['confirmed', 'cancelled', 'no_show']
    
    time_dimensions:
      - name: reservation_date
        description: Date and time of the reservation
        expr: reservation_datetime
        data_type: TIMESTAMP
    
    measures:
      - name: total_reservations
        description: Total number of reservations
        expr: COUNT(*)
        data_type: NUMBER
      
      - name: avg_party_size
        description: Average number of guests per reservation
        expr: AVG(party_size)
        data_type: NUMBER
      
      - name: cancellation_rate
        description: Percentage of reservations that were cancelled
        expr: COUNT_IF(status = 'cancelled') / COUNT(*) * 100
        data_type: NUMBER
\`\`\`

Upload to Snowflake Stage: \`PUT file://restaurant_model.yaml @restaurant_db.public.semantic_models;\``,
    aliases: ["semantic model yaml", "cortex analyst yaml", "cortex analyst setup", "semantic model cortex"],
  },
];

// ─── TOPIC 5: Cortex Fine-Tuning ─────────────────────────────────────────────
const CORTEX_FINE_TUNING = [
  {
    question: "What is Cortex Fine-tuning and when should you use it?",
    answer: `**Cortex Fine-tuning** lets you fine-tune open-source LLMs (LLaMA, Mistral) on your private Snowflake data without data ever leaving Snowflake's infrastructure.

**When to use fine-tuning vs. RAG vs. prompt engineering:**

| Approach | Use When | Cost | Complexity |
|---|---|---|---|
| **Prompt Engineering** | Style/format changes | Very Low | Low |
| **RAG** | Need current / proprietary knowledge | Low | Medium |
| **Fine-tuning** | Domain jargon, consistent format, speed | High (once) | High |

**Best cases for fine-tuning in restaurant AI:**
✅ Train model to always respond in your restaurant's brand voice
✅ Teach domain-specific entities (menu item names, internal codes)
✅ Reduce latency by baking knowledge into weights (smaller context needed)
✅ Consistent structured output format (JSON reservations schema)

**Fine-tuning is NOT for:** keeping up with real-time data (use RAG instead).

\`\`\`sql
SELECT SNOWFLAKE.CORTEX.FINETUNE(
  'CREATE',                          -- action
  'my_custom_reservation_model',     -- output model name
  'mistral-7b',                      -- base model
  'SELECT prompt, completion FROM fine_tune_training_data',  -- training query
  'SELECT prompt, completion FROM fine_tune_validation_data' -- validation query
) AS job_id;
\`\`\``,
    aliases: ["cortex fine-tuning", "fine tune cortex", "when to fine tune", "rag vs fine tuning"],
  },
  {
    question: "How do you prepare training data for Cortex Fine-tuning?",
    answer: `Cortex Fine-tuning uses prompt-completion pairs in a Snowflake table.

**Required schema:**
\`\`\`sql
CREATE TABLE fine_tune_training_data (
  prompt     TEXT NOT NULL,   -- the input (instruction + context)
  completion TEXT NOT NULL    -- the desired output
);
\`\`\`

**Example training data for restaurant assistant:**
\`\`\`sql
INSERT INTO fine_tune_training_data VALUES
(
  'User: I want to book a table for 6 at 8pm Friday\nAssistant:',
  'I''d be happy to help! Could you confirm which restaurant location and date? We have openings at our downtown and uptown branches.'
),
(
  'User: Cancel my reservation #R-4521\nAssistant:',
  'I''ve located reservation #R-4521. To process the cancellation, please confirm your name and email. Note that cancellations within 2 hours of your booking time may incur a fee.'
);
\`\`\`

**Data quality guidelines:**
- Minimum: 32 examples (50–100+ recommended for quality)
- Format consistency: always same input/output format
- Balance: equal distribution across task types
- Validation split: 10–20% held out for eval

**Monitor the job:**
\`\`\`sql
SELECT * FROM TABLE(SNOWFLAKE.CORTEX.FINETUNE('DESCRIBE', '<job_id>'));
\`\`\``,
    aliases: ["fine tuning training data", "cortex training data format", "fine tune data prep", "prompt completion pairs"],
  },
];

// ─── TOPIC 6: Cortex in Restaurant Reservation System ────────────────────────
const CORTEX_RESTAURANT_USE_CASES = [
  {
    question: "How would you architect a restaurant reservation chatbot using Cortex AI end-to-end?",
    answer: `**End-to-End Architecture:**

\`\`\`
User Message
     │
     ▼
[Intent Router — Cortex COMPLETE()]
     │
     ├─► "analytics query" → [Cortex Analyst] → SQL → Reservation DB → Response
     │
     ├─► "knowledge question" → [Cortex Search RAG] → Chunks → COMPLETE() → Response  
     │
     └─► "booking action" → [Booking Agent] → Snowflake Booking Table → Confirmation
\`\`\`

**Implementation:**
\`\`\`python
async def handle_user_message(session, message: str) -> str:
    # Step 1: Intent classification
    intent = classify_intent(session, message)
    
    if intent == "ANALYTICS":
        # Use Cortex Analyst for structured queries
        result = await cortex_analyst_query(session, message)
        return format_analytics_response(result)
    
    elif intent == "KNOWLEDGE":
        # Use Cortex Search + Complete for FAQ/policy questions
        context = await cortex_search_retrieve(session, message)
        return await cortex_complete_with_context(session, message, context)
    
    elif intent == "BOOKING":
        # Extract entities then write to reservation table
        entities = await extract_booking_entities(session, message)
        return await create_reservation(session, entities)

def classify_intent(session, message: str) -> str:
    result = session.sql("""
        SELECT SNOWFLAKE.CORTEX.COMPLETE('mistral-7b', CONCAT(
            'Classify this message as ANALYTICS, KNOWLEDGE, or BOOKING. Reply only the label.\\n\\nMessage: ', :1
        ))""", params=[message]).collect()
    return result[0][0].strip()
\`\`\``,
    aliases: ["restaurant chatbot cortex", "reservation bot cortex", "cortex end to end restaurant", "cortex restaurant architecture"],
  },
  {
    question: "How do you use Cortex LLM functions to extract booking entities from natural language?",
    answer: `Use COMPLETE() with structured output instructions to extract reservation entities:

\`\`\`python
import json
from snowflake.cortex import Complete

ENTITY_EXTRACTION_PROMPT = """Extract booking details from the user message and return ONLY valid JSON.

User message: "{message}"

Return JSON with these exact fields (use null if not mentioned):
{{
  "date": "YYYY-MM-DD or null",
  "time": "HH:MM or null",
  "party_size": number or null,
  "restaurant_preference": "string or null",
  "special_requests": "string or null",
  "contact_name": "string or null",
  "contact_phone": "string or null"
}}"""

def extract_booking_entities(message: str) -> dict:
    raw = Complete(
        model="mistral-large2",
        prompt=ENTITY_EXTRACTION_PROMPT.format(message=message),
        options={"temperature": 0.0}  # deterministic for structured extraction
    )
    
    # Parse and validate
    try:
        entities = json.loads(raw)
        # Convert relative dates: "tomorrow" → "2025-02-05"
        if entities.get("date") == "tomorrow":
            entities["date"] = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        return entities
    except json.JSONDecodeError:
        # Fallback: return empty dict to trigger clarification
        return {}

# Example:
# Input: "Book a table for 4 people at La Maison this Friday at 7:30pm"
# Output: {"date": "2025-02-07", "time": "19:30", "party_size": 4, "restaurant_preference": "La Maison", ...}
\`\`\``,
    aliases: ["entity extraction cortex", "booking entity extraction", "extract reservation details llm", "structured output cortex"],
  },
  {
    question: "How do you implement real-time availability checking using Snowflake + Cortex?",
    answer: `Combine Snowflake's live table queries with Cortex for natural language responses:

\`\`\`python
async def check_and_respond_availability(
    session: Session, 
    requested_date: str, 
    requested_time: str,
    party_size: int,
    restaurant_id: str
) -> str:
    
    # Step 1: Query availability from live Snowflake table
    availability = session.sql("""
        SELECT 
            table_id,
            capacity,
            CASE WHEN EXISTS (
                SELECT 1 FROM reservations r
                WHERE r.table_id = t.table_id
                  AND r.restaurant_id = :1
                  AND r.reservation_date = :2::DATE
                  AND ABS(DATEDIFF('minute', r.reservation_time, :3::TIME)) < 90
                  AND r.status = 'confirmed'
            ) THEN 'booked' ELSE 'available' END AS availability_status
        FROM restaurant_tables t
        WHERE t.restaurant_id = :1
          AND t.capacity >= :4
        ORDER BY capacity ASC
    """, params=[restaurant_id, requested_date, requested_time, party_size]).to_pandas()
    
    available_tables = availability[availability['availability_status'] == 'available']
    
    # Step 2: Generate natural response with Cortex
    context = f"Available tables: {len(available_tables)} | Party size: {party_size} | Date: {requested_date} at {requested_time}"
    
    response = Complete(
        model="llama3-8b",  # fast model for simple response generation
        prompt=f"Based on this availability info, respond helpfully: {context}"
    )
    return response
\`\`\``,
    aliases: ["availability checking cortex", "real time availability snowflake", "table availability query", "check booking availability"],
  },
  {
    question: "How would you use Cortex to analyze reservation patterns and generate business insights?",
    answer: `Combine Cortex Analyst for data retrieval with COMPLETE() for insight narration:

\`\`\`python
def generate_weekly_insights(session: Session) -> str:
    # Step 1: Pull metrics via SQL
    metrics = session.sql("""
        SELECT
            DAYOFWEEK(reservation_datetime)  AS day_of_week,
            HOUR(reservation_datetime)        AS hour_of_day,
            COUNT(*)                          AS total_bookings,
            AVG(party_size)                   AS avg_party_size,
            COUNT_IF(status = 'cancelled') / COUNT(*) * 100 AS cancellation_rate,
            SUM(CASE WHEN source = 'chatbot' THEN 1 ELSE 0 END) AS ai_bookings
        FROM reservations
        WHERE reservation_datetime >= DATEADD('day', -7, CURRENT_TIMESTAMP())
        GROUP BY 1, 2
        ORDER BY total_bookings DESC
    """).to_pandas().to_dict(orient='records')
    
    # Step 2: Ask Cortex to narrate insights
    metrics_text = json.dumps(metrics, indent=2)
    
    narrative = Complete(
        model="mistral-large2",
        prompt=f"""You are a restaurant analytics expert. Analyze this weekly reservation data and provide 3 actionable business insights:

Data:
{metrics_text}

Focus on: peak hours, cancellation patterns, AI vs manual booking trends. Be specific with numbers."""
    )
    
    return narrative

# Output example:
# "Your busiest period is Friday-Saturday 7-9PM with 45% of weekly bookings.
#  Cancellation rate spikes to 18% on Mondays — consider requiring deposits.
#  AI chatbot handles 34% of bookings, rising from 21% last week."
\`\`\``,
    aliases: ["reservation analytics cortex", "business insights cortex", "cortex analytics narrative", "snowflake ai insights"],
  },
];

// ─── TOPIC 7: Cortex Performance & Cost Optimization ─────────────────────────
const CORTEX_OPTIMIZATION = [
  {
    question: "How do you optimize Cortex LLM function costs in Snowflake?",
    answer: `**Cost drivers:** Cortex LLM functions consume Snowflake credits per token processed (input + output).

**Optimization strategies:**

**1. Choose the right model:**
\`\`\`sql
-- BAD: Using large model for simple classification
SELECT SNOWFLAKE.CORTEX.COMPLETE('llama3.1-405b', 'Is this positive or negative: ' || text)

-- GOOD: Use smallest model that does the job
SELECT SNOWFLAKE.CORTEX.COMPLETE('llama3-8b', 'Is this positive or negative? Reply only POS or NEG: ' || text)
-- Or even better: use the purpose-built function
SELECT SNOWFLAKE.CORTEX.SENTIMENT(text)  -- much cheaper than COMPLETE()
\`\`\`

**2. Cache results for repeated queries:**
\`\`\`sql
CREATE TABLE cortex_cache AS
SELECT query_hash, result, CURRENT_TIMESTAMP() AS created_at
FROM (SELECT MD5(input_text) AS query_hash, ...);
-- Check cache before calling Cortex
\`\`\`

**3. Batch process instead of row-by-row:**
\`\`\`sql
-- Process all rows in one query rather than Python loop
UPDATE reviews SET ai_summary = SNOWFLAKE.CORTEX.SUMMARIZE(review_text)
WHERE ai_summary IS NULL;
\`\`\`

**4. Limit output tokens:**
\`\`\`sql
SELECT SNOWFLAKE.CORTEX.COMPLETE('mistral-large2', prompt, {'max_tokens': 150})
\`\`\`

**5. Use Cortex Search instead of passing full docs to COMPLETE():** 
Retrieve only the top-3 relevant chunks (300 tokens) instead of the full 10,000 token document.`,
    aliases: ["cortex cost optimization", "reduce cortex costs", "snowflake ai cost", "cortex credits optimization"],
  },
  {
    question: "What are the latency characteristics of Cortex AI and how do you minimize response time?",
    answer: `**Typical latencies (time-to-first-token):**
- \`llama3-8b\`: ~200–400ms
- \`mistral-7b\`: ~300–500ms
- \`llama3-70b\`: ~800ms–1.5s
- \`mistral-large2\`: ~1–2s
- \`llama3.1-405b\`: ~2–4s

**Optimization strategies for low-latency restaurant chatbot:**

**1. Model cascade (fast → slow):**
\`\`\`python
async def respond(query: str) -> str:
    # Try fast model first
    quick_response = await cortex_complete("llama3-8b", query)
    if is_sufficient(quick_response):
        return quick_response
    # Fall back to high-quality model only when needed
    return await cortex_complete("mistral-large2", query)
\`\`\`

**2. Streaming for perceived latency reduction:**
\`\`\`python
# Stream tokens as they're generated instead of waiting for full response
# Use Server-Sent Events (SSE) to push partial tokens to frontend
for chunk in Complete(model="mistral-large2", prompt=prompt, stream=True):
    yield chunk
\`\`\`

**3. Pre-compute common queries:**
Cache answers to the top-20 most frequent questions (cancellation policy, hours, menu) and skip Cortex entirely for those.

**4. Parallel retrieval + generation:**
Run Cortex Search retrieval and intent classification in parallel before sending to COMPLETE().`,
    aliases: ["cortex latency", "cortex response time", "reduce cortex latency", "cortex performance optimization"],
  },
];

// ─── TOPIC 8: Cortex Governance & Security ───────────────────────────────────
const CORTEX_GOVERNANCE = [
  {
    question: "How does Snowflake Cortex handle data privacy and governance?",
    answer: `**Key governance guarantees:**

**1. Data never leaves Snowflake:** All Cortex LLM processing happens within the Snowflake Cloud VPC. Third-party model providers (Meta, Mistral) cannot access your data — Snowflake runs the model weights on their own infrastructure.

**2. Snowflake RBAC applies:**
\`\`\`sql
-- Grant Cortex usage to specific role only
GRANT DATABASE ROLE SNOWFLAKE.CORTEX_USER TO ROLE restaurant_ai_role;

-- Cortex functions respect column masking policies
CREATE MASKING POLICY pii_mask AS (val TEXT) RETURNS TEXT ->
  CASE WHEN CURRENT_ROLE() IN ('ADMIN') THEN val
  ELSE '***REDACTED***' END;
ALTER TABLE reservations MODIFY COLUMN customer_phone SET MASKING POLICY pii_mask;
-- Cortex COMPLETE() will receive masked value automatically
\`\`\`

**3. Query audit trail:** All Cortex function calls appear in \`SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY\` for full auditability.

**4. No training on your data:** Snowflake contractually guarantees that your data is NOT used to train or improve the base models.

**5. Network policy compliance:** Cortex respects your Snowflake network policies (IP allowlisting, private link).

**For restaurant PII (customer names, phone numbers):** Apply dynamic data masking to reservation tables before Cortex processes them unless the LLM explicitly needs the PII.`,
    aliases: ["cortex governance", "cortex data privacy", "snowflake ai security", "cortex RBAC", "data privacy cortex"],
  },
  {
    question: "How do you audit and monitor Cortex AI usage in Snowflake?",
    answer: `**Monitoring Cortex usage via system views:**

\`\`\`sql
-- 1. View all Cortex LLM function calls in the last 7 days
SELECT
    query_text,
    user_name,
    role_name,
    start_time,
    total_elapsed_time / 1000 AS duration_seconds,
    credits_used_cloud_services
FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
WHERE query_text ILIKE '%SNOWFLAKE.CORTEX%'
  AND start_time >= DATEADD('day', -7, CURRENT_TIMESTAMP())
ORDER BY start_time DESC;

-- 2. Credit consumption by Cortex function type
SELECT
    REGEXP_SUBSTR(query_text, 'CORTEX\\\\.(\\\\w+)', 1, 1, 'ie', 1) AS cortex_function,
    COUNT(*) AS call_count,
    SUM(credits_used_cloud_services) AS total_credits
FROM SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY
WHERE query_text ILIKE '%SNOWFLAKE.CORTEX%'
  AND start_time >= DATE_TRUNC('month', CURRENT_DATE())
GROUP BY 1
ORDER BY total_credits DESC;

-- 3. Set budget alert (via Resource Monitor)
CREATE RESOURCE MONITOR cortex_budget
  WITH CREDIT_QUOTA = 100
  TRIGGERS ON 80 PERCENT DO NOTIFY
           ON 100 PERCENT DO SUSPEND;
\`\`\`

**Best practice:** Create a dedicated warehouse for Cortex workloads and attach a Resource Monitor so you get alerts before budget overruns.`,
    aliases: ["cortex monitoring", "cortex audit", "monitor cortex usage", "cortex credit tracking"],
  },
];

// ─── AGGREGATE ALL Q&A ───────────────────────────────────────────────────────
const ALL_QA = [
  ...CORTEX_OVERVIEW,
  ...CORTEX_LLM_FUNCTIONS,
  ...CORTEX_SEARCH,
  ...CORTEX_ANALYST,
  ...CORTEX_FINE_TUNING,
  ...CORTEX_RESTAURANT_USE_CASES,
  ...CORTEX_OPTIMIZATION,
  ...CORTEX_GOVERNANCE,
];

// ─── SEED RUNNER ─────────────────────────────────────────────────────────────
async function seed() {
  console.log(`\n🧠 Seeding Cortex AI Deep Dive KB — ${ALL_QA.length} Q&A pairs\n`);

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
