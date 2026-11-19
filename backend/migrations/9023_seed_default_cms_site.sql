insert into utero_academy.cms_sites (name, slug, domain)
values ('Utero Academy', 'utero-academy', 'academy.carubra.com')
on conflict (slug) do nothing;
