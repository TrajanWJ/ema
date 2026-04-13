import type { PaginationOpts } from "../schemas/common.js";

export interface ServiceContract<T> {
  list(opts?: PaginationOpts): Promise<T[]>;
  get(id: string): Promise<T | null>;
  create(data: Omit<T, "id" | "inserted_at" | "updated_at">): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
}
