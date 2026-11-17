-- Expand the faculty catalogue with current MUST-VLE undergraduate course listings.
-- VLE course titles/categories are authoritative for current teaching listings, but do not
-- publish credit units, programme mapping or study level for every item. Keep those fields
-- NULL until the Registrar verifies them against the approved programme curriculum.
alter table public.courses
  alter column code drop not null,
  alter column credit_units drop not null,
  alter column credit_units drop default,
  alter column level drop not null,
  alter column level drop default;

alter table public.courses
  add column if not exists catalogue_source text,
  add column if not exists catalogue_status text not null default 'PENDING_VERIFICATION';

insert into public.courses
  (code, title, credit_units, department_id, level, catalogue_source, catalogue_status)
select
  v.course_code, v.course_title, null, d.id, null,
  'MUST-VLE 2026/27 UG Semester 1',
  'VLE_LISTED_UNVERIFIED'
from (values
  ('FAEVS', null::text, 'Crop Production Systems'),
  ('FAEVS', null, 'Agricultural Botany and Plant Physiology'),
  ('FAEVS', null, 'Agricultural Project Planning and Management'),
  ('FAEVS', null, 'Animal Breeding'),
  ('FAEVS', null, 'Animal Health and Disease'),
  ('FAEVS', null, 'Animal Nutrition and Feed Technology'),
  ('FAEVS', null, 'Farm Mechanization'),
  ('FAEVS', null, 'Farm Planning, Systems and Structures'),
  ('FAEVS', null, 'Plant Breeding and Biotechnology'),
  ('FAEVS', null, 'Small Ruminants Production'),
  ('FAEVS', null, 'Pasture Production and Rangeland Management'),

  ('FAST', 'MIE3102', 'Dynamic Systems'),
  ('FAST', 'CVE2105', 'Theory of Structures I'),
  ('FAST', null, 'Applied Thermodynamics'),
  ('FAST', null, 'Engineering Mathematics I'),
  ('FAST', null, 'Internet of Things'),

  ('FOBMS', 'BBA1104', 'Principles of Management'),
  ('FOBMS', 'BBA3109', 'Marketing Research'),
  ('FOBMS', null, 'E-Procurement'),
  ('FOBMS', null, 'Insurance II'),
  ('FOBMS', null, 'Introduction to Purchasing and Supply'),

  ('FCI', 'BIT1104', 'Fundamentals of Information Systems'),
  ('FCI', 'CSC3104', 'Computational Complexity'),
  ('FCI', null, 'Communication and Writing Skills for Computer Scientists'),
  ('FCI', null, 'Fundamentals of ICT'),
  ('FCI', null, 'Geographical Information Systems'),
  ('FCI', null, 'Systems Security'),

  ('FHS', 'CMH2211', 'Fundamentals of Epidemiology and Environmental Sanitation'),
  ('FHS', 'MLS4121', 'Clinical Chemistry and Practical V (Lipids, Haemoglobin and disease)'),
  ('FHS', 'MLS4124', 'Medical Virology and Public Health Bacteriology'),
  ('FHS', null, 'Systemic Anatomy I/Gross Anatomy, Embryology and Histology I'),
  ('FHS', null, 'Good Manufacturing and Laboratory Practices'),

  ('FIS', 'BSAL3108', 'Land Tenure, Use and Planning'),
  ('FIS', null, 'International Agenda and Women Health'),
  ('FIS', null, 'Public Private Partnership in Urban Service Delivery'),

  ('FOS', 'CHE3101', 'Transition Quantum and Nuclear Chemistry'),
  ('FOS', 'PHY3109', 'Stellar Structure and Evolution'),
  ('FOS', 'DCS1101', 'Computer Skills DLT'),
  ('FOS', null, 'Introduction to Practical Physics'),
  ('FOS', null, 'Properties of Matter')
) as v(faculty_code, course_code, course_title)
join public.departments d on d.code = v.faculty_code
where not exists (
  select 1 from public.courses existing
  where existing.department_id = d.id
    and lower(existing.title) = lower(v.course_title)
)
on conflict (code) do nothing;
