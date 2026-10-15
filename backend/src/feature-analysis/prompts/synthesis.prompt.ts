interface SynthesisContext {
  founderProfile: {
    appName: string;
    appDescription: string;
    targetMarket: string;
    currentMRR: number;
    stage: string;
    fundingGoal: number;
  };
  investorPipeline: {
    name: string | null;
    firm: string | null;
    status: string;
    portfolioFocus: string[];
    recentInvestments: string[];
  }[];
  priorFeatureDecisions: {
    feature: string;
    verdict: string;
    outcome?: string;
  }[];
}

export function buildSynthesisPrompt(ctx: SynthesisContext): string {
  const pipeline = ctx.investorPipeline
    .map(
      (i) =>
        `- ${i.name ?? 'Unknown'} @ ${i.firm ?? 'Unknown fund'} [${i.status}] | Focus: ${
          i.portfolioFocus.length > 0 ? i.portfolioFocus.join(', ') : 'not specified'
        } | Recent investments: ${
          i.recentInvestments.length > 0 ? i.recentInvestments.join(', ') : 'none on record'
        }`,
    )
    .join('\n');

  const priorDecisions = ctx.priorFeatureDecisions
    .slice(0, 5)
    .map(
      (d) =>
        `- "${d.feature}" → ${d.verdict}${d.outcome ? ` (outcome: ${d.outcome})` : ''}`,
    )
    .join('\n');

  return `
You are a senior product strategist and fundraising advisor embedded with an early-stage startup founder.
Your job is to analyze a proposed feature in the full context of this specific founder's business.
Give zero generic advice. Every sentence must be calibrated to their actual MRR, stage, and pipeline.

━━━ FOUNDER CONTEXT ━━━
App: ${ctx.founderProfile.appName}
Description: ${ctx.founderProfile.appDescription}
Target Market: ${ctx.founderProfile.targetMarket}
Current MRR: $${ctx.founderProfile.currentMRR.toLocaleString()}
Stage: ${ctx.founderProfile.stage}
Fundraising Goal: $${ctx.founderProfile.fundingGoal.toLocaleString()}

━━━ INVESTOR PIPELINE (${ctx.investorPipeline.length} investors) ━━━
${pipeline || 'No investors in pipeline yet.'}

━━━ PRIOR FEATURE DECISIONS ━━━
${priorDecisions || 'No prior feature analyses on record.'}

━━━ YOUR OUTPUT ━━━
Respond with raw JSON ONLY. No markdown fences. No preamble. No trailing text.
The JSON must match this schema exactly:
{
  "verdict": "build" | "defer" | "kill" | "needs-validation",
  "verdictReasoning": "string — 2-4 sentences specific to this founder's situation",
  "revenueImpact": {
    "low": number,
    "high": number,
    "currency": "USD",
    "unit": "MRR"
  },
  "investorAlignmentScore": number (0-100),
  "alignedInvestors": [
    { "name": "string", "firm": "string", "reason": "string — why this feature maps to their thesis" }
  ],
  "marketPrecedents": [
    { "product": "string", "outcome": "string", "relevance": "string — why this matters for the founder" }
  ],
  "recommendations": [
    { "priority": number, "action": "string", "rationale": "string" }
  ]
}
`.trim();
}
