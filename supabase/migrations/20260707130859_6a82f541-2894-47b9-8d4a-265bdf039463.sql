alter table public.lessons
  add column if not exists pdf_files jsonb not null default '[]'::jsonb;

-- migrate existing single pdf_url values into the new list
update public.lessons
set pdf_files = jsonb_build_array(jsonb_build_object('title', 'ملف المحاضرة', 'url', pdf_url))
where pdf_url is not null and pdf_url <> '' and (pdf_files is null or pdf_files = '[]'::jsonb);