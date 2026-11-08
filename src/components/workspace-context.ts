import type { ReactNode } from "react";
import type { FormSpec } from "@/components/record-form";
import type { Row, User } from "@/lib/api";
export type WorkspaceContext = {
  me: User; data: Record<string, any>; page: string; focus: string | null;
  reload: () => Promise<void>; navigate: (page: string, id?: string) => void;
  form: (spec: FormSpec) => void; detail: (title: string, content: ReactNode) => void;
  act: (name: string, row?: Row) => void;
};
