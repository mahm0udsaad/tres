declare module "arabic-reshaper" {
  /** Convert Arabic text to its contextual presentation forms. */
  export function convertArabic(text: string): string;
  /** Reverse the presentation-form conversion. */
  export function convertArabicBack(text: string): string;
}
