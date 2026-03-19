resource "aws_s3_bucket" "frontend" {
  bucket_prefix = "${local.resource_prefix}-frontend-"
  tags          = local.common_tags
}

resource "aws_s3_bucket_website_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  index_document {
    suffix = "index.html"
  }
  error_document {
    key = "404.html"
  }
}

resource "aws_s3_bucket_policy" "bucket" {
    bucket = aws_s3_bucket.frontend.id
    policy = data.aws_iam_policy_document.frontend_policy.json
}

output "frontend_bucket" {
  description = "frontend origin"
  value       = aws_s3_bucket.frontend.id
}


data "aws_iam_policy_document" "frontend_policy" {
  depends_on = [aws_cloudfront_origin_access_identity.frontend]
  statement {
    sid = "AllowCloudFront"
    effect = "Allow"
    principals {
        type = "AWS"
        identifiers = [aws_cloudfront_origin_access_identity.frontend.iam_arn]
    }
    actions = [
        "s3:GetObject"
    ]

    resources = [
        "${aws_s3_bucket.frontend.arn}/*"
    ]
  }
}

resource "aws_cloudfront_distribution" "frontend" {
    http_version    = "http2"
    is_ipv6_enabled = true
    price_class     = var.cloudfront_price_class
    enabled         = true
    comment         = "[${local.env}] CDN for ${var.project_name} frontend"
    aliases         = local.use_custom_domain ? [var.domain_name] : []

    origin {
        domain_name = aws_s3_bucket.frontend.bucket_regional_domain_name
        origin_id = aws_s3_bucket.frontend.id
        s3_origin_config {
          origin_access_identity = aws_cloudfront_origin_access_identity.frontend.cloudfront_access_identity_path
        }
    }

    default_root_object = "index.html"

    default_cache_behavior {
        allowed_methods  = [ "GET", "HEAD" ]
        cached_methods   = [ "GET", "HEAD" ]
        target_origin_id = aws_s3_bucket.frontend.id

        forwarded_values {
            query_string = false

            cookies {
              forward = "none"
            }
        }

        viewer_protocol_policy = "redirect-to-https"
        min_ttl                = var.min_ttl
        default_ttl            = var.default_ttl
        max_ttl                = var.max_ttl
    }

    restrictions {
      geo_restriction {
        restriction_type = "whitelist"
        locations        = var.geo_restriction_locations
      }
    }

    viewer_certificate {
      cloudfront_default_certificate = local.use_custom_domain ? false : true
      acm_certificate_arn            = local.use_custom_domain ? aws_acm_certificate.frontend[0].arn : null
      ssl_support_method             = local.use_custom_domain ? "sni-only" : null
      minimum_protocol_version       = local.use_custom_domain ? "TLSv1.2_2021" : null
    }

    tags = local.common_tags
}

output "cloudfront_domain" {
  description = "cloudfront domain"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID for cache invalidation"
  value       = aws_cloudfront_distribution.frontend.id
}

output "website_url" {
  description = "Website URL"
  value       = local.use_custom_domain ? "https://${var.domain_name}" : "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

resource "aws_cloudfront_origin_access_identity" "frontend" {}
