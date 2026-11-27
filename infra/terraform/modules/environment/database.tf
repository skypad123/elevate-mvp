# Postgres 17 on RDS. The migrations create the citext and pg_trgm extensions; both are available
# to the master user. RDS for Postgres 15+ requires TLS by default, and the API image carries the
# RDS certificate bundle, so DATABASE_URL uses sslmode=verify-full.
#
# Two database users (ADR 012). `elevate`, the master user, owns the tables; only the migration
# task holds its connection string. `elevate_api` is the user the API runs as: the migration task
# creates it and sets its grants (`migrate.js`, `applyApiRole`), which leave it unable to update or
# delete attendance rows.

resource "random_password" "db" {
  length  = 32
  special = false # keeps the connection string free of characters that need URL-encoding
}

resource "random_password" "api_db" {
  length  = 32
  special = false # the same reason: database_url_api is built without URL-encoding
}

resource "aws_db_subnet_group" "main" {
  name       = local.prefix
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_db_instance" "main" {
  identifier = local.prefix

  engine                     = "postgres"
  engine_version             = "17"
  auto_minor_version_upgrade = true
  instance_class             = var.db_instance_class

  storage_type          = "gp3"
  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  storage_encrypted     = true

  db_name  = "elevate"
  username = "elevate"
  password = random_password.db.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]
  publicly_accessible    = false
  multi_az               = var.db_multi_az

  backup_retention_period   = var.db_backup_retention_days
  copy_tags_to_snapshot     = true
  deletion_protection       = var.protect_data
  skip_final_snapshot       = !var.protect_data
  final_snapshot_identifier = var.protect_data ? "${local.prefix}-final" : null

  apply_immediately = !var.protect_data
}

locals {
  database_url = format(
    "postgres://%s:%s@%s:%d/%s?sslmode=verify-full",
    aws_db_instance.main.username,
    random_password.db.result,
    aws_db_instance.main.address,
    aws_db_instance.main.port,
    aws_db_instance.main.db_name,
  )

  api_database_user = "elevate_api"

  database_url_api = format(
    "postgres://%s:%s@%s:%d/%s?sslmode=verify-full",
    local.api_database_user,
    random_password.api_db.result,
    aws_db_instance.main.address,
    aws_db_instance.main.port,
    aws_db_instance.main.db_name,
  )
}
