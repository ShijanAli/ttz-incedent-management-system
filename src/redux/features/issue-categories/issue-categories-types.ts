/** One row from GET /admin/issue-categories */
export interface IssueCategory {
  id: number;
  name: string;
  /** URL-safe key, e.g. "ui-problem" */
  slug: string;
  /** Hex, e.g. "#8B5CF6" */
  color: string;
  is_active: boolean;
}

/** Body for POST /admin/issue-categories */
export interface CreateIssueCategoryRequest {
  name: string;
  slug: string;
  color: string;
  is_active: boolean;
}

/** Body for PATCH /admin/issue-categories/{id}; send only what changes */
export interface UpdateIssueCategoryRequest extends Partial<Omit<CreateIssueCategoryRequest, 'slug'>> {
  id: number;
}
