# ACM証明書（CloudFront用、us-east-1リージョン必須）
resource "aws_acm_certificate" "frontend" {
  count             = local.use_custom_domain ? 1 : 0
  provider          = aws.us-east-1
  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${local.resource_prefix}-cloudfront-cert"
    }
  )
}

# DNS検証レコード（Route 53に自動作成）
resource "aws_route53_record" "cert_validation" {
  count   = local.use_custom_domain ? 1 : 0
  zone_id = var.hosted_zone_id
  name    = tolist(aws_acm_certificate.frontend[0].domain_validation_options)[0].resource_record_name
  type    = tolist(aws_acm_certificate.frontend[0].domain_validation_options)[0].resource_record_type
  records = [tolist(aws_acm_certificate.frontend[0].domain_validation_options)[0].resource_record_value]
  ttl     = 60
}

# 証明書検証の完了を待機
resource "aws_acm_certificate_validation" "frontend" {
  count                   = local.use_custom_domain ? 1 : 0
  provider                = aws.us-east-1
  certificate_arn         = aws_acm_certificate.frontend[0].arn
  validation_record_fqdns = [aws_route53_record.cert_validation[0].fqdn]
}
