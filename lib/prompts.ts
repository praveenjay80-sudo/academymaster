export function themesPrompt(domain: string, field: string) {
  return `Generate a comprehensive set of themes for the field of "${field}" (within "${domain}"), grouped by the BIG QUESTIONS the field is trying to answer.

Step 1: Identify 5-8 fundamental questions that define ${field} as an intellectual pursuit. These should be the deep, sometimes unanswerable questions that drive scholars in this field — questions that feel genuinely important to anyone curious about the world.

Good big-question examples from Mathematics: "What is a number, really?", "What can be proven — and what lies beyond proof?", "Why does abstract mathematics describe the physical world?"
Good big-question examples from Philosophy: "What can we know, and how do we know it?", "What makes an action right or wrong?", "What is the nature of mind and consciousness?"

Step 2: For each big question, generate 4-6 themes — specific ideas, tensions, or discoveries that belong under that question.

Output each theme as ONE JSON object per line (NDJSON):
{"id":"kebab-case-slug","name":"Theme Name (4-8 words)","description":"2-3 plain-English sentences for a curious non-expert. What is the central idea? Why does it matter? Make it vivid and concrete.","big_question":"The full big question this theme belongs to"}

Rules:
- NDJSON: one complete object per line, no array brackets, no commas between objects
- Output all themes for one big question before moving to the next
- Big questions should be genuine intellectual questions, not category labels — they should end with a question mark
- Descriptions must be jargon-free and concrete — write for a curious, intelligent non-expert
- Aim for ~35-45 themes total
- Cover the full range of ${field} — from foundational to frontier

Domain: ${domain}
Field: ${field}`;
}

export function conceptsListPrompt(topic: string) {
  return `Generate a complete list of ALL core concepts someone must master to truly understand "${topic}".

For each concept, provide:
1. The concept name
2. A one-sentence plain-English description (what is it, in simple terms?)
3. Difficulty level: FOUNDATIONAL | INTERMEDIATE | ADVANCED
4. Prerequisites: list the concept IDs that must be understood BEFORE this one
5. What this concept unlocks: which other concept IDs become accessible after mastering this one
6. A broad category this concept belongs to

Order them from simplest to most complex.

OUTPUT FORMAT — CRITICAL:
Output each concept as a separate JSON object on its own line (NDJSON format).
Do NOT wrap in array brackets [ ].
Do NOT put commas between objects.
Output exactly one complete JSON object per line, nothing else before or after.

Example of correct output format:
{"id":"basic-idea","name":"Basic Idea","description":"The simplest starting point — explain it like the reader has never heard of this field.","difficulty":"FOUNDATIONAL","prerequisites":[],"unlocks":["next-concept"],"category":"Foundations","key_works":["Work Title A","Work Title B"]}
{"id":"next-concept","name":"Next Concept","description":"Builds on basic-idea — still explained simply.","difficulty":"INTERMEDIATE","prerequisites":["basic-idea"],"unlocks":[],"category":"Core Ideas","key_works":["Work Title B"]}

key_works: array of 1-3 short titles of canonical works (books or papers) that best explain this concept. Use the actual work titles from the topic's reading list.

Topic: ${topic}

Output ONLY the NDJSON lines. No markdown, no array brackets, no explanation.`;
}

export function conceptDeepDivePrompt(topic: string, concept: string, prerequisites: string[]) {
  return `Give a COMPLETE deep-dive explanation of the concept "${concept}" within the field of "${topic}".

Write for a complete beginner who has never heard of this before. They understand: ${prerequisites.length ? prerequisites.join(', ') : 'nothing yet about this topic'}.

Cover ALL of these sections:

## What Is It? (Plain English)
Explain what "${concept}" is in the simplest possible terms. Use an everyday analogy.

## Why Does It Matter?
What problem does this concept solve? Why did people invent/discover it? What would be impossible to understand without it?

## The Core Idea (Step by Step)
Walk through the concept step by step as if teaching it for the first time. Build from the ground up.

## A Concrete Example
Give a real, detailed example that makes the concept tangible. Walk through it slowly.

## Common Misconceptions
What do beginners almost always get wrong about this? Why are those mistakes understandable, and what's the correct way to think about it?

## The Notation (if applicable)
What symbols or notation are used? What does each symbol mean in plain English?

## How It Connects
- What concepts must you understand BEFORE this one, and why?
- What concepts does understanding THIS ONE unlock?
- Are there surprising connections to everyday life or other fields?

## Self-Test Questions
5 questions to check if you truly understand this. Start easy, get harder. Give answers too.

## The One-Line Summary
If you had to explain this concept to a friend in one sentence, what would you say?

Field: ${topic}
Concept: ${concept}`;
}

export function worksPrompt(topic: string) {
  return `List ALL essential works (books, papers, and textbooks) that someone must engage with to master "${topic}".

For each essential work, output ONE JSON object per line with this exact shape:
{"_type":"essential","id":"unique-slug","title":"Full Title","authors":["Author Name"],"year":1990,"type":"TEXTBOOK","difficulty":"BEGINNER","plain_description":"What this book is about in one paragraph, written for a beginner.","why_it_matters":"Why this specific work is important to the field.","prerequisites":"What you need to know before reading this, in plain English.","what_you_gain":"What you can do/understand after reading this.","free_access":"arXiv link or Not freely available or Check library","best_edition":"Which edition/version to get"}

Then for each anti-library entry (works beginners reach for too early), output ONE JSON object per line:
{"_type":"anti_library","title":"Title","reason":"Why beginners reach for this but shouldn't yet"}

Rules:
- type field must be one of: TEXTBOOK | SEMINAL_PAPER | POPULAR_SCIENCE | SURVEY | CLASSIC_ORIGINAL
- difficulty field must be one of: BEGINNER | INTERMEDIATE | ADVANCED
- Output each object on its own single line — NO line breaks inside objects
- No array brackets, no commas between objects, no markdown, no explanation
- Output essential works first (ordered beginner to advanced), then anti_library entries at the end

Topic: ${topic}`;
}

export function workChaptersPrompt(topic: string, workTitle: string, workAuthors: string, workType: string) {
  return `Give a COMPLETE chapter-by-chapter breakdown of "${workTitle}" by ${workAuthors}, in the context of studying "${topic}".

For EACH chapter or major section:

## Chapter [N]: [Title]
**What this chapter is about (plain English):** Explain what the chapter covers as if talking to a beginner. What is the central idea or argument?

**Key concepts introduced:** What new ideas, terms, or tools does this chapter introduce? Define each one briefly.

**Key results or arguments:** What does the chapter prove, argue, or demonstrate? What is the takeaway?

**How hard is this chapter?** Rate it: EASY | MODERATE | CHALLENGING | VERY_HARD and explain why.

**Estimated reading time:** How long should a careful beginner expect this chapter to take?

**What to do:** Should they READ_CAREFULLY | SKIM | SKIP_FIRST_PASS and why?

**Exercises:** Are there exercises? Are they worth doing? Which ones are most important?

After all chapters, add:

## Overall Reading Strategy
How should a complete beginner approach this book? What's the best way through it?

## What You Know After Finishing
In plain English: what will you be able to understand or do that you couldn't before?

## Connections to Other Works
Which other books should you read before/after/alongside this one?

Note: If you are uncertain about specific chapter contents, say "AI-estimated based on the work's subject matter" rather than stating uncertain details as facts.

Topic: ${topic}
Work: ${workTitle} (${workType})`;
}

export function roadmapPrompt(topic: string) {
  return `Design a complete learning roadmap for mastering "${topic}" from absolute zero to advanced understanding.

Create THREE tracks:

## CASUAL TRACK (1-2 weeks, 1-2 hours/day)
For someone who wants a solid understanding without going too deep.
- What to read and in what order
- What to skip
- What you'll understand at the end

## SERIOUS TRACK (1-3 months, 1-2 hours/day)
For someone who wants genuine competence in the subject.
- Full concept sequence
- Essential works in order
- Milestones and checkpoints
- What you'll be able to do at the end

## RESEARCHER TRACK (6+ months)
For someone who wants to reach the frontier of the field.
- Complete canon
- Specialisation branches
- How to find current research
- What you'll be able to contribute at the end

For each track, format as:
### Phase N: [Phase Name]
**Duration:** X weeks
**Goal:** What you're trying to achieve in this phase (plain English)
**Concepts to master:** List of concepts
**Works to read:** List of specific books/papers with the specific chapters if relevant
**Milestone:** How to know you've completed this phase — what should you be able to do or explain?

Also include:
## Prerequisites
What someone must know BEFORE starting this topic at all (and what to do if they don't know it yet)

## Common Mistakes in Learning This Topic
What do people typically get wrong when they try to learn this? How to avoid those mistakes?

Topic: ${topic}`;
}

export function bigPicturePrompt(topic: string) {
  return `Give a rich, detailed "big picture" view of "${topic}" for a complete beginner.

## The Story of How This Field Came to Be
Tell the historical narrative of how this field developed. Who were the key thinkers? What problems were they trying to solve? What were the big breakthroughs? Write it as a story, not a list of dates. Explain why events happened in the order they did.

## The People Who Built This Field
For each major figure:
- Who were they?
- What specific problem were they working on?
- What did they contribute, in plain English?
- Why does their contribution still matter today?

## The Big Questions This Field Tries to Answer
What are the fundamental questions that motivate this entire field? Why do humans care about these questions? What would answering them mean for the world?

## What's Still Unsolved
What are the major open questions — things experts are still actively debating or researching? Why are they hard? What progress has been made?

## Major Debates and Controversies
What do experts in this field disagree about? What are the different camps and what does each believe? (Explain both sides fairly)

## Connections to Other Fields
How does this field connect to other academic disciplines? Are there surprising links? What can other fields learn from this one, and vice versa?

## Real-World Applications
How does this field matter outside of academia? What technologies, policies, or human achievements depend on understanding this topic?

## The Theoretical Minimum
If someone could only learn 5 things about this field, what would they absolutely need to understand? (The irreducible core)

## A Surprising Fact
What is the most counterintuitive or surprising thing about this field that most outsiders would never guess?

Topic: ${topic}`;
}

export function practicePrompt(topic: string) {
  return `Design a complete active-learning and practice programme for someone studying "${topic}" from scratch.

## Canonical Exercises
List the specific, named problem sets and exercises that are universally recognised in this field as the best way to build understanding. For each:
- What it is
- Why this specific exercise builds intuition
- Where to find it
- How hard it is
- What to do if you get stuck

## Mastery Quiz
Write 20 questions that test genuine understanding of ${topic} (not just memorisation).
- Start with 5 BEGINNER questions
- Then 5 INTERMEDIATE questions
- Then 5 ADVANCED questions
- Then 5 SYNTHESIS questions (connecting multiple concepts)

For each question: give the question, then the answer, then an explanation of why that answer is correct.

## Common Misconceptions to Test Yourself On
Write 10 "true or false" statements where the correct answer might surprise a beginner. For each:
- The statement
- Whether it's true or false
- A clear explanation of why

## The Feynman Technique Prompts
Give 8 specific prompts for practicing the Feynman technique (explaining things in simple terms):
- Choose concepts that are commonly misunderstood
- Each prompt should ask the learner to explain something as if to a 10-year-old

## Debate Prompts
Give 3 genuine controversies in this field where reasonable experts disagree. For each:
- State the controversy clearly
- Give the strongest argument FOR one position
- Give the strongest argument FOR the other position
- What evidence would settle the debate?

Topic: ${topic}`;
}

export function discoverPrompt(topic: string) {
  return `Help someone who has been studying "${topic}" discover what to explore next and how their knowledge connects to the broader world of ideas.

## Adjacent Topics to Explore Next
For each adjacent field:
- What is it? (plain English)
- How does it connect to ${topic}?
- What specific knowledge from ${topic} is most useful there?
- Where to start if you want to explore it

## Surprising Connections to Distant Fields
What are the most non-obvious, surprising connections between ${topic} and completely different disciplines? For each connection:
- What is the distant field?
- What is the specific surprising link?
- Why is this connection useful or interesting?

## The Bigger Questions This Topic Points To
Now that someone understands ${topic}, what deeper philosophical, scientific, or practical questions should they be asking? What rabbit holes does mastery of this subject open up?

## Cross-Disciplinary Applications
How do insights from ${topic} get applied in unexpected places? Give specific, concrete examples.

## If You Liked This, You'll Love...
Based on what makes ${topic} interesting, what other topics tend to appeal to people who love this one? And why?

## Reading Beyond the Canon
What unconventional, underrated, or overlooked works expand understanding of ${topic} in interesting ways?

Topic: ${topic}`;
}
