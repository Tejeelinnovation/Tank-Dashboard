import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function AdminRootLayout({ children }: Props) {
  return <>{children}</>;
}
