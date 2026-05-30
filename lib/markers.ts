// Markers — sentiment and statement detection across user prompts.
//
// Five categories, each with curated regexes:
//
//   frustration   😤   cursing, hostility, "doesn't work"
//   confusion     🤔   questioning, "what?", "I don't understand"
//   breakthrough  💡   "got it", "that works", "finally"
//   celebration   🎉   "amazing", "beautiful", "love it"
//   regret        😬   "actually no", "scratch that", "wait, wrong"
//
// All matching is conservative — word-bounded curses, specific phrases for
// the non-curse categories. False positives are minimized at the cost of
// missing softer signal.

export type MarkerCategory =
  | "frustration"
  | "confusion"
  | "breakthrough"
  | "celebration"
  | "regret"
  | "decision"
  | "redirect"
  | "gratitude";

export const MARKER_META: Record<
  MarkerCategory,
  { label: string; emoji: string; description: string }
> = {
  frustration: {
    label: "frustration",
    emoji: "😤",
    description: "Cursing, anger, doesn't-work moments",
  },
  confusion: {
    label: "confusion",
    emoji: "🤔",
    description: "Questioning, hold-on, don't-understand moments",
  },
  breakthrough: {
    label: "breakthrough",
    emoji: "💡",
    description: "Got-it, finally, that-works moments",
  },
  celebration: {
    label: "celebration",
    emoji: "🎉",
    description: "Amazing, beautiful, love-it moments",
  },
  regret: {
    label: "regret",
    emoji: "😬",
    description: "Actually-no, scratch-that, revert moments",
  },
  decision: {
    label: "decision",
    emoji: "⚡",
    description: "Let's-go-with, ship-it, commit moments",
  },
  redirect: {
    label: "redirect",
    emoji: "🔀",
    description: "Pivot, change-direction, different-approach moments",
  },
  gratitude: {
    label: "gratitude",
    emoji: "🙏",
    description: "Thanks, appreciate, nice-work moments",
  },
};

// --- Curated regex sets per category. ---

const FRUSTRATION_REGEXES: RegExp[] = [
  /\b(fuck(ing|ed|er|s)?|shit(ty|s)?|damn(ed|it)?|bullshit|crap(py)?|asshole|bitch(es|ing)?|wtf|ffs|fml|ugh+|argh+|grr+|jeez|christ)\b/gi,
  /\b(stupid|broken|infuriating|maddening|frustrating|terrible|awful|garbage)\b/gi,
  /\bdoesn['’]?t work\b/gi,
  /\bwhy (doesn['’]?t|isn['’]?t|don['’]?t|aren['’]?t)\b/gi,
  /\bstop doing\b/gi,
  /\bthis is (broken|wrong|terrible|awful)\b/gi,
  /\bi hate\b/gi,
  /\byou keep (doing|making)\b/gi,
  /\bthat['’]?s not what\b/gi,
  /\bno no no\b/gi,
  /\bnot again\b/gi,
  /\bgive me a break\b/gi,
  /\bare you kidding\b/gi,
  /\bcome on\b/gi,
];

const CONFUSION_REGEXES: RegExp[] = [
  /\b(huh|wat)\?/gi,
  /\bwait,? what\b/gi,
  /\bwhat\?\?+/gi,
  /\bi (don['’]?t|do not) (understand|get it|follow)\b/gi,
  /\bi['’]?m (confused|lost)\b/gi,
  /\bwhat does (that|this) mean\b/gi,
  /\bhold on\b/gi,
  /\bwait,?\b/gi,
  /\bhmm+\b/gi,
  /\bexplain (this|that)\b/gi,
  /\bhow (does|did) (that|this|it)\b/gi,
  /\bwhich (one|do you mean|version)\b/gi,
  /\b(im|i['’]?m) not sure (what|how|why)\b/gi,
];

const BREAKTHROUGH_REGEXES: RegExp[] = [
  /\b(finally|aha|eureka)\b/gi,
  /\bgot it\b/gi,
  /\bthat (works|did it)\b/gi,
  /\bnailed it\b/gi,
  /\bthere we go\b/gi,
  /\bthat['’]?s it\b/gi,
  /\bperfect\b/gi,
  /\bexactly\b/gi,
  /\bwe['’]?re good\b/gi,
  /\bthat fixed it\b/gi,
  /\bthat solved it\b/gi,
  /\bnow i (get it|see)\b/gi,
];

const CELEBRATION_REGEXES: RegExp[] = [
  /\b(amazing|beautiful|incredible|fantastic|brilliant)\b/gi,
  /\blove (this|it|that)\b/gi,
  /\bthis is (amazing|beautiful|great|incredible|fantastic|brilliant)\b/gi,
  /\bwell done\b/gi,
  /\b(awesome|fire|sick|clean)\b/gi,
  /\blooks (great|amazing|perfect|clean|sharp)\b/gi,
  /\bnice (work|job)\b/gi,
  /\byes+!+/gi,
];

const REGRET_REGEXES: RegExp[] = [
  /\bactually,? no\b/gi,
  /\bscratch that\b/gi,
  /\bwait,? (that['’]?s )?wrong\b/gi,
  /\blet me revert\b/gi,
  /\bnever ?mind\b/gi,
  /\bmy bad\b/gi,
  /\bsorry,? (i|that)\b/gi,
  /\b(undo|revert) (that|this|it)\b/gi,
  /\bgo back\b/gi,
  /\bshouldn['’]?t have\b/gi,
  /\bthat was (a mistake|wrong)\b/gi,
  /\blet['’]?s try (again|a different|something else)\b/gi,
];

const DECISION_REGEXES: RegExp[] = [
  /\blet['’]?s go with\b/gi,
  /\bgoing with\b/gi,
  /\bi['’]?(ve|m| have) decid(ed|ing)\b/gi,
  /\bthe (call|move|decision) is\b/gi,
  /\bship it\b/gi,
  /\blet['’]?s ship\b/gi,
  /\bwe['’]?ll (do|go with|use|pick)\b/gi,
  /\bdecision:?\b/gi,
  /\blet['’]?s commit\b/gi,
  /\bcommit(ting)? to\b/gi,
  /\blet['’]?s do (it|that|this)\b/gi,
  /\bok(ay)?,? let['’]?s\b/gi,
  /\bgo with (option )?[a-z]\b/gi,
];

const REDIRECT_REGEXES: RegExp[] = [
  /\blet['’]?s pivot\b/gi,
  /\bactually,? let['’]?s\b/gi,
  /\bchange (of )?direction\b/gi,
  /\bdifferent approach\b/gi,
  /\binstead,? let['’]?s\b/gi,
  /\blet['’]?s switch\b/gi,
  /\bnew direction\b/gi,
  /\bforget (that|this|it)\b/gi,
  /\bnew plan\b/gi,
  /\bchange the plan\b/gi,
  /\blet['’]?s try (something|a) (different|new)\b/gi,
  /\bback up\b/gi,
  /\bzoom out\b/gi,
];

const GRATITUDE_REGEXES: RegExp[] = [
  /\bthank(s| you)\b/gi,
  /\bappreciate\b/gi,
  /\bnice (work|job|catch)\b/gi,
  /\bthat['’]?s helpful\b/gi,
  /\bsuper helpful\b/gi,
  /\bgood (catch|work|call|find)\b/gi,
  /\bgreat (work|catch|job|call)\b/gi,
  /\bwell done\b/gi,
  /\bmuch better\b/gi,
];

const CATEGORY_REGEXES: Record<MarkerCategory, RegExp[]> = {
  frustration: FRUSTRATION_REGEXES,
  confusion: CONFUSION_REGEXES,
  breakthrough: BREAKTHROUGH_REGEXES,
  celebration: CELEBRATION_REGEXES,
  regret: REGRET_REGEXES,
  decision: DECISION_REGEXES,
  redirect: REDIRECT_REGEXES,
  gratitude: GRATITUDE_REGEXES,
};

export interface MarkerHit {
  count: number;
  samples: string[]; // distinct literal matches, capped
}

/** Score a single piece of text across all marker categories. */
export function scoreMarkers(text: string): Record<MarkerCategory, MarkerHit> {
  const out: Record<MarkerCategory, MarkerHit> = {
    frustration: { count: 0, samples: [] },
    confusion: { count: 0, samples: [] },
    breakthrough: { count: 0, samples: [] },
    celebration: { count: 0, samples: [] },
    regret: { count: 0, samples: [] },
    decision: { count: 0, samples: [] },
    redirect: { count: 0, samples: [] },
    gratitude: { count: 0, samples: [] },
  };
  if (!text) return out;

  for (const cat of Object.keys(CATEGORY_REGEXES) as MarkerCategory[]) {
    const hit = out[cat];
    for (const re of CATEGORY_REGEXES[cat]) {
      const matches = text.matchAll(re);
      for (const m of matches) {
        hit.count += 1;
        const lit = m[0].toLowerCase().replace(/\s+/g, " ").trim();
        if (hit.samples.length < 6 && !hit.samples.includes(lit)) {
          hit.samples.push(lit);
        }
      }
    }
  }

  return out;
}

/** Combine two MarkerHits (used during session aggregation). */
export function mergeHit(a: MarkerHit, b: MarkerHit): MarkerHit {
  const samples = a.samples.slice();
  for (const s of b.samples) {
    if (!samples.includes(s) && samples.length < 6) samples.push(s);
  }
  return { count: a.count + b.count, samples };
}

export const MARKER_CATEGORIES: MarkerCategory[] = [
  "frustration",
  "confusion",
  "breakthrough",
  "celebration",
  "regret",
  "decision",
  "redirect",
  "gratitude",
];
