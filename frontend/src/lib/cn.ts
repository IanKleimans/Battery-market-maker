import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** className helper — handles conditionals + Tailwind conflict resolution. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
