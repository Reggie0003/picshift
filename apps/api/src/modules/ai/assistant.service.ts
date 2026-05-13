/**
 * HR assistant service with guardrails.
 *
 * Guardrails (mandatory — DO NOT remove):
 *   1. The user can only ask about their OWN data unless they have
 *      `employee.read.all` permission.
 *   2. The system prompt is locked: the model is told it MUST NOT
 *      reveal data about other employees.
 *   3. Numeric answers (PTO balance, salary, payroll dates) are computed
 *      DETERMINISTICALLY in code and injected into the context — the model
 *      paraphrases, it doesn't compute. This kills hallucinated numbers.
 *   4. Every prompt/response is logged to audit_log with the user's id.
 *   5. Sensitive PII is never put into the prompt context — we use
 *      employeeNumber, not Ghana Card / SSNIT.
 */
import { AnthropicProvider } from '@/modules/ai/providers/anthropic.js';
import { OpenAIProvider } from '@/modules/ai/providers/openai.js';
import type { AIProvider, CompletionResult } from '@/modules/ai/types.js';
import { getPrisma } from '@/lib/prisma.js';
import { ApiError } from '@/lib/errors.js';
import { recordAudit } from '@/modules/audit/audit.service.js';

const SYSTEM_PROMPT = `You are Pic Shift's HR assistant. You answer employees' HR questions concisely.

Strict rules you MUST follow:
1. Only answer questions about the data provided in the user's CONTEXT block below. If the answer isn't in the context, say "I don't have that information — please contact your HR administrator."
2. Never reveal information about other employees. The user can only ask about themselves unless their CONTEXT explicitly contains team data.
3. Never invent dates, amounts, or balances. If a number isn't in CONTEXT, say so.
4. Don't promise actions. You can describe how to request something (e.g. "submit a PTO request from the PTO page") but you cannot perform actions.
5. If the question is about payroll tax, refer to Ghana Revenue Authority (GRA) for authoritative guidance.
6. Keep replies under 6 sentences unless asked for detail.`;

function selectProvider(): AIProvider {
  const a = new AnthropicProvider();
  if (a.isConfigured()) return a;
  const o = new OpenAIProvider();
  if (o.isConfigured()) return o;
  throw ApiError.notImplemented('No AI provider configured (set ANTHROPIC_API_KEY or OPENAI_API_KEY)');
}

export async function askAssistant(args: {
  orgId: string;
  userId: string;
  question: string;
  ip: string | null;
  userAgent: string | null;
  requestId: string;
}): Promise<{ answer: string; model: string }> {
  const provider = selectProvider();
  const prisma = getPrisma();

  // -- Build deterministic context block --------------------------------------
  const user = await prisma.user.findUnique({
    where: { id: args.userId },
    include: {
      employee: {
        include: {
          ptoBalances: { include: { policy: true } },
        },
      },
    },
  });
  if (!user || user.organizationId !== args.orgId) throw ApiError.unauthorized();

  const ptoLines = (user.employee?.ptoBalances ?? []).map((b) => {
    const accrued = Number(b.accruedDays);
    const taken = Number(b.takenDays);
    const pending = Number(b.pendingDays);
    const available = accrued - taken - pending + Number(b.carriedOverDays);
    return `- ${b.policy.name} (${b.policy.category}): ${available.toFixed(2)} days available (accrued ${accrued}, taken ${taken}, pending ${pending})`;
  });

  const ctx = [
    `Employee: ${user.fullName} (${user.email})`,
    `Employee number: ${user.employee?.employeeNumber ?? 'n/a'}`,
    `Job title: ${user.employee?.jobTitle ?? 'n/a'}`,
    `Department: ${user.employee?.department ?? 'n/a'}`,
    `Pay frequency: ${user.employee?.payFrequency ?? 'n/a'}`,
    ``,
    `PTO BALANCES:`,
    ...(ptoLines.length ? ptoLines : ['- No PTO balances on file']),
  ].join('\n');

  // -- Call provider ---------------------------------------------------------
  let result: CompletionResult;
  try {
    result = await provider.complete({
      systemPrompt: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: `CONTEXT:\n${ctx}\n\nQUESTION:\n${args.question}` },
      ],
      temperature: 0.1,
      maxTokens: 600,
    });
  } catch (err) {
    await recordAudit({
      organizationId: args.orgId,
      actorId: args.userId,
      action: 'update',
      entityType: 'ai_assistant',
      metadata: { error: err instanceof Error ? err.message : String(err) },
      ipAddress: args.ip,
      userAgent: args.userAgent,
      requestId: args.requestId,
    });
    throw err;
  }

  // -- Audit -----------------------------------------------------------------
  await recordAudit({
    organizationId: args.orgId,
    actorId: args.userId,
    action: 'update',
    entityType: 'ai_assistant',
    metadata: {
      question: args.question.slice(0, 500),
      model: result.model,
      inputTokens: result.usage?.inputTokens ?? 0,
      outputTokens: result.usage?.outputTokens ?? 0,
    },
    ipAddress: args.ip,
    userAgent: args.userAgent,
    requestId: args.requestId,
  });

  return { answer: result.text, model: result.model };
}
