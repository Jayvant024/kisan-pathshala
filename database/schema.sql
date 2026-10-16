-- Kisan Pathshala initial schema. Review before running in Supabase SQL Editor.
-- RLS is enabled on every application table. No client policies are granted here,
-- so direct API access is denied until authentication and narrowly-scoped policies
-- are deliberately added. Never expose SUPABASE_SECRET_KEY to the frontend.

begin;

create table if not exists public.profiles (
	id uuid primary key references auth.users (id) on delete cascade,
	full_name text not null check (length(trim(full_name)) > 0),
	phone text unique,
	preferred_language text not null default 'en'
		check (preferred_language in ('en', 'hi')),
	role text not null default 'farmer'
		check (role in ('farmer', 'admin')),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (id, role)
);

create table if not exists public.courses (
	id uuid primary key default gen_random_uuid(),
	slug text not null unique check (length(trim(slug)) > 0),
	title_en text not null check (length(trim(title_en)) > 0),
	title_hi text not null check (length(trim(title_hi)) > 0),
	description_en text not null default '',
	description_hi text not null default '',
	category text,
	level text not null default 'beginner'
		check (level in ('beginner', 'intermediate', 'advanced')),
	status text not null default 'draft'
		check (status in ('draft', 'published', 'archived')),
	display_order integer not null default 0,
	created_by uuid references public.profiles (id) on delete set null,
	published_at timestamptz,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create table if not exists public.course_modules (
	id uuid primary key default gen_random_uuid(),
	course_id uuid not null references public.courses (id) on delete cascade,
	title_en text not null check (length(trim(title_en)) > 0),
	title_hi text not null check (length(trim(title_hi)) > 0),
	description_en text not null default '',
	description_hi text not null default '',
	display_order integer not null default 0 check (display_order >= 0),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (course_id, display_order)
);

create table if not exists public.lessons (
	id uuid primary key default gen_random_uuid(),
	module_id uuid not null references public.course_modules (id) on delete cascade,
	title_en text not null check (length(trim(title_en)) > 0),
	title_hi text not null check (length(trim(title_hi)) > 0),
	description_en text not null default '',
	description_hi text not null default '',
	content_en text not null default '',
	content_hi text not null default '',
	content_type text not null default 'article'
		check (content_type in ('article', 'video', 'quiz')),
	content_url text,
	duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
	display_order integer not null default 0 check (display_order >= 0),
	is_published boolean not null default false,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (module_id, display_order)
);

create table if not exists public.orders (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users (id) on delete restrict,
	course_id uuid not null references public.courses (id) on delete restrict,
	amount_paise bigint not null check (amount_paise > 0),
	currency text not null default 'INR' check (currency = 'INR'),
	payment_method text not null default 'upi' check (payment_method = 'upi'),
	payment_status text not null default 'pending'
		check (payment_status in ('pending', 'submitted', 'verified', 'rejected')),
	upi_utr text unique,
	utr_submitted_at timestamptz,
	reviewed_by uuid,
	reviewed_by_role text generated always as (
		case when reviewed_by is null then null else 'admin' end
	) stored,
	reviewed_at timestamptz,
	review_note text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	check ((upi_utr is null) = (utr_submitted_at is null)),
	check ((reviewed_by is null) = (reviewed_at is null)),
	foreign key (reviewed_by, reviewed_by_role)
		references public.profiles (id, role) on delete restrict,
	check (
		(payment_status = 'pending' and upi_utr is null)
		or (payment_status <> 'pending' and upi_utr is not null)
	),
	check (
		(payment_status in ('verified', 'rejected')) = (reviewed_by is not null)
	)
);

create table if not exists public.enrollments (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users (id) on delete restrict,
	course_id uuid not null references public.courses (id) on delete restrict,
	order_id uuid not null unique references public.orders (id) on delete restrict,
	status text not null default 'pending'
		check (status in ('pending', 'active', 'suspended', 'cancelled')),
	activated_by uuid,
	activated_by_role text generated always as (
		case when activated_by is null then null else 'admin' end
	) stored,
	activated_at timestamptz,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (user_id, course_id),
	foreign key (activated_by, activated_by_role)
		references public.profiles (id, role) on delete restrict,
	check ((activated_by is null) = (activated_at is null)),
	check (status <> 'active' or activated_by is not null)
);

create table if not exists public.lesson_progress (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users (id) on delete cascade,
	lesson_id uuid not null references public.lessons (id) on delete cascade,
	is_completed boolean not null default false,
	completed_at timestamptz,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	unique (user_id, lesson_id),
	check (not is_completed or completed_at is not null)
);

create table if not exists public.certificates (
	id uuid primary key default gen_random_uuid(),
	enrollment_id uuid not null unique references public.enrollments (id) on delete restrict,
	user_id uuid not null references auth.users (id) on delete restrict,
	course_id uuid not null references public.courses (id) on delete restrict,
	certificate_number text not null unique check (length(trim(certificate_number)) > 0),
	issued_by uuid references public.profiles (id) on delete restrict,
	issued_at timestamptz not null default now(),
	revoked_at timestamptz,
	revoked_by uuid references public.profiles (id) on delete restrict,
	created_at timestamptz not null default now(),
	check ((revoked_by is null) = (revoked_at is null))
);

create table if not exists public.admin_settings (
	setting_key text primary key check (length(trim(setting_key)) > 0),
	setting_value jsonb not null default '{}'::jsonb,
	updated_by uuid references public.profiles (id) on delete set null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create or replace function public.create_farmer_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	insert into public.profiles (id, full_name, phone, role)
	values (
		new.id,
		coalesce(
			nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
			nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
			nullif(split_part(new.email, '@', 1), ''),
			'Farmer'
		),
		nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
		'farmer'
	)
	on conflict do nothing;
	return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
	after insert on auth.users
	for each row execute function public.create_farmer_profile();

create index if not exists profiles_role_idx
	on public.profiles (role);
create index if not exists courses_status_display_order_idx
	on public.courses (status, display_order);
create index if not exists course_modules_course_order_idx
	on public.course_modules (course_id, display_order);
create index if not exists lessons_module_order_idx
	on public.lessons (module_id, display_order);
create index if not exists orders_user_created_idx
	on public.orders (user_id, created_at desc);
create index if not exists orders_course_status_idx
	on public.orders (course_id, payment_status);
create index if not exists enrollments_user_status_idx
	on public.enrollments (user_id, status);
create index if not exists enrollments_course_status_idx
	on public.enrollments (course_id, status);
create index if not exists lesson_progress_user_completed_idx
	on public.lesson_progress (user_id, is_completed);
create index if not exists certificates_user_issued_idx
	on public.certificates (user_id, issued_at desc);

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.course_modules enable row level security;
alter table public.lessons enable row level security;
alter table public.orders enable row level security;
alter table public.enrollments enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.certificates enable row level security;
alter table public.admin_settings enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
	on public.profiles for select to authenticated
	using (id = (select auth.uid()));

drop policy if exists "Users can create their own farmer profile" on public.profiles;
create policy "Users can create their own farmer profile"
	on public.profiles for insert to authenticated
	with check (id = (select auth.uid()) and role = 'farmer');

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
	on public.profiles for update to authenticated
	using (id = (select auth.uid()))
	with check (id = (select auth.uid()));

revoke all on public.profiles from authenticated;
revoke update (role) on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant insert (id, full_name, phone, preferred_language) on public.profiles to authenticated;
grant update (full_name, phone, preferred_language, updated_at) on public.profiles to authenticated;

-- No RLS policies are created intentionally: with RLS enabled and no policies,
-- anon/authenticated API access is denied. Later payment verification and
-- enrollment activation must be restricted to an authenticated administrator.
-- The Supabase secret key bypasses RLS; server routes using it must independently
-- verify administrator authorization before making either change.

commit;
