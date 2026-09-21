/**
 * The auth route group intentionally adds no chrome of its own: the sign-in
 * screen is a full-bleed split layout, while the register screen brings its own
 * centred card shell. Keeping this a pass-through lets each page own its layout.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
