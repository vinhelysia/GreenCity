-- Runs only when using the PostGIS Docker image (docker-entrypoint-initdb.d).
CREATE EXTENSION IF NOT EXISTS postgis;
