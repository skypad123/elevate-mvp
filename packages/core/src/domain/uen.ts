/**
 * The Unique Entity Number of a Singapore company, checked for format only: no check-letter
 * calculation and no registry lookup. The point is to catch typing errors before Support compares
 * the number with the registry document.
 *
 * Source: "Annex E – UEN Format" of the press release "Unique Entity Number Brings Convenience to
 * Entities", issued jointly by the Ministry of Finance, the Accounting and Corporate Regulatory
 * Authority and the Infocomm Development Authority of Singapore on 6 August 2008
 * (https://www.mof.gov.sg/news-resources/newsroom/unique-entity-number-brings-convenience-to-entities/).
 * It gives three formats:
 *
 * - businesses registered with ACRA: `nnnnnnnnX`, for example `12345678A` (not accepted here: a
 *   sole proprietorship or partnership applies as a personal profile);
 * - local companies registered with ACRA: `yyyynnnnnX`, for example `199012345X`. The year of
 *   incorporation, a five-digit running number and a check letter;
 * - all other entities, limited liability partnerships among them: `TyyPQnnnnX`, for example
 *   `T08LL1234A`. `Tyy` is the year of issuance, `PQ` the type of entity (`LL` for a limited
 *   liability partnership), then a four-digit running number and a check letter.
 */

export const ENTITY_TYPES = ['private_limited', 'llp'] as const
export type EntityType = (typeof ENTITY_TYPES)[number]

export const ENTITY_TYPE_LABEL: Record<EntityType, string> = {
  private_limited: 'Private limited company (Pte. Ltd.)',
  llp: 'Limited liability partnership (LLP)',
}

const UEN_PATTERN: Record<EntityType, RegExp> = {
  // yyyynnnnnX: nine digits and a letter, whatever the year of incorporation.
  private_limited: /^\d{9}[A-Z]$/,
  // TyyLLnnnnX. LLPs have existed only since 2005, so the century letter is always T.
  llp: /^T\d{2}LL\d{4}[A-Z]$/,
}

/** What a UEN of each type looks like, for the hint under the field. */
export const UEN_EXAMPLE: Record<EntityType, string> = {
  private_limited: '201912345K',
  llp: 'T08LL1234A',
}

/** The UEN as it is stored and compared: trimmed and in upper case. */
export function normaliseUen(input: string): string {
  return input.trim().toUpperCase()
}

/** True when the UEN has the format of the chosen entity type. Normalise it first. */
export function isValidUen(uen: string, entityType: EntityType): boolean {
  return UEN_PATTERN[entityType].test(uen)
}
