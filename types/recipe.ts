export type Category = {
  slug: string;
  name: string;
};

export type Ingredient = {
  section: string | null;
  name: string;
  quantity: string | null;
  unit: string | null;
  preparation: string | null;
  optional: boolean;
};

export type Step = {
  step_number: number;
  instruction: string;
  timer_minutes: number | null;
  tip: string | null;
  image_urls?: string[] | null;
};

export type Recipe = {
  slug: string;
  title: string;
  subtitle: string;
  category_slug: string;
  serves: string;
  tags: string[];
  source: string;
  notes: string;
  ingredients: Ingredient[];
  steps: Step[];
  video_url?: string | null;
};

export type CookbookSource = {
  book_title: string;
  recipes_by: string;
  translated_by: string;
  year: number;
  note: string;
};

export type Cookbook = {
  source: CookbookSource;
  categories: Category[];
  recipes: Recipe[];
};
