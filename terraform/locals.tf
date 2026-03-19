locals {
  env = terraform.workspace

  # tide-ical-{env} の命名規則
  resource_prefix = "${var.project_name}-${local.env}"

  # 全リソース共通のタグ
  common_tags = {
    Project     = var.project_name
    Environment = local.env
    ManagedBy   = "Terraform"
  }
}
