-- forum.ui-ux.agency — reference data only (categories + badge definitions).
-- No users or posts are seeded.

insert into public.categories (slug, name, description, sort_order) values
  ('ux-research',       'UX research',       'User interviews, usability testing, personas, journey mapping and research methods.', 1),
  ('ui-design',         'UI design',         'Visual design, layout, typography, color, components and design systems.',          2),
  ('saas-products',     'SaaS products',     'Onboarding, dashboards, pricing pages and UX for B2B and B2C SaaS.',                  3),
  ('ai-products',       'AI products',       'Designing AI features, chat interfaces, trust, explainability and agent UX.',         4),
  ('design-cost',       'Design cost',       'Budgets, pricing models and what UI/UX design work typically costs.',                 5),
  ('hiring-designers',  'Hiring designers',  'Hiring freelancers, agencies or in-house designers, portfolios and interviews.',      6),
  ('tools',             'Tools',             'Figma, prototyping, handoff, research and AI design tools.',                          7)
on conflict (slug) do update
  set name = excluded.name, description = excluded.description, sort_order = excluded.sort_order;

insert into public.badges (slug, name, description, tier) values
  ('first-question', 'Curious',        'Asked a first question.',                   'bronze'),
  ('first-answer',   'Helper',         'Posted a first answer.',                    'bronze'),
  ('problem-solver', 'Problem Solver', 'Had an answer accepted.',                   'bronze'),
  ('nice-question',  'Great Question', 'Asked a question with a score of 10.',      'silver'),
  ('good-answer',    'Great Answer',   'Posted an answer with a score of 10.',      'silver'),
  ('rep-100',        'Contributor',    'Reached 100 reputation.',                   'silver'),
  ('rep-1000',       'Expert',         'Reached 1,000 reputation.',                 'gold')
on conflict (slug) do update
  set name = excluded.name, description = excluded.description, tier = excluded.tier;
