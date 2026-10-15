grant select, insert, update on utero_academy.permits to authenticated;
grant select, insert, update on utero_academy.attendance_settings to authenticated;
grant select, insert, update on utero_academy.daily_reports to authenticated;
grant select, insert, update, delete on utero_academy.daily_report_attachments to authenticated;
grant select, insert, update on utero_academy.daily_report_reviews to authenticated;

grant select, insert, update, delete on
  utero_academy.cms_sites, utero_academy.articles, utero_academy.faqs,
  utero_academy.testimonials, utero_academy.galleries,
  utero_academy.landing_page_settings to authenticated;

grant select on
  utero_academy.cms_sites, utero_academy.articles, utero_academy.faqs,
  utero_academy.testimonials, utero_academy.galleries,
  utero_academy.landing_page_settings to academy_api;

create policy academy_api_public_sites on utero_academy.cms_sites
  for select to academy_api using (true);
create policy academy_api_public_articles on utero_academy.articles
  for select to academy_api using (status = 'published');
create policy academy_api_public_faqs on utero_academy.faqs
  for select to academy_api using (status = 'published');
create policy academy_api_public_testimonials on utero_academy.testimonials
  for select to academy_api using (status = 'published');
create policy academy_api_public_galleries on utero_academy.galleries
  for select to academy_api using (status = 'published');
create policy academy_api_public_landing on utero_academy.landing_page_settings
  for select to academy_api using (true);
