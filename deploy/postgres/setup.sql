-- =============================================================================
-- Argeneo — PostgreSQL role + database bootstrap (idempotent)
-- =============================================================================
-- Run ONCE on the VPS, as the postgres OS user:
--
--   sudo -u postgres psql -v argeneo_pw="'REPLACE_WITH_DB_PASSWORD'" \
--        -f /path/to/deploy/postgres/setup.sql
--
-- The :argeneo_pw value MUST match SPRING_DATASOURCE_PASSWORD in
-- /etc/argeneo/argeneo.env. provision.sh wires this up for you.
--
-- NOTE: This only creates the role + empty database. The SCHEMA is created by
-- Flyway automatically when the Spring Boot app starts — there is no manual
-- migration step here.
--
-- SECURITY: Postgres must listen on localhost only. Confirm in postgresql.conf:
--   listen_addresses = 'localhost'
-- and that pg_hba.conf only allows local/127.0.0.1 connections. The firewall
-- additionally keeps 5432 closed to the world (see provision.sh).
-- =============================================================================

-- If no password was passed via -v, fail loudly instead of creating a
-- passwordless role.
\if :{?argeneo_pw}
\else
  \echo '!! ERROR: pass the DB password, e.g.  -v argeneo_pw="'"'"'secret'"'"'"'
  \quit
\endif

-- --- Role -------------------------------------------------------------------
-- Create the login role only if it does not already exist; otherwise just make
-- sure the password matches what we were given (safe to re-run).
DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'argeneo') THEN
      EXECUTE format('CREATE ROLE argeneo LOGIN PASSWORD %L', :'argeneo_pw');
      RAISE NOTICE 'Role "argeneo" created.';
   ELSE
      EXECUTE format('ALTER ROLE argeneo LOGIN PASSWORD %L', :'argeneo_pw');
      RAISE NOTICE 'Role "argeneo" already existed — password synced.';
   END IF;
END
$$;

-- --- Database ---------------------------------------------------------------
-- CREATE DATABASE cannot run inside a DO/transaction block, so we generate the
-- statement conditionally and feed it to \gexec.
SELECT 'CREATE DATABASE argeneo OWNER argeneo ENCODING ''UTF8'' '
       'LC_COLLATE ''en_US.UTF-8'' LC_CTYPE ''en_US.UTF-8'' TEMPLATE template0'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'argeneo')
\gexec

-- Ensure ownership even if the DB pre-existed.
ALTER DATABASE argeneo OWNER TO argeneo;

\echo 'Argeneo Postgres setup complete (role + database). Schema is handled by Flyway on app startup.'
