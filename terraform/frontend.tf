resource "aws_s3_bucket" "frontend" {
  bucket_prefix = "ecc-student-portal-frontend-${local.env}-"
  tags = {
    Project     = "ecc-student-portal"
    Environment = local.env
  }
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
    http_version = "http2"
    is_ipv6_enabled = true
    price_class     = "PriceClass_200"
    enabled         = true
    comment         = "[${local.env}] CDN for ecc-student-portal-frontend"

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
        min_ttl     = 0
        default_ttl = 300
        max_ttl     = 86400
    }

    restrictions {
      geo_restriction {
          restriction_type = "whitelist"
          locations = [ "JP" ]
      }
    }

    viewer_certificate {
        cloudfront_default_certificate = true
    }

    tags = {
      Project     = "ecc-student-portal"
      Environment = local.env
    }
}

output "cloudfront_domain" {
  description = "cloudfront domain"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

resource "aws_cloudfront_origin_access_identity" "frontend" {}
