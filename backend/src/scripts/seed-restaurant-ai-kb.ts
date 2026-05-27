/**
 * seed-restaurant-ai-kb.ts
 *
 * Bulk-seeds ~80 Q&A entries about the Restaurant Reservation AI Chatbot system
 * into memory.db via the existing upsertQA pipeline.
 *
 * Run:  npx tsx src/scripts/seed-restaurant-ai-kb.ts
 *
 * Persona: Solution Architect + AI/ML Engineer
 * Depth:   High-level (3–5 bullets), interview-ready
 * Lang:    English only
 */

import { upsertQA } from '../lib/localStore.js'

interface QAEntry {
  question: string
  answer: string
  aliases: string[]
}

// ─────────────────────────────────────────────────────────────────────────────
//  TOPIC 1: System Overview & Architecture (8 Q&A)
// ─────────────────────────────────────────────────────────────────────────────
const TOPIC_1: QAEntry[] = [
  {
    question: 'Can you give a high-level overview of the restaurant reservation AI chatbot system?',
    answer: `The system is a fully automated, end-to-end restaurant reservation platform built on a multi-agent AI architecture.
• At the front is the Conversational AI Agent — it handles all inbound channels (WhatsApp, LivePerson, Salesforce) and uses NLP to understand user intent.
• Behind that, two Service Agents run in parallel: the Customer Agent pulls a 360-degree customer profile from Salesforce Data Cloud, while the Product Agent queries the restaurant catalog and card entitlements.
• Cortex AI sits at the center as the orchestration and reasoning brain — it synthesizes data from all agents, uses LLM reasoning to decide the best recommendation, and calls the booking API on the customer's behalf.
• The result is a zero-touch booking flow: customer says "Book me a table for two Friday evening" — the system finds the best match, confirms with the customer, and places the reservation on OpenTable or SevenRooms automatically.`,
    aliases: [
      'Describe the architecture of the restaurant booking chatbot',
      'Walk me through the high-level design of the reservation AI system',
      'What does the overall system look like?',
      'System architecture overview for the AI booking system',
      'How does the restaurant reservation chatbot work?',
    ],
  },
  {
    question: 'Why did you choose a multi-agent architecture instead of a single monolithic AI model?',
    answer: `Multi-agent gives us separation of concerns, independent scalability, and fault isolation — three things a monolithic model can't offer.
• Each agent is specialized: the Customer Agent is optimized for CRM data retrieval, the Product Agent for catalog search, and Cortex AI for reasoning — each can be improved, scaled, or replaced independently.
• Fault isolation is critical in a booking context: if the Product Agent has an issue, the Conversational Agent keeps running and the Customer Agent can still serve personalized data.
• Horizontal scaling per bottleneck: the NLP layer (Conversational Agent) handles the highest request volume and can scale out independently without scaling the entire system.
• Swappable components: we can upgrade the LLM model in Cortex AI or swap OpenTable for SevenRooms without touching the other agents.`,
    aliases: [
      'Why multi-agent over monolithic AI?',
      'Benefits of multi-agent design for restaurant booking',
      'Why not use a single AI model for everything?',
      'Advantages of agent-based architecture in this system',
    ],
  },
  {
    question: 'What is the end-to-end flow from when a customer sends a message to a confirmed reservation?',
    answer: `The flow has five distinct stages, executed in under 3 seconds for a standard request.
• Stage 1 — Intent & entity extraction: Conversational Agent receives the message, detects intent (book_table), and extracts entities: date, time, party size, cuisine preference.
• Stage 2 — Parallel data fetch: Customer Agent queries Salesforce Data Cloud for the customer profile (preferences, loyalty tier, dietary restrictions) while Product Agent queries Kontent.ai for restaurant options and SFDC Entitlement for card-level access — both run simultaneously.
• Stage 3 — LLM reasoning: Cortex AI synthesizes the customer profile + restaurant shortlist, reasons about the best match, and generates a structured recommendation.
• Stage 4 — Customer confirmation: the recommendation is surfaced to the customer; they confirm date, time, and restaurant.
• Stage 5 — Booking API call: Cortex AI calls OpenTable or SevenRooms, receives a booking ID and confirmation number, then sends confirmation back via the original channel.`,
    aliases: [
      'Walk me through the booking flow',
      'How does a reservation get made from start to finish?',
      'What happens when a customer asks to book a table?',
      'End-to-end reservation process in the chatbot',
      'Step by step booking flow for the AI system',
    ],
  },
  {
    question: 'How does the system handle requests from multiple channels like WhatsApp, LivePerson, and Salesforce?',
    answer: `We use a channel-agnostic abstraction layer that normalizes all inbound messages before any AI processing.
• Each channel has its own adapter (WebSocket for LivePerson, Webhook for WhatsApp, API for SFDC) — adapters translate channel-specific payloads into a unified message object with fields: customer_id, channel, content, timestamp.
• The Conversational Agent only ever sees the normalized message object — it has zero awareness of which channel the message came from.
• Responses are rendered back through the originating channel adapter, applying channel-specific formatting (markdown for LivePerson, plain text for WhatsApp).
• Session context is keyed by customer_id, not channel — so a customer can start a booking on WhatsApp and continue on LivePerson without losing state.`,
    aliases: [
      'How do you support multiple channels?',
      'WhatsApp, LivePerson, and SFDC — how do you unify them?',
      'Channel-agnostic architecture for the chatbot',
      'Multi-channel support strategy',
    ],
  },
  {
    question: 'What are the key business metrics this system is designed to improve?',
    answer: `Three primary metrics drive the business case: conversion rate, response time, and availability.
• Conversion rate: the percentage of booking intents that result in a confirmed reservation — target to go from ~40% (manual, phone-based) to 85%+ with the automated system.
• Response time: average time from customer request to booking confirmation dropped from hours (email/phone callbacks) to under 3 seconds.
• 24/7 availability: the system captures bookings outside business hours — demand that was previously lost due to staff unavailability.
• Secondary metric: staff reallocation efficiency — reservation staff move from routine data entry to high-value guest relationship work.`,
    aliases: [
      'What business value does this system provide?',
      'KPIs for the restaurant reservation chatbot',
      'How does this improve conversion rates?',
      'Business impact of the booking AI system',
    ],
  },
  {
    question: 'What were the biggest technical challenges in building this system?',
    answer: `The hardest problems were orchestration timing, LLM grounding, and third-party API reliability.
• Agent orchestration: coordinating Customer Agent and Product Agent to run in parallel without race conditions required an async event-driven design — agents publish events rather than waiting for synchronous responses.
• LLM hallucination in a high-stakes context: an LLM confidently returning the wrong time or restaurant name causes real-world booking errors; we needed strict output validation, structured JSON schemas, and a mandatory customer confirmation gate.
• Third-party API diversity: OpenTable and SevenRooms have completely different API schemas, SLAs, and rate limits — building a unified booking adapter with retry logic, circuit breakers, and idempotency required significant engineering effort.
• Cold-start personalization: new customers have no dining history, so we needed an explicit preference elicitation strategy rather than defaulting to generic recommendations.`,
    aliases: [
      'What were the hardest problems you solved?',
      'Technical challenges in building the booking chatbot',
      'Biggest engineering difficulties in the system',
      'What challenges did you face with the reservation AI?',
    ],
  },
  {
    question: 'How does the system decide which booking platform to use — OpenTable or SevenRooms?',
    answer: `The decision is driven by restaurant-to-platform mapping in the catalog, with card entitlement as an override.
• Each restaurant in the Kontent.ai catalog has a preferred_booking_platform field — most are exclusive to one platform, so the choice is deterministic for them.
• For restaurants on both platforms, the system picks whichever has better real-time availability for the requested slot.
• SFDC Entitlement adds an override: certain Platinum-tier card benefits unlock SevenRooms-exclusive priority booking windows that aren't available on OpenTable — entitlement check wins.
• If the preferred platform is down (circuit breaker open), we automatically try the other platform if the restaurant supports it.`,
    aliases: [
      'OpenTable vs SevenRooms — how do you choose which to use?',
      'How does the system pick a booking platform?',
      'What determines which reservation API is called?',
      'Booking platform selection logic',
    ],
  },
  {
    question: 'How does the system ensure no double bookings or ghost reservations are created?',
    answer: `We prevent duplicate bookings through idempotency keys, confirmation tracking, and session-level deduplication.
• Every booking API call includes an idempotency_key generated from session_id + restaurant_id + requested_datetime — if the same request is retried due to a network failure, the platform returns the original booking ID instead of creating a new one.
• We store each issued idempotency_key in our own database — before retrying, we check if a successful booking already exists for that key.
• Session-level guard: once a booking confirmation is received, the session state transitions to BOOKED and further booking attempts within that session are blocked until the customer explicitly starts a new request.
• Optimistic booking flow: we don't hold slots (no lock-then-book) — we submit the booking and handle a "no longer available" error gracefully with alternative suggestions.`,
    aliases: [
      'How do you prevent duplicate reservations?',
      'Idempotency strategy for booking requests',
      'How do you avoid double booking the same table?',
      'Ghost reservation prevention',
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
//  TOPIC 2: Conversational AI Agent (8 Q&A)
// ─────────────────────────────────────────────────────────────────────────────
const TOPIC_2: QAEntry[] = [
  {
    question: 'What is the role of the Conversational AI Agent in this system?',
    answer: `It is the front-line agent — the single entry point for all customer interactions across every channel.
• Receives raw text input from WhatsApp, LivePerson, or SFDC and runs it through an NLP pipeline to determine intent and extract booking entities.
• Manages the conversation state machine: tracks which information slots are filled, which are missing, and decides when to ask follow-up questions vs. when to route to Service Agents.
• Acts as the orchestration trigger: once all required slots are filled (date, time, party size, preference), it fires events to Customer Agent and Product Agent in parallel.
• Also handles edge cases: greetings, off-topic requests, cancellations, and human escalation triggers.`,
    aliases: [
      'What does the Conversational AI Agent do?',
      'What is the NLP layer responsible for?',
      'Role of the user-facing agent in the booking system',
      'How does the system understand what the customer wants?',
    ],
  },
  {
    question: 'How does the system detect user intent from natural language?',
    answer: `We use a fine-tuned intent classification model combined with confidence thresholding to decide when to act vs. when to clarify.
• A domain-specific intent classifier categorizes input into intents: book_table, modify_reservation, cancel_booking, get_recommendation, general_inquiry.
• Fine-tuned on a restaurant booking corpus — not a general-purpose classifier — which reduces false positives on ambiguous inputs like "Can I change it?" (modify, not cancel).
• Confidence thresholding: below 0.7 confidence, the system sends a clarifying question rather than making assumptions.
• Multi-turn context matters: "Change it to 8pm" is disambiguated as modify_reservation because the session history contains an existing booking intent.`,
    aliases: [
      'How does NLP intent detection work in the booking system?',
      'How does the chatbot classify user intent?',
      'Intent classification for restaurant booking',
      'What model is used for intent detection?',
    ],
  },
  {
    question: 'How does the system extract entities like date, time, party size, and cuisine preference from a message?',
    answer: `A fine-tuned Named Entity Recognition (NER) pipeline extracts all booking-relevant slots from raw natural language.
• Recognizes entity types: DATE, TIME, PARTY_SIZE, LOCATION, CUISINE_TYPE, DIETARY_RESTRICTION, RESTAURANT_NAME.
• Handles relative temporal expressions: "tonight", "this Friday", "next week" are resolved to absolute dates using the customer's timezone.
• Domain-specific patterns: "table for two" → PARTY_SIZE=2, "somewhere with a view" → PREFERENCE attribute, "gluten-free" → DIETARY_RESTRICTION.
• Slot validation layer checks extracted entities for logical consistency: a time of "25:00" or party size of 0 triggers a re-extraction request.`,
    aliases: [
      'How do you extract booking details from a natural language message?',
      'Entity extraction for restaurant booking slots',
      'Slot filling strategy in the booking chatbot',
      'How does the system get date, time, and party size from a message?',
    ],
  },
  {
    question: 'How does the system handle ambiguous or incomplete booking requests?',
    answer: `We use a slot-filling dialogue pattern where the agent proactively asks for missing information, one question at a time.
• The agent maintains a slot checklist: required slots (date, time, party_size) and optional slots (cuisine, location preference). Missing required slots trigger clarification.
• One question per turn — we never dump multiple questions in a single message; research shows it reduces drop-off rate significantly.
• Ambiguity resolution: "Italian near me" → system confirms the customer's city before searching if location isn't in their profile.
• Timeout handling: if no response after 10 minutes, conversation state is persisted so the customer can resume seamlessly when they return.`,
    aliases: [
      'How do you handle incomplete booking requests?',
      'What happens when the customer is vague about what they want?',
      'Clarification dialogue strategy in the chatbot',
      'How does the chatbot ask follow-up questions?',
    ],
  },
  {
    question: 'What is your conversation state management strategy for multi-turn interactions?',
    answer: `Sessions run as finite state machines with state persisted at two layers: in-memory for active sessions, and database for durability.
• State machine stages: GREETING → INTENT_CAPTURE → SLOT_FILLING → CONFIRMATION → BOOKED → CLOSED.
• Active session state (current intent, filled slots, conversation history) lives in-memory for ultra-low latency access.
• Session is persisted to a backing store at each turn transition — so a server restart doesn't lose an in-progress booking.
• Conversation history (last 10 turns) is injected into the LLM context window to maintain coherence across the session.
• Session expires after 30 minutes of inactivity; incomplete state is saved for potential resumption.`,
    aliases: [
      'How do you manage conversation state in the chatbot?',
      'Multi-turn conversation state machine design',
      'How does the chatbot remember what was said earlier in the session?',
      'Session state persistence strategy',
    ],
  },
  {
    question: 'What is your fallback and human escalation strategy when the AI cannot understand the user?',
    answer: `We have a tiered fallback: clarification attempt → second attempt → graceful degradation → human handoff.
• Below 0.5 intent confidence: system sends a polite clarification request ("I want to make sure I get this right — are you looking to make a new reservation or change an existing one?").
• If two consecutive clarification attempts fail to resolve intent: the system escalates to a human agent via LivePerson routing or SFDC case creation.
• Before escalation, any partial data collected (preferred time, cuisine) is included in the handoff context so the human agent doesn't start cold.
• All fallback events are logged as training signal — they feed the next fine-tuning cycle for the intent classifier.`,
    aliases: [
      'What happens when the AI does not understand the customer?',
      'Fallback strategy for low-confidence responses',
      'How do you handle AI failures in conversation?',
      'Human escalation trigger conditions in the chatbot',
    ],
  },
  {
    question: 'How do you handle multilingual users in the system?',
    answer: `Language detection runs as the first step on every incoming message, before any intent or entity processing.
• A language detection model identifies the language (English, French, Spanish are the primary supported languages).
• Intent classification and NER use multilingual models — mBERT-based or similar — that handle entity extraction in any supported language.
• Entities are normalized to a language-agnostic canonical format before downstream agents process them: dates become ISO 8601, party sizes become integers.
• LLM response generation is prompted to respond in the same language as the customer — the same Cortex AI call, just with a language instruction injected.`,
    aliases: [
      'Does the system support multiple languages?',
      'How is multilingual support implemented in the chatbot?',
      'What happens when a customer writes in French or Spanish?',
      'Multilingual NLP strategy for restaurant booking',
    ],
  },
  {
    question: 'How does the Conversational Agent know when it has collected enough information to proceed with booking?',
    answer: `It tracks slot completeness against a required-slot checklist and only fires downstream agents when all required slots are filled.
• Required slots: date, time, and party_size — the minimum needed to call a booking API.
• Optional slots (cuisine preference, location area, dietary restrictions) are enriched from the customer profile if not provided in conversation.
• When all required slots are filled, the agent transitions to SLOT_COMPLETE state and fires parallel events to Customer Agent and Product Agent.
• If the customer provides all slots in a single message (e.g., "Book a table for 4 at Nobu this Saturday at 7pm"), the agent skips the slot-filling loop entirely and goes straight to the data fetch stage.`,
    aliases: [
      'When does the chatbot stop asking questions and proceed with the booking?',
      'Slot completeness check in the conversation flow',
      'How does the agent decide when enough information is collected?',
      'Required vs optional slots in the booking dialog',
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
//  TOPIC 3: Customer Agent & Salesforce Data Cloud (6 Q&A)
// ─────────────────────────────────────────────────────────────────────────────
const TOPIC_3: QAEntry[] = [
  {
    question: 'What does the Customer Agent do and why is it critical for the system?',
    answer: `The Customer Agent is responsible for fetching and surfacing the full customer profile, enabling personalization at scale.
• Queries Salesforce Data Cloud (Customer 360) in real-time to retrieve: dining history, cuisine preferences, dietary restrictions, price range affinity, loyalty tier, and card entitlements.
• This data transforms the system from a generic booking engine to a personalized concierge — recommendations are tailored to the individual, not one-size-fits-all.
• VIP and loyalty status from the profile unlocks premium restaurant access and priority booking windows via the SFDC Entitlement system.
• Acts as the long-term memory layer — so the customer never has to repeat their preferences across sessions.`,
    aliases: [
      'What is the Customer Agent responsible for?',
      'How does the system personalize restaurant recommendations?',
      'Why is the Customer Agent important?',
      'Customer data retrieval in the booking flow',
    ],
  },
  {
    question: 'What is Salesforce Data Cloud and how is it used in this system?',
    answer: `Salesforce Data Cloud is a real-time Customer Data Platform (CDP) that unifies customer data from multiple sources into a single, queryable Customer 360 profile.
• In this system, it's the single source of truth for customer identity: it aggregates data from POS systems, the CRM, the mobile app, and web interactions into one profile.
• The Customer Agent queries the Data Cloud API in real-time at the start of each booking session — not batch-refreshed — so the profile is always current.
• Post-booking write-back: after a successful reservation, the new booking event is pushed back to Data Cloud, keeping dining history up to date for future sessions.
• Data Cloud's identity resolution layer maps different channel IDs (WhatsApp number, email, Salesforce contact ID) to the same canonical customer profile.`,
    aliases: [
      'What is Salesforce Data Cloud?',
      'How does the system use Customer 360?',
      'What data does the Customer Agent pull from Salesforce?',
      'CDP integration for personalization in restaurant booking',
    ],
  },
  {
    question: 'How do you use customer data to personalize restaurant recommendations?',
    answer: `We construct a customer preference vector from historical behavior and use it to score and filter the restaurant shortlist.
• Dining history is analyzed to extract: preferred cuisine types (weighted by recency and frequency), price range affinity, average visit rating, and preferred dining time.
• Hard filters are applied first: dietary restrictions (e.g., vegan, nut allergy) eliminate non-compliant restaurants before any ranking.
• Negative signals matter: restaurants the customer visited and gave low ratings are filtered out of recommendations.
• Final recommendation score: preference_match (60%) + restaurant_rating (20%) + entitlement_bonus (10%) + availability_score (10%).`,
    aliases: [
      'How does personalization work in restaurant recommendations?',
      'How do past dining habits influence suggestions?',
      'Restaurant recommendation scoring algorithm',
      'Using customer history to rank restaurants',
    ],
  },
  {
    question: 'How do you handle a new customer with no dining history — the cold-start problem?',
    answer: `For new customers, we shift from implicit preference inference to explicit preference elicitation and lightweight demographic inference.
• Explicit elicitation: the chatbot asks 2–3 targeted preference questions during the first session — preferred cuisine type, price range, and dining area — keeping friction low.
• Card tier as a soft signal: a Platinum cardholder statistically prefers upscale dining; we use card level as a lightweight proxy for initial filtering before any explicit preferences are collected.
• Location and time inference: a booking request for lunch near a business district skews toward faster, mid-price options without the customer saying anything.
• All collected preferences are written back to Data Cloud immediately — so the cold-start only affects the very first session.`,
    aliases: [
      'What happens for new customers with no booking history?',
      'Cold start problem in restaurant recommendation',
      'How do you handle first-time users in the system?',
      'No dining history — what is the fallback recommendation strategy?',
    ],
  },
  {
    question: 'How do you handle customer data privacy and regulatory compliance?',
    answer: `Privacy is enforced at the data layer, not the application layer — we rely on Salesforce Data Cloud's built-in compliance infrastructure.
• PII fields (name, phone, email, dietary restrictions as PHI) are masked in all intermediate system logs — agents log customer_id references, never raw PII.
• Consent gating: Data Cloud enforces consent preferences — the Customer Agent can only query profiles where the customer has opted into data sharing; a missing or revoked consent flag returns an empty profile, triggering the cold-start flow.
• GDPR/CCPA right-to-erasure: deletion requests flow through Data Cloud's deletion API; the cascade removes the record from our booking history and preference store within 30 days.
• Data minimization: the Customer Agent API call specifies exactly which fields it needs — it never pulls the full profile blob.`,
    aliases: [
      'How do you handle GDPR compliance in the system?',
      'Customer data privacy approach',
      'How is PII protected in the booking chatbot?',
      'Data privacy and regulatory compliance strategy',
    ],
  },
  {
    question: 'How does the Customer Agent communicate with other agents in the system?',
    answer: `Agents communicate via an event-driven message bus — not synchronous API calls — which enables parallelism and decoupling.
• The Customer Agent publishes a CustomerProfileResolved event to the internal bus once the profile is fetched.
• Cortex AI and the Product Agent subscribe to this event and use the profile data to filter and rank the restaurant catalog.
• Running in parallel with the Product Agent's catalog fetch: both agents are triggered simultaneously by the Conversational Agent, cutting total latency by ~1–2 seconds versus a sequential design.
• Graceful degradation: if Customer Agent times out (> 800ms), Cortex AI proceeds with a minimal profile (card tier only) and degrades personalization gracefully rather than blocking the entire flow.`,
    aliases: [
      'How do agents communicate with each other?',
      'Inter-agent communication pattern in the multi-agent system',
      'What does the Customer Agent output to other agents?',
      'Event-driven agent messaging design',
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
//  TOPIC 4: Product Agent & Knowledge Sources (6 Q&A)
// ─────────────────────────────────────────────────────────────────────────────
const TOPIC_4: QAEntry[] = [
  {
    question: 'What does the Product Agent do and which data sources does it connect to?',
    answer: `The Product Agent is responsible for querying, filtering, and ranking the restaurant catalog to produce a shortlist of recommendations.
• Queries Kontent.ai (headless CMS) for restaurant metadata: name, location, cuisine type, seating capacity, pricing tier, operating hours, and real-time availability.
• Queries SFDC Entitlement to determine which restaurants are accessible given the customer's card level — filters out venues above the customer's entitlement tier.
• Merges the customer preference profile (from Customer Agent) with the catalog data to compute per-restaurant relevance scores.
• Outputs a ranked shortlist of 3–5 restaurants to Cortex AI for final reasoning and recommendation generation.`,
    aliases: [
      'What is the Product Agent responsible for?',
      'How does the system query the restaurant catalog?',
      'What does the Product Agent output?',
      'Restaurant catalog retrieval and ranking',
    ],
  },
  {
    question: 'What is Kontent.ai and why is it used as the restaurant content store?',
    answer: `Kontent.ai is a headless CMS — it stores structured content decoupled from any rendering layer and exposes it via a delivery API.
• Restaurant entries are modeled as content items: name, description, cuisine tags, location coordinates, pricing tier, seating capacity, operating hours, and photo assets.
• Headless architecture means the same content powers the chatbot, the mobile app, and the web portal without duplication or synchronization.
• Content editors (the restaurant partnerships team) can update menus, add new partner restaurants, and adjust details without engineering involvement — critical for a large restaurant network.
• The Product Agent uses Kontent.ai's Delivery API with server-side filtering on cuisine_type, location, and entitlement_tier to reduce the candidate set before ranking.`,
    aliases: [
      'What is Kontent.ai used for in this system?',
      'Why use a headless CMS for restaurant data?',
      'What does Kontent.ai store in the booking system?',
      'Restaurant content management with Kontent.ai',
    ],
  },
  {
    question: 'How do SFDC Entitlements influence which restaurants are shown to a customer?',
    answer: `Entitlements define card-level access rights — they act as a hard gate before any recommendation ranking runs.
• Each restaurant in the catalog has an entitlement_tier field: Basic, Gold, or Platinum. The Product Agent filters out any restaurant above the customer's tier before building the shortlist.
• Entitlement also unlocks premium features for eligible restaurants: priority seating windows (first access to popular slots), complimentary welcome amenities, and waived reservation fees.
• Some restaurants are exclusively accessible via SevenRooms for Platinum cardholders — the entitlement check directly influences which booking platform is selected downstream.
• Entitlement data is fetched from SFDC in the same parallel fetch as the customer profile — no additional latency cost.`,
    aliases: [
      'How do card benefits affect restaurant recommendations?',
      'What are SFDC Entitlements in the context of booking?',
      'How does card tier influence which restaurants appear?',
      'Entitlement-based restaurant filtering logic',
    ],
  },
  {
    question: 'How is the restaurant recommendation ranking algorithm designed?',
    answer: `It is a weighted multi-factor scoring model that balances personalization, quality, and availability.
• preference_match_score (weight 0.6): cosine similarity between the customer's cuisine and dining-style preference vector and the restaurant's attribute tags.
• restaurant_rating (weight 0.2): normalized aggregate rating from partner data (e.g., OpenTable rating, internal review scores).
• entitlement_bonus (weight 0.1): Platinum-eligible restaurants get a scoring boost to surface premium options for qualifying customers.
• availability_score (weight 0.1): penalizes restaurants with very limited remaining slots in the requested time window — avoids recommending a restaurant that's likely to reject the booking.
• The shortlist of top 3–5 ranked restaurants is passed to Cortex AI, which may further refine based on LLM reasoning over the explanation.`,
    aliases: [
      'How do you rank restaurant recommendations?',
      'Restaurant recommendation scoring algorithm details',
      'What factors go into ranking restaurants for a customer?',
      'Multi-factor restaurant scoring model',
    ],
  },
  {
    question: 'How does the system keep restaurant availability data accurate and up to date?',
    answer: `We use a hybrid of real-time API calls and short-TTL caching, supplemented by webhook-based push updates.
• At query time: the Product Agent calls the OpenTable or SevenRooms availability API to get live slot data for each candidate restaurant.
• Short-TTL cache (60 seconds): availability responses are cached briefly to handle burst traffic without hammering the third-party APIs — any response older than 60 seconds triggers a fresh call.
• Webhook-based updates: OpenTable pushes cancellation and new-slot events to our system in real time, so availability state is proactively updated between scheduled refreshes.
• Staleness warning: if availability data cannot be refreshed (platform timeout), the customer is notified that "availability may have changed" before confirming their selection.`,
    aliases: [
      'How do you keep restaurant availability data fresh?',
      'Real-time availability strategy in the booking system',
      'How does the system know if a restaurant has open slots?',
      'Availability data caching and freshness',
    ],
  },
  {
    question: "What happens if no restaurants match the customer's preferences and entitlement?",
    answer: `We have a progressive relaxation strategy that widens the search iteratively rather than returning an empty result.
• First pass: strict match — cuisine type + location + entitlement tier + requested time all applied.
• If no results: relax time window by ±30 minutes and present alternative time slots for the same restaurant preferences.
• If still no results: relax cuisine type to adjacent cuisines (e.g., if Italian returns nothing, suggest Mediterranean or French).
• Final fallback: present the top 2 highest-rated available restaurants regardless of cuisine preference, clearly labeled as "outside your usual preferences, but highly rated."
• All relaxations are surfaced transparently to the customer — the system explains why it's suggesting alternatives.`,
    aliases: [
      'What if no restaurants match the customer preferences?',
      'Fallback when no recommendations are available',
      'Progressive relaxation in restaurant search',
      'Empty results handling in the recommendation engine',
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
//  TOPIC 5: Cortex AI — Orchestration & LLM Reasoning (9 Q&A)
// ─────────────────────────────────────────────────────────────────────────────
const TOPIC_5: QAEntry[] = [
  {
    question: 'What is Cortex AI and what role does it play in the system?',
    answer: `Cortex AI is the central orchestration and reasoning layer — the decision-making brain that coordinates all agents and drives the conversation forward.
• Receives inputs from the Conversational Agent (intent + entities), Customer Agent (customer profile), and Product Agent (restaurant shortlist) and synthesizes them into a coherent decision.
• Uses LLM reasoning to determine: which restaurant to recommend, how to handle edge cases (conflicting preferences, limited availability), and what to say to the customer at each step.
• Routes tasks to the appropriate sub-system: structured data queries go to Cortex Analyst, semantic search over restaurant descriptions goes to Cortex Search.
• The final booking action (calling OpenTable or SevenRooms) is also triggered and monitored by Cortex AI after customer confirmation.`,
    aliases: [
      'What is Cortex AI in the booking system?',
      'What does the central orchestrator do?',
      'What is the brain of the restaurant reservation AI?',
      'Cortex AI role in the multi-agent system',
    ],
  },
  {
    question: 'What is the difference between Cortex Analyst and Cortex Search, and when do you use each?',
    answer: `They solve different information retrieval problems: Cortex Analyst is for structured queries, Cortex Search is for unstructured semantic discovery.
• Cortex Analyst: converts natural language questions into SQL and queries structured, tabular data. Used for business analytics queries like "Which restaurants had the highest booking volume this month?" or "What is the available slot count for Restaurant X on Friday?"
• Cortex Search: semantic search over unstructured text — restaurant descriptions, reviews, and menus. Used when the customer's request is vague: "a cozy place with live music" triggers Cortex Search to find semantically relevant venues.
• They can run in parallel: a customer query might trigger Cortex Search for restaurant discovery while Cortex Analyst simultaneously checks entitlement eligibility counts.`,
    aliases: [
      'Cortex Analyst vs Cortex Search — what is the difference?',
      'When do you use semantic search vs structured SQL in Cortex?',
      'What is Cortex Analyst used for?',
      'How does Cortex Search work in the booking system?',
    ],
  },
  {
    question: 'Which Foundation Models are used in Cortex AI and how do you decide which model to invoke for a given task?',
    answer: `We use a model routing policy that matches task complexity and latency requirements to the most cost-efficient model that meets the quality bar.
• Model roster: Snowflake Arctic, Google Gemini, NVIDIA NIM models, Meta LLaMA — each with different cost, latency, and capability profiles.
• Routing rules: high-frequency, low-complexity tasks (intent classification, entity extraction) → smaller, faster models like LLaMA 3.1 8B for cost efficiency.
• Complex multi-step reasoning (synthesizing customer profile + restaurant options → personalized recommendation with explanation) → larger, more capable models like Gemini or Snowflake Arctic.
• Task-specific embed models are used for semantic similarity scoring — these are not general-purpose LLMs; they're optimized specifically for embedding quality at low latency.`,
    aliases: [
      'Which LLMs are used in the system?',
      'How do you choose which Foundation Model to call?',
      'LLM routing logic in Cortex AI',
      'Foundation model selection strategy for restaurant booking AI',
    ],
  },
  {
    question: 'How do you handle LLM hallucination in a high-stakes booking context?',
    answer: `We address hallucination at three layers: input grounding, output validation, and a mandatory human-in-the-loop confirmation step.
• Grounding: the LLM never generates facts from memory. Restaurant name, address, available time slots, and booking details are always passed as verified, structured data from the API — the LLM's job is to reason and communicate, not to recall facts.
• Structured output enforcement: LLM responses are constrained to a JSON schema. Any response that fails schema validation is rejected and retried with a clarified prompt (max 2 retries).
• Confirmation gate: before any booking action is executed, the system surfaces the LLM's proposed booking details to the customer in a clear confirmation message — the customer must explicitly confirm before any API call is made.
• Anomaly detection: if the LLM's output references a restaurant or time slot that doesn't appear in the input data, the system overrides with ground truth and logs the inconsistency for model evaluation.`,
    aliases: [
      'How do you prevent the AI from hallucinating booking details?',
      'LLM hallucination mitigation in booking systems',
      'Grounding LLM responses in verified data',
      'How do you validate LLM output before making a reservation?',
    ],
  },
  {
    question: 'How is the LLM reasoning chain structured for a typical booking request?',
    answer: `The reasoning chain has five stages that run sequentially after the parallel data-fetch completes.
• Stage 1 — Context assembly: Cortex AI assembles the full context packet: customer profile summary, ranked restaurant shortlist, current conversation history, and any special constraints.
• Stage 2 — Reasoning prompt: LLM is given the assembled context and asked to reason: "Given this customer's profile and these options, which restaurant is the best fit and why?"
• Stage 3 — Structured output: LLM returns a JSON object with recommended_restaurant, reasoning, suggested_time_slots, and suggested_response_to_customer.
• Stage 4 — Validation: output is validated against the schema and cross-checked against the available slot list from the Product Agent.
• Stage 5 — Response generation: the suggested_response_to_customer field is used to generate the natural language message presented to the customer.`,
    aliases: [
      'How is the LLM reasoning pipeline structured for booking?',
      'Walk me through the AI reasoning chain',
      'What does the LLM actually do in the booking system?',
      'LLM reasoning steps from intent to recommendation',
    ],
  },
  {
    question: 'What fine-tuned or task-specific models do you use and for which tasks?',
    answer: `We use fine-tuned models for high-frequency, domain-specific subtasks where a general foundation model would be too slow or inaccurate.
• Fine-tuned NER model: trained on a restaurant booking domain corpus to accurately extract entities like cuisine names, chain-specific restaurant names (e.g., "Nobu" as a restaurant, not a general proper noun), and complex relative time expressions.
• Fine-tuned intent classifier: reduces false positives and false negatives on booking-adjacent intents (the distinction between "book" and "recommend" is subtle and easy to misclassify).
• Task-specific embedding model: fine-tuned for semantic similarity between customer preference descriptions and restaurant attribute tags — general-purpose embeddings underperform on this domain-specific task.
• These models are 10–100x cheaper to run than full foundation models and run 5–10x faster — critical for hitting the 3-second end-to-end latency target.`,
    aliases: [
      'What models are fine-tuned for this system?',
      'Custom and task-specific models in the pipeline',
      'Fine-tuned vs foundation model usage in Cortex AI',
      'Domain-specific models in the restaurant booking AI',
    ],
  },
  {
    question: 'What is the latency budget for the system and how do you achieve it?',
    answer: `The end-to-end target is under 3 seconds for a standard booking request, achieved through parallelism, caching, and model tiering.
• Parallelism: Customer Agent and Product Agent run simultaneously after the Conversational Agent fires — this alone saves 1–2 seconds compared to sequential execution.
• Model tiering: fast, small models (LLaMA 8B) handle intent and entity extraction in ~100ms; the full reasoning LLM is only invoked once for the recommendation synthesis step.
• Embedding cache: repeated or similar queries reuse cached embedding vectors rather than recomputing from scratch — critical for the high-frequency NER/intent layer.
• Slow-path handling: complex requests (e.g., multi-course dinner with dietary restrictions for 12 people) may exceed 3 seconds; we send an interim "Searching for the best options..." message to manage UX expectations while processing.
• P95 latency is monitored per agent; alerts fire if any agent exceeds 2x its established baseline.`,
    aliases: [
      'What is the response time target for the booking system?',
      'How do you achieve low latency in the multi-agent system?',
      'Latency optimization strategy for the reservation AI',
      'Performance budget and optimization approach',
    ],
  },
  {
    question: 'How does Cortex AI handle conflicting customer preferences — for example, the customer says they hate Italian but their history shows they often visit Italian restaurants?',
    answer: `We apply a recency-weighted signal hierarchy: explicit conversational preferences override historical data; recent history outweighs older history.
• Explicit statement wins: if the customer says "no Italian tonight" in the current session, that is treated as a hard filter that overrides any historical Italian restaurant visits.
• Recency weighting in history: if the customer visited Italian restaurants 2 years ago but has exclusively visited Japanese and Thai restaurants in the last 6 months, the model weights the recent signal higher in the preference vector.
• The conflict is surfaced to the LLM reasoning step with both signals — the LLM is prompted to explain its decision, which helps the confirmation message feel transparent to the customer.
• Edge cases (e.g., customer says "surprise me") fall back to highest-rated available option within entitlement tier.`,
    aliases: [
      'How do you handle conflicting signals in customer preferences?',
      'What if the customer history contradicts what they say in chat?',
      'Preference conflict resolution in recommendation',
      'Recency weighting for customer preference signals',
    ],
  },
  {
    question: 'How does Cortex AI decide when to ask the customer a clarifying question versus when to proceed autonomously?',
    answer: `The decision is governed by a confidence threshold policy and a cost-of-error assessment.
• Threshold-based: if Cortex AI's confidence in the best restaurant recommendation is above 0.85 (based on preference match score), it proceeds autonomously and presents the recommendation.
• Below threshold: Cortex AI formulates one clarifying question to resolve the ambiguity — e.g., "Are you looking for somewhere upscale or more casual tonight?"
• Cost-of-error weighting: for decisions with high reversibility (e.g., asking for a time preference), the system proceeds with a reasonable default and gives the customer an edit option. For low-reversibility decisions (submitting the actual booking), the system always requires explicit confirmation.
• The goal is minimum interruptions to the customer while maintaining accuracy — one unnecessary clarification question is less damaging than one wrong booking.`,
    aliases: [
      'When does the AI ask for clarification versus proceeding automatically?',
      'Autonomous decision-making threshold in Cortex AI',
      'How does the system decide when to confirm with the customer?',
      'Clarification vs autonomous action decision logic',
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
//  TOPIC 6: OpenTable & SevenRooms Integration (8 Q&A)
// ─────────────────────────────────────────────────────────────────────────────
const TOPIC_6: QAEntry[] = [
  {
    question: 'How did you integrate with the OpenTable API for restaurant reservations?',
    answer: `We use the OpenTable Partner API (RESTful) with OAuth 2.0 client credentials flow for authentication.
• Availability search: POST /availability with party_size, datetime_range, and restaurant_id — returns available time slots as a structured list.
• Reservation creation: POST /reservations with customer_details, selected slot, and any special dining notes — returns a booking_id and confirmation_number.
• Modify/cancel: PUT and DELETE endpoints on the reservation resource, using the booking_id as the primary key.
• Authentication: OAuth 2.0 client credentials. Tokens are cached and proactively refreshed 5 minutes before expiry to avoid mid-flow authentication failures.`,
    aliases: [
      'How does OpenTable API integration work?',
      'OpenTable API details for restaurant booking',
      'How do you make a reservation via OpenTable?',
      'OpenTable REST API usage in the system',
    ],
  },
  {
    question: 'How does SevenRooms differ from OpenTable, and how do you manage both in the same system?',
    answer: `SevenRooms is a hospitality CRM — it manages the entire guest relationship, not just reservations, which makes its API richer but more complex than OpenTable's.
• SevenRooms goes beyond booking: it supports waitlists, VIP guest tagging, post-visit feedback collection, and guest preference notes — none of which OpenTable offers natively.
• API schema differences: SevenRooms uses a venue_id + shift_id + timeslot model; OpenTable uses restaurant_id + datetime. These schemas are fundamentally different.
• Unified Booking Adapter pattern: we built an abstract BookingAdapter interface with methods checkAvailability(), createReservation(), modifyReservation(), and cancelReservation(). Each platform has its own concrete adapter — OpenTableAdapter and SevenRoomsAdapter — that implements this interface.
• This abstraction means Cortex AI calls the same interface regardless of platform; the adapter handles all translation and protocol details.`,
    aliases: [
      'SevenRooms vs OpenTable — what are the differences?',
      'How do you abstract multiple booking platforms?',
      'SevenRooms API integration details',
      'Unified booking adapter design pattern',
    ],
  },
  {
    question: 'What is your retry and circuit breaker strategy for third-party booking API failures?',
    answer: `We use exponential backoff for transient errors and a circuit breaker for sustained outages — standard production patterns for third-party API reliability.
• Retry: up to 3 retries with exponential backoff + jitter (1s, 2s, 4s) for 5xx errors and network timeouts. Idempotency keys ensure retries are safe.
• Circuit breaker: if the error rate for a platform exceeds 20% over a 60-second window, the circuit opens. No requests are sent to that platform for 30 seconds (half-open recovery).
• During circuit open: fall back to the other platform if the restaurant supports it; otherwise surface a graceful "we're having trouble completing your booking, please try again shortly" message.
• Dead letter queue: failed booking attempts that exhaust all retries are enqueued for async retry and trigger a PagerDuty alert for on-call review.`,
    aliases: [
      'Retry logic for OpenTable and SevenRooms API calls',
      'Circuit breaker pattern in the booking integration',
      'Error handling for third-party booking API failures',
      'What happens when the booking platform API is down?',
    ],
  },
  {
    question: 'How do you ensure idempotency in booking API calls to prevent duplicate reservations?',
    answer: `Every booking API call carries an idempotency_key — a deterministic, unique identifier that allows safe retries without creating duplicates.
• Key generation: idempotency_key = UUID derived from hash(session_id + restaurant_id + requested_datetime_utc) — deterministic so retries generate the same key.
• Platform behavior: OpenTable and SevenRooms both honor idempotency keys — a second request with the same key returns the original booking response instead of creating a new reservation.
• Our own tracking layer: we store every issued idempotency_key + resulting booking_id in our database. Before retrying, we check if the key already has a successful outcome — if so, we return the stored result directly without calling the platform API.
• This prevents the worst-case scenario: customer gets charged twice or receives two confirmation emails for a single booking.`,
    aliases: [
      'Idempotency in booking API calls — how does it work?',
      'How do you prevent duplicate reservations from being created?',
      'Idempotency key strategy for restaurant booking',
      'Safe retry design for reservation API calls',
    ],
  },
  {
    question: 'How do you handle real-time availability to avoid recommending fully booked restaurants?',
    answer: `Availability is validated at query time with a short-TTL cache to balance freshness and API call volume.
• At recommendation time: Product Agent calls the availability API for each candidate restaurant — results are cached for 60 seconds.
• Check-then-book pattern: availability is re-validated immediately before the booking API call, not relying solely on the cached check from the recommendation step.
• Webhook-based proactive updates: OpenTable pushes slot cancellations and new openings to our system via webhooks, allowing us to update availability state between scheduled refreshes.
• If a recommended slot is taken between recommendation and confirmation (race condition): the system surfaces the next available slot for the same restaurant and asks the customer to confirm the alternative.`,
    aliases: [
      'How do you prevent recommending unavailable restaurants?',
      'Real-time availability validation strategy',
      'How do you handle slot conflicts in real-time booking?',
      'Availability data freshness and overbooking prevention',
    ],
  },
  {
    question: 'How does the system send booking confirmations and reminders to customers?',
    answer: `Confirmation and reminders are sent immediately post-booking and scheduled as async jobs via the original channel and email.
• Immediate confirmation: as soon as the booking API returns a confirmation_number, the Conversational Agent sends a structured confirmation message via the customer's original channel (WhatsApp, LivePerson) with: restaurant name, date, time, party size, booking ID, and a cancellation link.
• Email confirmation: triggered via Salesforce Marketing Cloud — leverages existing email infrastructure, includes a calendar invite attachment.
• Reminders: two scheduled async jobs are created at booking time — a 24-hour reminder and a 2-hour reminder, both delivered via the original channel and email.
• Cancellation: the confirmation and reminder messages include a deep link that, when tapped, calls our cancel endpoint → platform cancel API → sends cancellation confirmation.`,
    aliases: [
      'How does booking confirmation work in the system?',
      'How are reminder notifications sent to customers?',
      'Post-booking confirmation and reminder workflow',
      'Customer notification flow after a reservation is confirmed',
    ],
  },
  {
    question: 'How do you monitor third-party booking API health in production?',
    answer: `We monitor platform health at two levels: active synthetic probing and passive error rate tracking.
• Synthetic monitoring: lightweight availability check requests are sent to both OpenTable and SevenRooms every 5 minutes from a monitoring service — these measure real-world latency and detect outages before customer requests hit the problem.
• Passive monitoring: error rate, P50/P95 latency, and timeout rate are tracked per platform in real time — separate dashboards from internal agent metrics.
• Alert thresholds: PagerDuty alert fires if platform error rate exceeds 5% sustained for 3 minutes or P95 latency exceeds 3 seconds.
• Status page integration: the monitoring service queries OpenTable's and SevenRooms' public status pages programmatically — helps distinguish "our integration bug" from "their infrastructure outage" during incident triage.`,
    aliases: [
      'How do you monitor OpenTable and SevenRooms in production?',
      'Third-party API health monitoring strategy',
      'Observability for external booking APIs',
      'How do you detect when booking platforms are down?',
    ],
  },
  {
    question: 'How do you handle rate limits from OpenTable and SevenRooms?',
    answer: `We implement client-side rate limiting with request queuing to stay within platform quotas and avoid 429 errors.
• Rate limit configuration: each platform's quota is configured per environment — OpenTable typically allows X requests/second per venue; SevenRooms has per-minute and per-hour quotas.
• Token bucket implementation: a token bucket rate limiter is applied per platform adapter — requests are queued if the bucket is empty rather than immediately rejected.
• Backpressure propagation: if queue depth exceeds a threshold, the system surfaces an "our systems are a bit busy right now" interim message rather than silently failing.
• Quota headroom monitoring: we track rate limit consumption as a metric and alert when usage approaches 80% of quota — triggers a scaling review before limits are actually hit.`,
    aliases: [
      'How do you handle API rate limits from booking platforms?',
      'Rate limiting strategy for third-party booking APIs',
      'Token bucket rate limiter for OpenTable and SevenRooms',
      'How do you avoid exceeding API quotas?',
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
//  TOPIC 7: Memory Management & Session State (5 Q&A)
// ─────────────────────────────────────────────────────────────────────────────
const TOPIC_7: QAEntry[] = [
  {
    question: 'How does memory management work in the multi-agent restaurant booking system?',
    answer: `We operate a two-tier memory model: short-term session memory for active conversations and long-term preference memory in Salesforce Data Cloud.
• Short-term (in-session): current intent, filled slots, conversation history — stored in-memory in the Conversational Agent for the lifetime of the active session.
• Long-term (cross-session): customer dining preferences, dietary restrictions, past bookings — persisted in Salesforce Data Cloud, fetched at session start via the Customer Agent.
• Write-back loop: after a successful booking, new preference signals collected in the session are pushed back to Data Cloud to enrich the long-term profile.
• Agents share state via the event bus rather than direct memory access — each agent maintains its own local state and publishes structured outputs.`,
    aliases: [
      'How does memory management work in the chatbot system?',
      'Short-term vs long-term memory in the reservation AI',
      'Session state and memory design in the multi-agent system',
      'How does the chatbot remember customer preferences between sessions?',
    ],
  },
  {
    question: 'How do you manage long conversations without exceeding the LLM context window?',
    answer: `We use a combination of sliding window truncation and summarization to keep context within token limits while preserving semantic continuity.
• Sliding window: only the last 10 conversation turns are included in the LLM context — older turns are dropped.
• Summarization: dropped turns are compressed into a concise context summary ("Customer is booking Italian dinner for 4 people on Friday evening near downtown") using a lightweight LLM call. The summary is injected at the top of the context.
• Pinned facts: critical information — confirmed dietary restrictions, confirmed customer name, any explicit customer statements — are extracted and maintained as a pinned facts block that always appears in context regardless of window position.
• This approach allows arbitrarily long conversations while keeping LLM input consistently within token budget.`,
    aliases: [
      'How do you handle long conversation history for the LLM?',
      'Context window management strategy for multi-turn chat',
      'LLM context window optimization in the booking system',
      'How do you summarize long conversations for the AI?',
    ],
  },
  {
    question: 'What happens to session state if a customer switches channels mid-booking?',
    answer: `Sessions are keyed by customer_id, not channel — so a channel switch is transparent to the session state machine.
• Identity resolution: Salesforce Data Cloud's identity graph maps channel-specific IDs (WhatsApp number, LivePerson agent ID) to the canonical customer_id. The session key never changes.
• In-progress booking state: date, time, restaurant selection, and filled slots are all preserved. The customer picks up exactly where they left off on the new channel.
• Channel context adaptation: the response formatting adapter updates to match the new channel (e.g., switching from rich card format on LivePerson to plain text on WhatsApp).
• If more than 30 minutes have elapsed since the last turn on the original channel, the session is treated as a resumption (not new), and the system sends a brief recap of where the booking stood.`,
    aliases: [
      'What if a customer switches from WhatsApp to LivePerson mid-booking?',
      'Cross-channel session continuity in the chatbot',
      'How do you preserve conversation state across different channels?',
      'Channel switching and session state handling',
    ],
  },
  {
    question: 'How do you prevent session state from becoming stale or corrupted in a distributed system?',
    answer: `Session state is designed for durability and consistency — we avoid pure in-memory-only state for anything that matters.
• Each turn transition writes the updated session state to a persistent backing store (Redis or similar fast KV store) — so a node restart or crash doesn't lose an active booking.
• Optimistic concurrency: each session state write includes a version number. Concurrent writes from multiple agent nodes are detected and the stale write is rejected, preventing state corruption.
• Session TTL: sessions older than 30 minutes of inactivity are marked expired. Expired sessions trigger a graceful "Your session timed out — would you like to continue where you left off?" message on the customer's next interaction.
• State schema versioning: session state objects are versioned to handle rolling deployments where old and new code versions might read/write the same session.`,
    aliases: [
      'How do you handle session state durability in a distributed system?',
      'Preventing session state corruption in multi-agent systems',
      'State persistence strategy for the booking chatbot',
      'How do you handle node failures during an active booking session?',
    ],
  },
  {
    question: 'How does the Memory Management layer interact with the agents?',
    answer: `Memory is accessed and updated through well-defined events, not shared mutable state — each agent owns its memory slice.
• Session start: Conversational Agent reads long-term customer profile from Data Cloud via Customer Agent at session initialization.
• Within session: Conversational Agent maintains a local session context object — other agents receive relevant slices via events (e.g., Customer Agent gets customer_id, Product Agent gets preference_vector).
• Post-session: Cortex AI triggers a WriteBackEvent at booking confirmation — this carries new preference signals and the booking record to be persisted to Data Cloud.
• Audit trail: every memory read and write is logged with a timestamp and agent identifier — useful for debugging personalization issues and for GDPR audit trails.`,
    aliases: [
      'How do agents interact with the memory layer?',
      'Memory access patterns across agents in the system',
      'How is customer data shared between agents?',
      'Agent memory read and write design',
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
//  TOPIC 8: Monitoring, Analytics & Business Metrics (6 Q&A)
// ─────────────────────────────────────────────────────────────────────────────
const TOPIC_8: QAEntry[] = [
  {
    question: 'How do you track and measure conversion rates for the booking system?',
    answer: `We instrument the full booking funnel as a series of discrete events and compute drop-off rates at each stage.
• Funnel stages tracked: intent_detected → slots_filled → recommendation_presented → customer_confirmed → booking_attempted → booking_confirmed.
• Drop-off analysis per stage: high drop-off at recommendation_presented signals the recommendations aren't resonating; high drop-off at booking_confirmed suggests third-party API issues.
• North-star metric: end-to-end conversion rate (intent_detected → booking_confirmed). Target is 85%+ vs. ~40% for the previous manual process.
• A/B testing: different recommendation ranking weight combinations are tested on traffic splits; booking completion rate determines the winner.`,
    aliases: [
      'How do you measure booking conversion rates?',
      'Booking funnel analytics and measurement',
      'How do you track success rates for the reservation AI?',
      'Conversion rate optimization strategy for the chatbot',
    ],
  },
  {
    question: 'How do you monitor the multi-agent system in production?',
    answer: `We use distributed tracing as the backbone of observability, combined with per-agent and per-platform metric dashboards.
• Distributed tracing: every incoming customer request generates a trace_id that propagates through every agent call — visible in Jaeger or Datadog, showing the full execution timeline per request.
• Per-agent latency: P50, P95, P99 latency histograms for each agent — identifies which agent is the bottleneck in slow requests.
• Error rate dashboards: error rates per agent and per third-party platform (OpenTable, SevenRooms) — tracked separately to distinguish internal issues from external platform problems.
• LLM-specific metrics: token usage per request, model selection distribution, prompt/completion token ratio — used for cost monitoring and optimization.`,
    aliases: [
      'How do you monitor the multi-agent system in production?',
      'Observability strategy for the restaurant reservation AI',
      'What metrics do you track for the booking system?',
      'Production monitoring approach for multi-agent AI',
    ],
  },
  {
    question: 'How do you test and validate LLM responses before deploying model changes?',
    answer: `We use a multi-layer LLM evaluation pipeline that combines automated regression testing, LLM-as-judge scoring, and shadow mode production validation.
• Regression dataset: ~200 representative booking conversations with expected output — run against every model change as a CI check. Any regression in accuracy or format triggers a build failure.
• LLM-as-judge: a separate evaluation model (typically a larger, more capable model) scores each candidate response on: factual correctness, recommendation quality, and response naturalness — quantified as a composite score.
• Shadow mode: new model versions run in shadow mode alongside production — they receive the same inputs and generate responses, but responses are only logged, not served to customers. Shadow scores are compared to production before promotion.
• Golden examples: a set of ~20 critical-path responses (e.g., confirmation messages, allergy warning handling) are pinned and tested with exact match — these never regress.`,
    aliases: [
      'How do you evaluate LLM response quality before deployment?',
      'LLM testing and validation strategy',
      'How do you validate AI output before going live?',
      'A/B testing and shadow mode for LLM models',
    ],
  },
  {
    question: 'What is your incident response plan if the AI starts producing incorrect recommendations or bookings?',
    answer: `We have a layered safety net: a customer confirmation gate, feature flags for rapid disable, and model version rollback in under 5 minutes.
• Safety valve — customer confirmation: every booking requires explicit customer confirmation before any API call is made. This gate catches LLM errors before they cause real-world harm.
• Feature flag: LLM reasoning in Cortex AI can be disabled per-agent or globally via a feature flag — the system falls back to a deterministic rule-based recommendation engine (top-rated available restaurant within entitlement tier).
• Model rollback: every deployed model version is tagged and pinned. A bad model update is rolled back by changing a single config value — effective in under 5 minutes without a code deployment.
• Incident classification: a confirmed booking error (wrong restaurant, wrong time, wrong party size) is Severity 1 — auto-pages on-call, triggers automatic rollback evaluation, and initiates a customer remediation workflow (cancellation + rebooking offer).`,
    aliases: [
      'What is the rollback plan for bad AI recommendations?',
      'Incident response for AI errors in production',
      'How do you handle wrong recommendations from the AI?',
      'Safety mechanisms and rollback strategy for the booking AI',
    ],
  },
  {
    question: 'How do you optimize LLM costs in a high-volume booking system?',
    answer: `Cost optimization happens at three levels: model tiering, prompt engineering, and caching.
• Model tiering: route tasks to the cheapest model that meets quality requirements. Intent classification uses a fine-tuned small model (8B params) — 100x cheaper than calling a full GPT-4 class model for each turn.
• Prompt compression: system prompts are written to be as concise as possible without losing instruction clarity. Shorter prompts = fewer input tokens = lower cost per call.
• Embedding caching: frequently seen query phrases (e.g., "book a table", "cancel my reservation") have their embeddings cached — eliminating redundant embedding API calls for identical or near-identical inputs.
• Batch processing: non-real-time tasks (e.g., generating reminder messages, post-session profile updates) are batched and processed off-peak to take advantage of lower per-token rates.`,
    aliases: [
      'How do you control LLM costs in production?',
      'Cost optimization strategy for LLM usage',
      'How do you reduce the cost of running the AI system?',
      'LLM cost management in the booking platform',
    ],
  },
  {
    question: 'How do you run A/B experiments on the AI recommendation system?',
    answer: `We use a traffic-split experiment framework where each variant is a different configuration of the recommendation ranking weights or model selection policy.
• Experiment design: define hypothesis (e.g., "increasing preference_match weight from 0.6 to 0.7 improves conversion"), define variants (control vs treatment), set traffic split (90/10 initially to limit risk).
• Assignment: customers are assigned to variants deterministically based on a hash of customer_id — same customer always sees the same variant, ensuring consistent experience and avoiding novelty effects.
• Metric collection: booking conversion rate, recommendation click-through rate, and session completion rate are the primary metrics. Collected for each variant separately.
• Statistical significance gate: variants only graduate to 50/50 traffic once they reach statistical significance (p < 0.05) with sufficient sample size.
• Guardrail metrics: customer satisfaction score and escalation rate are monitored as guardrails — an experiment is automatically rolled back if either guardrail degrades by more than 5%.`,
    aliases: [
      'How do you run A/B tests on the recommendation system?',
      'A/B experiment design for the booking AI',
      'How do you test different recommendation strategies?',
      'Experiment framework for the restaurant reservation AI',
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
]

// ─────────────────────────────────────────────────────────────────────────────
//  SEED RUNNER
// ─────────────────────────────────────────────────────────────────────────────
async function seed() {
  console.log(`\n🚀 Starting Restaurant Reservation AI knowledge seed`)
  console.log(`   Total Q&A entries: ${ALL_QA.length}\n`)

  const stats = { inserted: 0, updated: 0, blocked: 0, error: 0 }

  for (let i = 0; i < ALL_QA.length; i++) {
    const entry = ALL_QA[i]
    const prefix = `[${String(i + 1).padStart(2, '0')}/${ALL_QA.length}]`

    try {
      const result = await upsertQA(entry.question, entry.answer, entry.aliases)
      stats[result.status === 'inserted' ? 'inserted' :
             result.status === 'updated' ? 'updated' : 'blocked']++

      const icon = result.status === 'inserted' ? '✅' : result.status === 'updated' ? '🔄' : '⏭️'
      console.log(`${prefix} ${icon} [${result.status}] ${entry.question.substring(0, 70)}...`)
    } catch (err) {
      stats.error++
      console.error(`${prefix} ❌ ERROR: ${entry.question.substring(0, 60)}`)
      console.error(`        ${err}`)
    }
  }

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`✅  Inserted (new):     ${stats.inserted}`)
  console.log(`🔄  Updated (dedupe):   ${stats.updated}`)
  console.log(`⏭️  Blocked (duplicate): ${stats.blocked}`)
  console.log(`❌  Errors:             ${stats.error}`)
  console.log(`${'─'.repeat(60)}`)
  console.log(`📦  Total processed:   ${ALL_QA.length}`)
  console.log(`\n🎉 Seed complete! memory.db is ready.\n`)

  process.exit(0)
}

seed().catch((err) => {
  console.error('Fatal seed error:', err)
  process.exit(1)
})
