import {
    NormalizationCandidate,
    NormalizationInput,
    NormalizationResult,
    ScoreBreakdown,
} from '../types/detection';

const ACCEPT_THRESHOLD = 80;
const SUGGEST_THRESHOLD = 50;

const OCR_WEIGHT = 0.5;
const CLASS_WEIGHT = 0.2;
const COLOR_WEIGHT = 0.1;
const HISTORY_WEIGHT = 0.2;

const CATALOG: NormalizationCandidate[] = [
    {
        label: 'soft_drink',
        normalizedName: 'cola',
        colorHint: 'red',
        aliases: ['cola', 'coca cola', 'coke', 'coca-cola', 'soft drink'],
    },
    {
        label: 'water',
        normalizedName: 'mineral_water',
        colorHint: 'blue',
        aliases: ['water', 'mineral water', 'bottled water', 'aqua'],
    },
    {
        label: 'juice',
        normalizedName: 'orange_juice',
        colorHint: 'orange',
        aliases: ['juice', 'orange juice', 'fruit juice', 'mango juice'],
    },
    {
        label: 'container',
        normalizedName: 'glass_bottle',
        colorHint: 'transparent',
        aliases: ['bottle', 'glass bottle', 'container'],
    },
    {
        label: 'container',
        normalizedName: 'metal_can',
        colorHint: 'silver',
        aliases: ['can', 'soda can', 'tin can', 'aluminum can'],
    },
];

const CLASS_TO_LABEL: Record<string, string> = {
    bottle: 'container',
    can: 'container',
    cup: 'container',
    glass: 'container',
    beverage: 'soft_drink',
    drink: 'soft_drink',
    soda: 'soft_drink',
};

function normalizeText(value?: string): string {
    return (value ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function clamp(score: number): number {
    if (Number.isNaN(score)) return 0;
    return Math.max(0, Math.min(100, Math.round(score)));
}

function tokenSimilarity(a: string, b: string): number {
    if (!a || !b) return 0;
    const aTokens = new Set(a.split(' ').filter(Boolean));
    const bTokens = new Set(b.split(' ').filter(Boolean));
    const intersectionCount = [...aTokens].filter(token => bTokens.has(token)).length;
    const unionCount = new Set([...aTokens, ...bTokens]).size;
    if (unionCount === 0) return 0;
    return (intersectionCount / unionCount) * 100;
}

function computeOcrSimilarity(ocrText: string, candidate: NormalizationCandidate): number {
    if (!ocrText) return 0;
    const directHit = candidate.aliases.some(alias => normalizeText(alias) === ocrText);
    if (directHit) return 100;

    return candidate.aliases.reduce((best, alias) => {
        const sim = tokenSimilarity(ocrText, normalizeText(alias));
        return Math.max(best, sim);
    }, 0);
}

function computeClassMatch(className: string, candidate: NormalizationCandidate): number {
    if (!className) return 0;
    const expectedLabel = CLASS_TO_LABEL[className] ?? className;

    if (candidate.label === expectedLabel) return 100;
    if (normalizeText(candidate.normalizedName).includes(className)) return 70;
    return 0;
}

function computeColorMatch(inputColor: string, candidate: NormalizationCandidate): number {
    if (!inputColor || !candidate.colorHint) return 0;
    return inputColor === normalizeText(candidate.colorHint) ? 100 : 0;
}

function computeHistoricalMatch(
    candidate: NormalizationCandidate,
    userCorrections: Record<string, number>,
): number {
    const boost = userCorrections[candidate.normalizedName] ?? 0;
    return clamp(boost);
}

function createUnknownResult(): NormalizationResult {
    const zero: ScoreBreakdown = {
        ocrSimilarity: 0,
        classMatch: 0,
        colorMatch: 0,
        historicalMatch: 0,
        total: 0,
    };

    return {
        label: 'unknown',
        normalizedName: 'unknown',
        confidence: 0,
        status: 'unknown',
        scoreBreakdown: zero,
        suggestions: [],
    };
}

/**
 * Layer 3 + Layer 4 implementation.
 * Normalizes detector+feature signals into a canonical object identity,
 * then applies weighted scoring and confidence thresholds.
 */
export function normalizeDetection(
    input: NormalizationInput,
    options?: {
        catalog?: NormalizationCandidate[];
        userCorrections?: Record<string, number>;
    },
): NormalizationResult {
    const normalizedClass = normalizeText(input.className);
    const normalizedOcr = normalizeText(input.ocrText);
    const normalizedColor = normalizeText(input.dominantColor);
    const userCorrections = options?.userCorrections ?? {};
    const catalog = options?.catalog ?? CATALOG;

    if (!normalizedClass && !normalizedOcr) {
        return createUnknownResult();
    }

    const scored = catalog.map(candidate => {
        const ocrSimilarity = clamp(computeOcrSimilarity(normalizedOcr, candidate));
        const classMatch = clamp(computeClassMatch(normalizedClass, candidate));
        const colorMatch = clamp(computeColorMatch(normalizedColor, candidate));
        const historicalMatch = clamp(computeHistoricalMatch(candidate, userCorrections));

        const total = clamp(
            ocrSimilarity * OCR_WEIGHT +
            classMatch * CLASS_WEIGHT +
            colorMatch * COLOR_WEIGHT +
            historicalMatch * HISTORY_WEIGHT,
        );

        const scoreBreakdown: ScoreBreakdown = {
            ocrSimilarity,
            classMatch,
            colorMatch,
            historicalMatch,
            total,
        };

        return { candidate, scoreBreakdown };
    });

    scored.sort((a, b) => b.scoreBreakdown.total - a.scoreBreakdown.total);

    const top = scored[0];
    if (!top) {
        return createUnknownResult();
    }

    const topConfidence = top.scoreBreakdown.total;
    const suggestions = scored
        .filter(item => item.scoreBreakdown.total >= SUGGEST_THRESHOLD)
        .slice(0, 3)
        .map(item => item.candidate);

    if (topConfidence < SUGGEST_THRESHOLD) {
        return {
            label: 'unknown',
            normalizedName: 'unknown',
            confidence: topConfidence,
            status: 'unknown',
            scoreBreakdown: top.scoreBreakdown,
            suggestions: [],
        };
    }

    if (topConfidence < ACCEPT_THRESHOLD) {
        return {
            label: top.candidate.label,
            normalizedName: top.candidate.normalizedName,
            confidence: topConfidence,
            status: 'ambiguous',
            scoreBreakdown: top.scoreBreakdown,
            suggestions,
        };
    }

    return {
        label: top.candidate.label,
        normalizedName: top.candidate.normalizedName,
        confidence: topConfidence,
        status: 'verified',
        scoreBreakdown: top.scoreBreakdown,
        suggestions,
    };
}
