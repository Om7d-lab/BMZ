import { AuthFrame } from '@/components/auth/AuthFrame';

/**
 * One frame for every auth screen. Living in the route group's layout, it
 * survives navigation between them, so only the form changes on each click.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthFrame>{children}</AuthFrame>;
}
