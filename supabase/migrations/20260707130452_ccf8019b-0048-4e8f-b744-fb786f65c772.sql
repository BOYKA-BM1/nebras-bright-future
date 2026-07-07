create policy "Lesson pdfs insert (teacher/montage/admin)"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'lesson-pdfs'
  and (has_role(auth.uid(), 'teacher'::app_role)
    or has_role(auth.uid(), 'montage'::app_role)
    or has_role(auth.uid(), 'admin'::app_role))
);

create policy "Lesson pdfs select (teacher/montage/admin)"
on storage.objects for select to authenticated
using (
  bucket_id = 'lesson-pdfs'
  and (has_role(auth.uid(), 'teacher'::app_role)
    or has_role(auth.uid(), 'montage'::app_role)
    or has_role(auth.uid(), 'admin'::app_role))
);

create policy "Lesson pdfs update (teacher/montage/admin)"
on storage.objects for update to authenticated
using (
  bucket_id = 'lesson-pdfs'
  and (has_role(auth.uid(), 'teacher'::app_role)
    or has_role(auth.uid(), 'montage'::app_role)
    or has_role(auth.uid(), 'admin'::app_role))
)
with check (
  bucket_id = 'lesson-pdfs'
  and (has_role(auth.uid(), 'teacher'::app_role)
    or has_role(auth.uid(), 'montage'::app_role)
    or has_role(auth.uid(), 'admin'::app_role))
);

create policy "Lesson pdfs delete (montage/admin)"
on storage.objects for delete to authenticated
using (
  bucket_id = 'lesson-pdfs'
  and (has_role(auth.uid(), 'montage'::app_role)
    or has_role(auth.uid(), 'admin'::app_role))
);