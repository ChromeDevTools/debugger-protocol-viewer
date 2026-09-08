type _Trim<S extends string> = S extends ` ${infer R}` ? _Trim<R> : S extends `${infer R} ` ? _Trim<R> : S;

// Peel combinators; only the rightmost simple selector matters for the type.
type _LastSegment<S extends string> = S extends `${string} ${infer R}`
  ? _LastSegment<_Trim<R>>
  : S extends `${string}>${infer R}`
    ? _LastSegment<_Trim<R>>
    : S extends `${string}+${infer R}`
      ? _LastSegment<_Trim<R>>
      : S extends `${string}~${infer R}`
        ? _LastSegment<_Trim<R>>
        : S;

// Strip [attr] / .class / #id / :pseudo suffixes to leave just the tag name.
type _StripFilters<S extends string> = S extends `${infer H}[${string}]${infer T}`
  ? _StripFilters<`${H}${T}`>
  : S extends `${infer H}.${string}`
    ? _StripFilters<H>
    : S extends `${infer H}#${string}`
      ? _StripFilters<H>
      : S extends `${infer H}:${string}`
        ? _StripFilters<H>
        : S;

type _ResolveTag<S extends string> = S extends ''
  ? HTMLElement
  : S extends '*'
    ? Element
    : S extends keyof HTMLElementTagNameMap
      ? HTMLElementTagNameMap[S]
      : S extends keyof SVGElementTagNameMap
        ? SVGElementTagNameMap[S]
        : HTMLElement;

// Simplified version of the `typed-query-selector` npm package
export type ParseSelector<S extends string> =
  // Non-literal string input: give up and return the widest safe type.
  string extends S
    ? Element
    : S extends `${infer A},${infer B}`
      ? ParseSelector<_Trim<A>> | ParseSelector<_Trim<B>>
      : _ResolveTag<_StripFilters<_LastSegment<_Trim<S>>>>;

export function $<T extends string>(query: T, context?: ParentNode): ParseSelector<T>;
export function $$<T extends string>(query: T, context?: ParentNode): ParseSelector<T>[];

declare global {
  interface ParentNode {
    $<T extends string>(query: T): ParseSelector<T>;
    $$<T extends string>(query: T): ParseSelector<T>[];
  }
}
