-- ============================================================================
-- DEV SEED — businesses  (Block 5 testing data)
--
--   !!  DEVELOPMENT / TESTING ONLY — DO NOT RUN IN PRODUCTION  !!
--
-- Purpose: insert ~40 realistic automotive business records into ONE existing
-- workspace so the /database search / filter / sort / pagination UI (Block 5)
-- can be exercised with > 25 rows (pagination), varied wilayas, business types,
-- supported brands, statuses, and contact fields.
--
-- This script:
--   * creates NO tables, NO types, NO policies — it only INSERTs data.
--   * does NOT alter RLS or grants, and adds NO app features.
--   * picks ONE existing workspace + ONE of its members (preferring an 'owner')
--     from public.workspace_members, and attributes every row to that user
--     (created_by / modified_by) and that workspace (workspace_id).
--   * is re-runnable: rows already present (matched by workspace_id +
--     company_name) are skipped, so running it twice will NOT duplicate data.
--
-- HOW TO APPLY (no Supabase CLI required):
--   1. Open the Supabase Dashboard -> SQL Editor (runs as a privileged role,
--      which bypasses RLS — that is expected and required for seeding).
--   2. Make sure at least one workspace + member exists (sign up in the app
--      first if not). Paste this whole file and Run.
--   3. Read the NOTICE / verification output at the bottom to confirm the count.
--
-- TO REMOVE the seed data later (dev cleanup), see the commented DELETE at the
-- very bottom of this file.
-- ============================================================================

with target as (
  -- One workspace + one member, preferring an owner. Deterministic tie-break so
  -- repeated runs always target the same workspace.
  select wm.workspace_id, wm.user_id
  from public.workspace_members wm
  order by (wm.role = 'owner') desc, wm.workspace_id, wm.user_id
  limit 1
),
seed (company_name, contact_name, phone, email, city, wilaya, country,
      business_type, supported_brands, status, notes) as (
  values
    ('Alger Auto Parts',          'Karim Belkacem',  '0550 11 22 33', 'contact@algerautoparts.dz', 'Alger',       'Alger',       'Algeria', 'supplier',   array['Renault','Peugeot']::text[],                'qualified', 'Long-standing OEM parts supplier.'),
    ('Oran Motors Import',        'Sofiane Hadj',    '0661 44 55 66', 'sales@oranmotors.dz',       'Oran',        'Oran',        'Algeria', 'importer',   array['BMW','Mercedes-Benz','Audi']::text[],       'contacted', 'Imports German vehicles via Marseille.'),
    ('Garage El Djazair',         'Yacine Toumi',    '0770 12 13 14', 'eldjazair.garage@gmail.com','Blida',       'Blida',       'Algeria', 'garage',     array['Volkswagen','Audi']::text[],                'new',       NULL),
    ('Constantine Pieces Auto',   'Nadia Ferhat',    '031 92 10 20',  'info@cpauto.dz',            'Constantine', 'Constantine', 'Algeria', 'wholesaler', array['Toyota','Hyundai','Kia']::text[],           'qualified', 'Bulk distributor for the east region.'),
    ('Setif Spare Center',        'Riad Mansouri',   '0555 87 65 43', 'contact@setifspare.dz',     'Setif',       'Setif',       'Algeria', 'retailer',   array['Peugeot','Renault','Citroen']::text[],      'inactive',  'Closed for renovation Q3.'),
    ('Tlemcen Auto Service',      'Amine Bouzid',    '043 26 11 09',  'service@tlemcenauto.dz',    'Tlemcen',     'Tlemcen',     'Algeria', 'garage',     array['Renault']::text[],                          'contacted', 'Specializes in diesel engines.'),
    ('Mediterranee Trucks',       'Walid Saadi',     '0540 33 22 11', 'walid@medtrucks.dz',        'Annaba',      'Annaba',      'Algeria', 'importer',   array['Volkswagen','Toyota']::text[],              'new',       'Commercial vehicles focus.'),
    ('Bejaia Brake & Clutch',     'Lamia Idir',      '034 21 44 55',  'shop@bejaiabrake.dz',       'Bejaia',      'Bejaia',      'Algeria', 'retailer',   array['Hyundai','Kia']::text[],                    'qualified', NULL),
    ('Sahara Auto Equipement',    'Tarek Benali',    '0660 90 80 70', 'sahara.equip@gmail.com',    'Ouargla',     'Ouargla',     'Algeria', 'supplier',   array['Toyota','Mitsubishi']::text[],              'contacted', '4x4 parts for the south.'),
    ('Tizi Performance',          'Mehdi Ait Ali',   '026 11 22 33',  'info@tiziperf.dz',          'Tizi Ouzou',  'Tizi Ouzou',  'Algeria', 'garage',     array['BMW','Audi']::text[],                       'new',       'Tuning and performance shop.'),
    ('Capital Tyres',             'Sabrina Khelifi', '0551 23 45 67', 'sales@capitaltyres.dz',     'Alger',       'Alger',       'Algeria', 'wholesaler', array[]::text[],                                   'qualified', 'Tyres only; no brand affinity.'),
    ('Oran Lubricants Co',        'Farid Benamar',   '041 55 66 77',  'contact@oranlub.dz',        'Oran',        'Oran',        'Algeria', 'supplier',   array['Renault','Peugeot','Volkswagen']::text[],   'contacted', NULL),
    ('Blida Body Works',          'Hicham Saoudi',   '025 40 12 34',  'bodyworks.blida@gmail.com', 'Blida',       'Blida',       'Algeria', 'garage',     array['Mercedes-Benz']::text[],                    'new',       'Accident repair specialist.'),
    ('East Motors Wholesale',     'Yasmine Cherif',  '031 88 99 00',  'east@motorswholesale.dz',   'Constantine', 'Constantine', 'Algeria', 'wholesaler', array['Hyundai','Kia','Toyota']::text[],           'qualified', 'Largest stock in Constantine.'),
    ('Setif Premium Cars',        'Adel Boudiaf',    '0556 19 28 37', 'premium@setifcars.dz',      'Setif',       'Setif',       'Algeria', 'retailer',   array['BMW','Mercedes-Benz']::text[],              'contacted', 'High-end used vehicles.'),
    ('Tlemcen Pieces Express',    'Nawal Brahimi',   '043 90 81 72',  'express@tlemcenpieces.dz',  'Tlemcen',     'Tlemcen',     'Algeria', 'supplier',   array['Peugeot','Citroen']::text[],                'new',       NULL),
    ('Annaba Auto Diesel',        'Omar Lakhdar',    '038 44 33 22',  'diesel@annabaauto.dz',      'Annaba',      'Annaba',      'Algeria', 'garage',     array['Volkswagen','Audi']::text[],                'inactive',  'Seasonal; reopens spring.'),
    ('Bejaia Import Group',       'Sami Mokrane',    '0662 71 82 93', 'sami@bejaiaimport.dz',      'Bejaia',      'Bejaia',      'Algeria', 'importer',   array['Toyota','Hyundai']::text[],                 'qualified', 'Asian brands importer.'),
    ('Desert Wheels Trading',     'Imane Ould',      '029 70 60 50',  'trading@desertwheels.dz',   'Ouargla',     'Ouargla',     'Algeria', 'wholesaler', array['Mitsubishi','Toyota']::text[],              'contacted', NULL),
    ('Kabylie Auto Center',       'Rachid Hammoud',  '026 33 44 55',  'center@kabylieauto.dz',     'Tizi Ouzou',  'Tizi Ouzou',  'Algeria', 'retailer',   array['Renault','Peugeot']::text[],                'new',       'Family-run since 1998.'),
    ('Algiers Premium Import',    'Selma Bensalem',  '0551 60 70 80', 'import@algierspremium.dz',  'Alger',       'Alger',       'Algeria', 'importer',   array['Audi','BMW','Mercedes-Benz']::text[],       'qualified', 'Direct from Germany.'),
    ('Oran Garage Central',       'Bilal Cherfaoui', '041 12 23 34',  'central@orangarage.dz',     'Oran',        'Oran',        'Algeria', 'garage',     array['Kia','Hyundai']::text[],                    'contacted', NULL),
    ('Blida Wholesale Parts',     'Hanane Djebbar',  '025 22 33 44',  'parts@blidawholesale.dz',   'Blida',       'Blida',       'Algeria', 'wholesaler', array['Volkswagen','Renault','Peugeot']::text[],   'new',       'Competitive bulk pricing.'),
    ('Constantine Tyre Depot',    'Younes Aribi',    '031 45 56 67',  'depot@cttyre.dz',           'Constantine', 'Constantine', 'Algeria', 'retailer',   array[]::text[],                                   'inactive',  NULL),
    ('Setif Engine Supply',       'Khaled Meziane',  '0556 28 39 40', 'engine@setifsupply.dz',     'Setif',       'Setif',       'Algeria', 'supplier',   array['Toyota','Mitsubishi','Hyundai']::text[],    'qualified', 'Reconditioned engines.'),
    ('Tlemcen Motors',            'Asma Belaid',     '043 11 12 13',  'motors@tlemcen.dz',         'Tlemcen',     'Tlemcen',     'Algeria', 'retailer',   array['Renault']::text[],                          'contacted', NULL),
    ('Annaba Spare Hub',          'Nabil Guerrouj',  '038 67 78 89',  'hub@annabaspare.dz',        'Annaba',      'Annaba',      'Algeria', 'wholesaler', array['Peugeot','Citroen','Renault']::text[],      'new',       'Regional distribution hub.'),
    ('Bejaia Garage Pro',         'Lynda Ould Amer', '034 90 01 12',  'pro@bejaiagarage.dz',       'Bejaia',      'Bejaia',      'Algeria', 'garage',     array['BMW']::text[],                              'qualified', 'Authorized service experience.'),
    ('Souf Auto Trading',         'Brahim Tahar',    '0660 19 29 39', 'souf@autotrading.dz',       'El Oued',     'El Oued',     'Algeria', 'importer',   array['Toyota','Mitsubishi']::text[],              'contacted', NULL),
    ('Highland Parts Tizi',       'Ferhat Slimani',  '026 55 66 77',  'highland@tiziparts.dz',     'Tizi Ouzou',  'Tizi Ouzou',  'Algeria', 'supplier',   array['Volkswagen','Audi','BMW']::text[],          'new',       'Mountain-region logistics.'),
    ('Capital Motors Retail',     'Dounia Hamel',    '0551 80 91 02', 'retail@capitalmotors.dz',   'Alger',       'Alger',       'Algeria', 'retailer',   array['Mercedes-Benz','Audi']::text[],             'qualified', 'Showroom in Hydra.'),
    ('West Coast Importers',      'Said Benyahia',   '041 33 44 55',  'west@coastimport.dz',       'Oran',        'Oran',        'Algeria', 'importer',   array['Hyundai','Kia','Toyota']::text[],           'contacted', 'Port of Oran clearance.'),
    ('Blida Auto Discount',       'Meriem Saidi',    '025 66 77 88',  'discount@blidaauto.dz',     'Blida',       'Blida',       'Algeria', 'retailer',   array['Renault','Peugeot']::text[],                'inactive',  'Clearance stock only.'),
    ('Constantine Garage Est',    'Ramzi Khelil',    '031 10 20 30',  'est@constantinegarage.dz',  'Constantine', 'Constantine', 'Algeria', 'garage',     array['Volkswagen']::text[],                       'new',       NULL),
    ('Setif Brands Distribution', 'Lila Ait Saada',  '0556 40 51 62', 'brands@setifdist.dz',       'Setif',       'Setif',       'Algeria', 'wholesaler', array['BMW','Mercedes-Benz','Audi','Volkswagen']::text[], 'qualified', 'Multi-brand German distributor.'),
    ('Tlemcen Tyres & Rims',      'Anis Bekkar',     '043 50 60 70',  'tyres@tlemcenrims.dz',      'Tlemcen',     'Tlemcen',     'Algeria', 'retailer',   array[]::text[],                                   'contacted', 'Tyres and alloy rims.'),
    ('Annaba Premium Import',     'Wassila Cherrak', '038 12 13 14',  'premium@annabaimport.dz',   'Annaba',      'Annaba',      'Algeria', 'importer',   array['Audi','BMW']::text[],                       'new',       'Premium German imports.'),
    ('Bejaia Parts Wholesale',    'Madjid Ouali',    '034 70 80 90',  'parts@bejaiawholesale.dz',  'Bejaia',      'Bejaia',      'Algeria', 'wholesaler', array['Toyota','Hyundai','Kia']::text[],           'qualified', NULL),
    ('Ghardaia Auto Supply',      'Noureddine Baba', '029 40 50 60',  'supply@ghardaiaauto.dz',    'Ghardaia',    'Ghardaia',    'Algeria', 'supplier',   array['Toyota','Mitsubishi']::text[],              'contacted', 'Desert-spec components.'),
    ('Marseille Auto Export',     'Julien Moreau',   '+33 4 91 00 11','contact@marseilleexport.fr','Marseille',   NULL,          'France',  'importer',   array['Peugeot','Renault','Citroen']::text[],      'new',       'Cross-border supplier (France).'),
    ('Tunis Parts International',  'Slim Gharbi',     '+216 71 22 33', 'sales@tunisparts.tn',       'Tunis',       NULL,          'Tunisia', 'wholesaler', array['Volkswagen','Toyota','Kia']::text[],        'contacted', 'Cross-border supplier (Tunisia).')
)
insert into public.businesses
  (workspace_id, company_name, contact_name, phone, email, city, wilaya, country,
   business_type, supported_brands, status, notes, created_by, modified_by, created_at)
select
  t.workspace_id,
  s.company_name, s.contact_name, s.phone, s.email, s.city, s.wilaya, s.country,
  s.business_type, s.supported_brands, s.status::public.business_status, s.notes,
  t.user_id, t.user_id,
  -- Spread created_at over the past ~10 days so newest/oldest sorting differs.
  now() - ((row_number() over (order by s.company_name)) * interval '6 hours')
from target t
cross join seed s
where not exists (
  -- Skip rows already seeded into this workspace (makes re-runs safe).
  select 1 from public.businesses b
  where b.workspace_id = t.workspace_id
    and b.company_name = s.company_name
);

-- ----------------------------------------------------------------------------
-- VERIFICATION (read-only) — run after the insert and eyeball the results.
-- ----------------------------------------------------------------------------
do $$
declare
  ws uuid;
  n  int;
begin
  select wm.workspace_id into ws
  from public.workspace_members wm
  order by (wm.role = 'owner') desc, wm.workspace_id, wm.user_id
  limit 1;

  if ws is null then
    raise notice 'No workspace/member found — nothing was seeded. Sign up in the app first.';
  else
    select count(*) into n
    from public.businesses
    where workspace_id = ws and deleted_at is null;
    raise notice 'Seeded workspace %, now has % active business records.', ws, n;
  end if;
end
$$;

-- Optional breakdowns to confirm variety:
--   select status, count(*) from public.businesses group by status order by status;
--   select wilaya, count(*) from public.businesses group by wilaya order by wilaya;
--   select business_type, count(*) from public.businesses group by business_type order by business_type;

-- ----------------------------------------------------------------------------
-- DEV CLEANUP (optional) — remove ONLY the seeded rows for the target workspace.
-- Uncomment and run if you want to clear the seed data. (Hard delete is fine
-- here because this is dev-only data; the app itself never hard-deletes.)
-- ----------------------------------------------------------------------------
-- with target as (
--   select wm.workspace_id from public.workspace_members wm
--   order by (wm.role = 'owner') desc, wm.workspace_id, wm.user_id limit 1
-- )
-- delete from public.businesses b
-- using target t
-- where b.workspace_id = t.workspace_id
--   and b.company_name in (
--     'Alger Auto Parts','Oran Motors Import','Garage El Djazair','Constantine Pieces Auto',
--     'Setif Spare Center','Tlemcen Auto Service','Mediterranee Trucks','Bejaia Brake & Clutch',
--     'Sahara Auto Equipement','Tizi Performance','Capital Tyres','Oran Lubricants Co',
--     'Blida Body Works','East Motors Wholesale','Setif Premium Cars','Tlemcen Pieces Express',
--     'Annaba Auto Diesel','Bejaia Import Group','Desert Wheels Trading','Kabylie Auto Center',
--     'Algiers Premium Import','Oran Garage Central','Blida Wholesale Parts','Constantine Tyre Depot',
--     'Setif Engine Supply','Tlemcen Motors','Annaba Spare Hub','Bejaia Garage Pro',
--     'Souf Auto Trading','Highland Parts Tizi','Capital Motors Retail','West Coast Importers',
--     'Blida Auto Discount','Constantine Garage Est','Setif Brands Distribution','Tlemcen Tyres & Rims',
--     'Annaba Premium Import','Bejaia Parts Wholesale','Ghardaia Auto Supply','Marseille Auto Export',
--     'Tunis Parts International'
--   );
-- ============================================================================
