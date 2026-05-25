import clsx, { type ClassValue } from 'clsx';

/**
 * Merges class name inputs with clsx (Tailwind-friendly conditional classes).
 *
 * @param inputs - Class values (strings, objects, arrays)
 * @returns Combined class string
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
